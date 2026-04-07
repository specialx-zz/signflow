/**
 * playerController.js
 * Handles player-specific API endpoints (no admin auth required).
 * These are called directly by the kiosk browser player.
 */

const prisma = require('../utils/prisma');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const storage = require('../utils/storage');

// Screenshot upload storage
const screenshotDir = path.join(__dirname, '..', '..', 'uploads', 'screenshots');
fs.ensureDirSync(screenshotDir);

const screenshotStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, screenshotDir),
  filename: (req, file, cb) => {
    const deviceId = req.params.id || 'unknown';
    const ts = Date.now();
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${deviceId}_${ts}${ext}`);
  },
});
const screenshotUpload = multer({
  storage: screenshotStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * POST /api/devices/register
 * Registers a player device. Creates the device record if it doesn't exist,
 * or updates lastSeen if it does. Returns deviceId.
 */
const registerPlayerDevice = async (req, res) => {
  try {
    const { deviceId, deviceName, playerVersion, userAgent } = req.body;

    if (!deviceId || !deviceName) {
      return res.status(400).json({ error: 'deviceId and deviceName are required' });
    }

    // Upsert: find by deviceId, create if not exists
    let device = await prisma.device.findUnique({ where: { deviceId } });

    if (!device) {
      // Assign to default tenant on first registration
      let defaultTenant = await prisma.tenant.findFirst({ where: { slug: 'default-tenant' } });
      if (!defaultTenant) {
        defaultTenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
      }

      device = await prisma.device.create({
        data: {
          id: uuidv4(),
          name: deviceName,
          deviceId,
          status: 'ONLINE',
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
          firmware: playerVersion || null,
          lastSeen: new Date(),
          isActive: true,
          tenantId: defaultTenant ? defaultTenant.id : null,
        },
      });
      console.log(`[Player] New device registered: ${deviceName} (${deviceId}) tenant=${defaultTenant?.slug || 'none'}`);
    } else {
      device = await prisma.device.update({
        where: { deviceId },
        data: {
          name: deviceName,
          status: 'ONLINE',
          lastSeen: new Date(),
          isActive: true,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || device.ipAddress,
          ...(playerVersion && { firmware: playerVersion }),
        },
      });
      console.log(`[Player] Device re-registered: ${deviceName} (${deviceId})`);
    }

    // Broadcast online status to admin clients
    if (req.io) {
      req.io.emit('device:status', {
        deviceId: device.deviceId,
        status: 'ONLINE',
        info: { name: device.name, lastSeen: device.lastSeen },
      });
    }

    return res.status(200).json({
      deviceId: device.deviceId,
      deviceName: device.name,
      registeredAt: device.createdAt.toISOString(),
      message: 'Device registered successfully',
    });
  } catch (error) {
    console.error('[Player] registerPlayerDevice error:', error);
    return res.status(500).json({ error: 'Failed to register device' });
  }
};

/**
 * GET /api/devices/:id/schedules
 * Returns schedules deployed to this device.
 * :id is the deviceId string (not internal UUID).
 */
const getDeviceSchedules = async (req, res) => {
  try {
    const { id: deviceId } = req.params;

    // Find device by deviceId field
    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) {
      // Device not registered yet – return empty
      return res.json([]);
    }

    // Get schedules deployed to this device that are active, filtered by device's tenant
    const scheduleFilter = {
      isActive: true,
      status: 'ACTIVE',
    };
    if (device.tenantId) {
      scheduleFilter.tenantId = device.tenantId;
    }

    const scheduleDevices = await prisma.scheduleDevice.findMany({
      where: {
        deviceId: device.id,
        schedule: scheduleFilter,
      },
      include: {
        schedule: {
          include: {
            playlist: {
              include: {
                items: {
                  include: {
                    content: true,
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
            layout: {
              select: {
                id: true, name: true, baseWidth: true, baseHeight: true,
                zones: {
                  orderBy: { zIndex: 'asc' },
                  include: {
                    playlist: {
                      select: {
                        id: true, name: true,
                        items: {
                          orderBy: { order: 'asc' },
                          include: {
                            content: {
                              select: { id: true, name: true, type: true, filePath: true, url: true, duration: true, canvasJson: true, storageType: true, thumbnail: true }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
          },
        },
      },
    });

    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`;

    // Collect all content items that need R2 URL resolution
    const r2Contents = new Map(); // contentId -> content record

    // Helper to resolve a content file URL (R2 or local)
    const resolveFileUrl = async (content) => {
      if (content.storageType === 'r2' && content.filePath) {
        // Use storage abstraction to get signed/public URL
        return storage.getFileUrl(content.filePath, 'r2', 7200);
      }
      // Local file: build absolute URL from filePath or url
      if (content.filePath) {
        const cleanPath = content.filePath.replace(/\\/g, '/').replace(/^.*uploads[/\\]/, '');
        return `${serverUrl}/uploads/${cleanPath}`;
      }
      if (content.url) {
        return content.url.startsWith('http') ? content.url : `${serverUrl}${content.url}`;
      }
      return '';
    };

    // Helper to map playlist items to ContentItem shape
    const mapPlaylistItems = async (playlist) => {
      const items = playlist?.items ?? [];
      return Promise.all(items.map(async (item) => {
        const content = item.content;
        const fileUrl = await resolveFileUrl(content);

        // Parse item settings for transition
        let transition = 'fade';
        if (item.settings) {
          try {
            const s = JSON.parse(item.settings);
            if (s.transition) transition = s.transition;
          } catch { /* keep default */ }
        }

        // Build content entry
        const contentEntry = {
          id: content.id,
          name: content.name,
          type: content.type,
          fileUrl,
          url: fileUrl,
          duration: item.duration || content.duration || 10,
          thumbnailUrl: content.thumbnail
            ? `${serverUrl}/uploads/thumbnails/${path.basename(content.thumbnail)}`
            : undefined,
        };

        // Include canvasData for CANVAS type content
        if (content.type === 'CANVAS' && content.canvasJson) {
          try {
            contentEntry.canvasData = JSON.parse(content.canvasJson);
            // Calculate total duration from all pages
            const pages = contentEntry.canvasData.pages || [];
            const totalPageDuration = pages.reduce((sum, p) => sum + (p.duration || 10), 0);
            if (!item.duration && totalPageDuration > 0) {
              contentEntry.duration = totalPageDuration;
            }
          } catch (e) {
            console.error('[Player] Failed to parse canvasJson:', e);
          }
        }

        return {
          id: item.id,
          content: contentEntry,
          duration: contentEntry.duration,
          order: item.order,
          transition,
        };
      }));
    };

    // Map to the ScheduleEntry shape the player expects
    const schedules = await Promise.all(
      scheduleDevices
        .filter((sd) => sd.schedule.playlist || sd.schedule.layout)
        .map(async (sd) => {
          const s = sd.schedule;
          const playlist = s.playlist;

          // Build playlist entry if available
          let playlistEntry = null;
          if (playlist) {
            playlistEntry = {
              id: playlist.id,
              name: playlist.name,
              type: playlist.type,
              items: await mapPlaylistItems(playlist),
            };
          }

          // Build layout entry if available (map zone playlists too)
          let layoutEntry = null;
          if (s.layout) {
            const zones = await Promise.all(
              (s.layout.zones || []).map(async (zone) => ({
                id: zone.id,
                name: zone.name,
                x: zone.x,
                y: zone.y,
                width: zone.width,
                height: zone.height,
                zIndex: zone.zIndex,
                contentType: zone.contentType,
                playlistId: zone.playlistId,
                sourceUrl: zone.sourceUrl || null,
                sourceHtml: zone.sourceHtml || null,
                bgColor: zone.bgColor,
                fit: zone.fit,
                playlist: zone.playlist
                  ? {
                      id: zone.playlist.id,
                      name: zone.playlist.name,
                      items: await mapPlaylistItems(zone.playlist),
                    }
                  : null,
              }))
            );

            layoutEntry = {
              id: s.layout.id,
              name: s.layout.name,
              baseWidth: s.layout.baseWidth,
              baseHeight: s.layout.baseHeight,
              zones,
            };
          }

          return {
            id: s.id,
            playlist: playlistEntry,
            layout: layoutEntry,
            startTime: s.startTime || '00:00',
            endTime: s.endTime || '23:59',
            startDate: s.startDate
              ? s.startDate.toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10),
            endDate: s.endDate
              ? s.endDate.toISOString().slice(0, 10)
              : '2099-12-31',
            repeat: s.repeatType || 'NONE',
            daysOfWeek: s.repeatDays
              ? (() => {
                  try {
                    const parsed = JSON.parse(s.repeatDays);
                    return Array.isArray(parsed) ? parsed : undefined;
                  } catch {
                    return undefined;
                  }
                })()
              : undefined,
          };
        })
    );

    // ─── V5.2: 기본 채널 (Default Channel) 조회 ─────────────────────
    let defaultChannel = null;
    try {
      const channelDevices = await prisma.channelDevice.findMany({
        where: { deviceId: device.id },
        include: {
          channel: {
            include: {
              contents: {
                orderBy: { order: 'asc' },
                include: {
                  content: {
                    select: {
                      id: true, name: true, type: true,
                      filePath: true, url: true, duration: true,
                      storageType: true, canvasJson: true, thumbnail: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      // isDefault=true && isActive=true 인 채널 우선, 없으면 isActive=true인 첫 채널
      const defaultCh = channelDevices.find(cd => cd.channel.isDefault && cd.channel.isActive)
        || channelDevices.find(cd => cd.channel.isActive);

      if (defaultCh && defaultCh.channel.contents.length > 0) {
        const ch = defaultCh.channel;
        defaultChannel = {
          id: ch.id,
          name: ch.name,
          items: await Promise.all(ch.contents.map(async (cc) => {
            const content = cc.content;
            const fileUrl = await resolveFileUrl(content);
            const contentEntry = {
              id: content.id,
              name: content.name,
              type: content.type,
              fileUrl,
              url: fileUrl,
              duration: cc.duration || content.duration || 10,
              thumbnailUrl: content.thumbnail
                ? `${serverUrl}/uploads/thumbnails/${path.basename(content.thumbnail)}`
                : undefined,
            };
            if (content.type === 'CANVAS' && content.canvasJson) {
              try {
                contentEntry.canvasData = JSON.parse(content.canvasJson);
                const pages = contentEntry.canvasData.pages || [];
                const totalPageDuration = pages.reduce((sum, p) => sum + (p.duration || 10), 0);
                if (!cc.duration && totalPageDuration > 0) {
                  contentEntry.duration = totalPageDuration;
                }
              } catch (e) { /* ignore */ }
            }
            return {
              id: cc.id,
              content: contentEntry,
              duration: contentEntry.duration,
              order: cc.order,
              transition: 'fade',
            };
          }))
        };
      }
    } catch (e) {
      console.error('[Player] Failed to fetch default channel:', e);
    }

    // ─── V5.2: 디바이스 태그 조회 (조건부 재생용) ─────────────────
    let deviceTags = {};
    if (device.tags) {
      try { deviceTags = JSON.parse(device.tags); } catch { /* ignore */ }
    }

    // ─── V5.2: 스케줄 조건(conditions) 포함 ──────────────────────
    // 각 스케줄에 대해 조건 목록을 추가로 조회
    const schedulesWithConditions = await Promise.all(
      schedules.map(async (s) => {
        try {
          const conditions = await prisma.scheduleCondition.findMany({
            where: { scheduleId: s.id },
            orderBy: { priority: 'desc' },
            include: {
              playlist: {
                include: {
                  items: {
                    orderBy: { order: 'asc' },
                    include: { content: true }
                  }
                }
              }
            }
          });

          if (conditions.length === 0) return s;

          const mappedConditions = await Promise.all(
            conditions.map(async (cond) => ({
              tagKey: cond.tagKey,
              tagValue: cond.tagValue,
              priority: cond.priority,
              playlist: cond.playlist ? {
                id: cond.playlist.id,
                name: cond.playlist.name,
                type: cond.playlist.type,
                items: await mapPlaylistItems(cond.playlist),
              } : null,
            }))
          );

          return { ...s, conditions: mappedConditions };
        } catch {
          return s;
        }
      })
    );

    return res.json({
      schedules: schedulesWithConditions,
      defaultChannel,
      deviceTags,
    });
  } catch (error) {
    console.error('[Player] getDeviceSchedules error:', error);
    return res.status(500).json({ error: 'Failed to get schedules' });
  }
};

/**
 * POST /api/devices/:id/status
 * Update device status from the player.
 */
const updateDeviceStatus = async (req, res) => {
  try {
    const { id: deviceId } = req.params;
    const {
      isOnline,
      currentContent,
      currentPlaylist,
      currentSchedule,
      volume,
      brightness,
      isPlaying,
    } = req.body;

    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const updateData = {
      status: isOnline !== false ? 'ONLINE' : 'OFFLINE',
      lastSeen: new Date(),
    };
    if (volume !== undefined) updateData.volume = Number(volume);
    if (brightness !== undefined) updateData.brightness = Number(brightness);

    await prisma.device.update({
      where: { deviceId },
      data: updateData,
    });

    // Broadcast to admin clients
    if (req.io) {
      req.io.emit('device:status', {
        deviceId,
        status: updateData.status,
        info: {
          currentContent,
          currentPlaylist,
          currentSchedule,
          volume,
          brightness,
          isPlaying,
          lastSeen: updateData.lastSeen,
        },
      });
    }

    return res.json({ message: 'Status updated' });
  } catch (error) {
    console.error('[Player] updateDeviceStatus error:', error);
    return res.status(500).json({ error: 'Failed to update status' });
  }
};

/**
 * POST /api/devices/:id/screenshot
 * Receive and save a screenshot from the player.
 */
const uploadScreenshot = [
  screenshotUpload.single('screenshot'),
  async (req, res) => {
    try {
      const { id: deviceId } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'No screenshot file provided' });
      }

      const screenshotUrl = `/uploads/screenshots/${req.file.filename}`;

      console.log(`[Player] Screenshot received from ${deviceId}: ${req.file.filename}`);

      // Broadcast screenshot to admin clients
      if (req.io) {
        req.io.emit('device:screenshot', {
          deviceId,
          url: screenshotUrl,
          timestamp: Date.now(),
        });
      }

      return res.json({
        message: 'Screenshot received',
        url: screenshotUrl,
        filename: req.file.filename,
      });
    } catch (error) {
      console.error('[Player] uploadScreenshot error:', error);
      return res.status(500).json({ error: 'Failed to save screenshot' });
    }
  },
];

/**
 * GET /api/devices/:id/latest-screenshot
 * Returns the latest screenshot URL for a device.
 * :id is the internal device UUID (used by admin clients).
 */
const getLatestScreenshot = async (req, res) => {
  try {
    const { id } = req.params; // DB UUID from admin client
    const screenshotDirPath = path.join(__dirname, '..', '..', 'uploads', 'screenshots');

    // req.params.id = DB UUID (e.g. "d970fb2b-...")
    // Screenshot files are named with the player's deviceId field (e.g. "ec25dbd2-...")
    // so we look up the device to get the correct deviceId for filename matching.
    let filePrefix = id; // fallback: try DB id directly
    try {
      const device = await prisma.device.findUnique({ where: { id } });
      if (device && device.deviceId) {
        filePrefix = device.deviceId;
      }
    } catch (_) { /* not found, keep id as prefix */ }

    const files = await fs.readdir(screenshotDirPath).catch(() => []);
    // Files are named: {deviceId}_{timestamp}.ext
    const deviceFiles = files
      .filter(f => f.startsWith(filePrefix + '_'))
      .sort()
      .reverse(); // newest first

    if (deviceFiles.length === 0) {
      return res.json({ url: null, timestamp: null });
    }

    const latest = deviceFiles[0];
    const parts = latest.split('_');
    const tsPart = parts[parts.length - 1].split('.')[0];
    const timestamp = parseInt(tsPart) || Date.now();

    return res.json({
      url: `/uploads/screenshots/${latest}`,
      timestamp,
      filename: latest,
    });
  } catch (error) {
    console.error('[Player] getLatestScreenshot error:', error);
    return res.status(500).json({ error: 'Failed to get screenshot' });
  }
};

/**
 * GET /api/devices/:id/manifest
 * Returns a content manifest for the player to pre-download.
 * Lists all unique content files needed for the device's active schedules.
 * :id is the deviceId string (player's deviceId).
 */
const getContentManifest = async (req, res) => {
  try {
    const { id: deviceId } = req.params;

    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) {
      return res.json({ manifest: [], version: 0 });
    }

    // Get all active schedules for this device
    const scheduleFilter = { isActive: true, status: 'ACTIVE' };
    if (device.tenantId) scheduleFilter.tenantId = device.tenantId;

    const scheduleDevices = await prisma.scheduleDevice.findMany({
      where: {
        deviceId: device.id,
        schedule: scheduleFilter,
      },
      include: {
        schedule: {
          include: {
            playlist: {
              include: {
                items: { include: { content: true } },
              },
            },
            layout: {
              include: {
                zones: {
                  include: {
                    playlist: {
                      include: {
                        items: { include: { content: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Collect all unique content items
    const contentMap = new Map();

    const collectFromPlaylist = (playlist) => {
      if (!playlist?.items) return;
      for (const item of playlist.items) {
        if (item.content && item.content.filePath && !contentMap.has(item.content.id)) {
          contentMap.set(item.content.id, {
            id: item.content.id,
            filePath: item.content.filePath,
            storageType: item.content.storageType || 'local',
            size: item.content.size || 0,
            mimeType: item.content.mimeType || 'application/octet-stream',
            name: item.content.name,
            type: item.content.type,
          });
        }
      }
    };

    for (const sd of scheduleDevices) {
      const s = sd.schedule;
      if (s.playlist) collectFromPlaylist(s.playlist);
      if (s.layout?.zones) {
        for (const zone of s.layout.zones) {
          if (zone.playlist) collectFromPlaylist(zone.playlist);
        }
      }
    }

    // Generate manifest with download URLs
    const manifest = await storage.generateManifest(Array.from(contentMap.values()));

    // Compute version hash (simple: concat of content IDs sorted)
    const ids = Array.from(contentMap.keys()).sort();
    const version = ids.length > 0
      ? ids.join(',').split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0) >>> 0
      : 0;

    return res.json({
      manifest,
      version,
      totalSize: manifest.reduce((sum, m) => sum + m.size, 0),
      count: manifest.length,
    });
  } catch (error) {
    console.error('[Player] getContentManifest error:', error);
    return res.status(500).json({ error: 'Failed to get content manifest' });
  }
};

/**
 * POST /api/devices/:id/deployment-status
 * Player reports download progress for content items.
 * Body: { items: [{ contentId, status, progress, errorMessage? }] }
 */
const updateDeploymentStatus = async (req, res) => {
  try {
    const { id: deviceId } = req.params;
    const { items } = req.body;

    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const results = [];
    for (const item of items) {
      const data = {
        status: item.status || 'DOWNLOADING',
        progress: item.progress || 0,
        ...(item.status === 'COMPLETED' && { downloadedAt: new Date() }),
        ...(item.errorMessage && { errorMessage: item.errorMessage }),
      };

      const deployment = await prisma.contentDeployment.upsert({
        where: {
          deviceId_contentId: {
            deviceId: device.id,
            contentId: item.contentId,
          },
        },
        update: data,
        create: {
          id: uuidv4(),
          deviceId: device.id,
          contentId: item.contentId,
          fileSize: item.fileSize || 0,
          ...data,
        },
      });
      results.push(deployment);
    }

    // Broadcast deployment progress to admin clients
    if (req.io) {
      req.io.emit('device:deployment', {
        deviceId,
        items: results.map(r => ({
          contentId: r.contentId,
          status: r.status,
          progress: r.progress,
        })),
      });
    }

    return res.json({ message: 'Deployment status updated', count: results.length });
  } catch (error) {
    console.error('[Player] updateDeploymentStatus error:', error);
    return res.status(500).json({ error: 'Failed to update deployment status' });
  }
};

/**
 * GET /api/devices/:id/deployment-status
 * Get deployment status for a device (admin use).
 * :id is the internal device UUID.
 */
const getDeploymentStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const deployments = await prisma.contentDeployment.findMany({
      where: { deviceId: id },
      orderBy: { updatedAt: 'desc' },
    });

    const total = deployments.length;
    const completed = deployments.filter(d => d.status === 'COMPLETED').length;
    const failed = deployments.filter(d => d.status === 'FAILED').length;
    const downloading = deployments.filter(d => d.status === 'DOWNLOADING').length;
    const pending = deployments.filter(d => d.status === 'PENDING').length;

    return res.json({
      summary: { total, completed, failed, downloading, pending },
      items: deployments,
    });
  } catch (error) {
    console.error('[Player] getDeploymentStatus error:', error);
    return res.status(500).json({ error: 'Failed to get deployment status' });
  }
};

module.exports = {
  registerPlayerDevice,
  getDeviceSchedules,
  updateDeviceStatus,
  uploadScreenshot,
  getLatestScreenshot,
  getContentManifest,
  updateDeploymentStatus,
  getDeploymentStatus,
};
