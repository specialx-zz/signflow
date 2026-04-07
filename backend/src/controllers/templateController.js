const prisma = require('../utils/prisma');
const path = require('path');

// List templates with search/filter
const getTemplates = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, type, sort = 'latest' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { isActive: true };
    if (search) where.name = { contains: search };
    if (category) where.category = category;
    if (type) where.type = type;

    let orderBy = { createdAt: 'desc' };
    if (sort === 'popular') orderBy = { downloads: 'desc' };
    if (sort === 'rating') orderBy = { rating: 'desc' };

    const [templates, total] = await Promise.all([
      prisma.contentTemplate.findMany({ where, orderBy, skip, take: parseInt(limit) }),
      prisma.contentTemplate.count({ where }),
    ]);

    // Resolve URLs
    const resolved = templates.map(t => ({
      ...t,
      thumbnailUrl: t.thumbnail ? `/uploads/${t.thumbnail}` : null,
      fileUrl: `/uploads/${t.filePath}`,
    }));

    res.json({ templates: resolved, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get categories
const getCategories = async (req, res) => {
  try {
    const templates = await prisma.contentTemplate.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
    });
    res.json({ categories: templates.map(t => t.category) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single template
const getTemplate = async (req, res) => {
  try {
    const template = await prisma.contentTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const reviews = await prisma.templateReview.findMany({
      where: { templateId: template.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({ ...template, thumbnailUrl: template.thumbnail ? `/uploads/${template.thumbnail}` : null, fileUrl: `/uploads/${template.filePath}`, reviews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Upload template (SUPER_ADMIN only)
const createTemplate = async (req, res) => {
  try {
    const { name, description, category, type, tags, isPremium } = req.body;
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const filePath = req.file.path.replace(/\\/g, '/').split('uploads/')[1] || req.file.filename;

    const template = await prisma.contentTemplate.create({
      data: {
        name: name || req.file.originalname,
        description,
        category: category || '일반',
        type: type || req.file.mimetype.split('/')[0].toUpperCase(),
        filePath,
        thumbnail: filePath, // same as file for now
        tags,
        isPremium: isPremium === 'true',
        createdBy: req.user.id,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Download/use template (copies to tenant's content)
const useTemplate = async (req, res) => {
  try {
    const template = await prisma.contentTemplate.findUnique({ where: { id: req.params.id } });
    if (!template || !template.isActive) return res.status(404).json({ error: 'Template not found' });

    // Create a content entry for the tenant referencing the template file
    const content = await prisma.content.create({
      data: {
        name: `[템플릿] ${template.name}`,
        type: template.type.toLowerCase(),
        mimeType: template.type === 'IMAGE' ? 'image/png' : template.type === 'VIDEO' ? 'video/mp4' : 'application/octet-stream',
        filePath: template.filePath,
        storageType: template.storageType,
        size: 0,
        tenantId: req.tenantId || req.user.tenantId,
        createdBy: req.user.id,
        isActive: true,
      },
    });

    // Increment download count
    await prisma.contentTemplate.update({
      where: { id: template.id },
      data: { downloads: { increment: 1 } },
    });

    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Review template
const reviewTemplate = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    const review = await prisma.templateReview.upsert({
      where: { templateId_userId: { templateId: req.params.id, userId: req.user.id } },
      create: {
        templateId: req.params.id,
        userId: req.user.id,
        tenantId: req.tenantId || req.user.tenantId,
        rating: parseInt(rating),
        comment,
      },
      update: {
        rating: parseInt(rating),
        comment,
      },
    });

    // Recalculate average
    const stats = await prisma.templateReview.aggregate({
      where: { templateId: req.params.id },
      _avg: { rating: true },
      _count: true,
    });

    await prisma.contentTemplate.update({
      where: { id: req.params.id },
      data: {
        rating: Math.round((stats._avg.rating || 0) * 10) / 10,
        reviewCount: stats._count,
      },
    });

    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete template (SUPER_ADMIN only)
const deleteTemplate = async (req, res) => {
  try {
    await prisma.contentTemplate.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getTemplates, getCategories, getTemplate, createTemplate, useTemplate, reviewTemplate, deleteTemplate };
