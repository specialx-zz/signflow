const prisma = require('../utils/prisma');
const crypto = require('crypto');

const getWebhooks = async (req, res) => {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ webhooks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createWebhook = async (req, res) => {
  try {
    const { name, url, events, secret } = req.body;
    if (!name || !url || !events) {
      return res.status(400).json({ error: 'Name, URL, and events are required' });
    }

    const webhook = await prisma.webhook.create({
      data: {
        tenantId: req.tenantId,
        name,
        url,
        events: Array.isArray(events) ? events.join(',') : events,
        secret: secret || crypto.randomBytes(32).toString('hex'),
        createdBy: req.user.id,
      },
    });
    res.status(201).json(webhook);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, events, isActive } = req.body;

    const webhook = await prisma.webhook.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

    const updated = await prisma.webhook.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
        ...(events !== undefined && { events: Array.isArray(events) ? events.join(',') : events }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await prisma.webhook.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

    // Delete logs first, then webhook
    await prisma.webhookLog.deleteMany({ where: { webhookId: id } });
    await prisma.webhook.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getWebhookLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const webhook = await prisma.webhook.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where: { webhookId: id },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.webhookLog.count({ where: { webhookId: id } }),
    ]);
    res.json({ logs, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const testWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await prisma.webhook.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

    const WebhookService = require('../services/webhookService');
    const result = await WebhookService.send(webhook, 'test.ping', {
      message: 'VueSign webhook test',
      timestamp: new Date().toISOString(),
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getWebhooks, createWebhook, updateWebhook, deleteWebhook, getWebhookLogs, testWebhook };
