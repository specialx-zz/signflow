/**
 * storage.js
 * Cloudflare R2 / Local storage abstraction layer.
 *
 * When R2 is configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET),
 * files are uploaded to R2 and served via signed URLs.
 * Otherwise, falls back to local disk storage (uploads/ directory).
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs-extra');
const path = require('path');

// ─── R2 Configuration ─────────────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'signflow-content';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''; // e.g. https://pub-xxx.r2.dev

const isR2Enabled = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

let r2Client = null;

if (isR2Enabled) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  console.log(`[Storage] Cloudflare R2 enabled — bucket: ${R2_BUCKET}`);
} else {
  console.log('[Storage] R2 not configured — using local disk storage');
}

// ─── Helper: content type directory ───────────────────────
function getTypeDir(mimetype) {
  if (!mimetype) return 'documents';
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('video/')) return 'videos';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'documents';
}

// ─── R2 Key builder ───────────────────────────────────────
function buildR2Key(tenantId, typeDir, filename) {
  return `${tenantId}/${typeDir}/${filename}`;
}

/**
 * Upload a file to storage (R2 or local).
 *
 * @param {Object} opts
 * @param {string} opts.tenantId - tenant identifier
 * @param {string} opts.filename - stored filename (e.g. uuid.ext)
 * @param {string} opts.mimetype - MIME type
 * @param {Buffer|string} opts.filePathOrBuffer - local file path or Buffer
 * @param {number} [opts.size] - file size in bytes
 * @returns {Promise<{ storageType: 'r2'|'local', key: string, filePath: string, url: string }>}
 */
async function uploadFile({ tenantId, filename, mimetype, filePathOrBuffer, size }) {
  const typeDir = getTypeDir(mimetype);

  if (isR2Enabled) {
    const key = buildR2Key(tenantId, typeDir, filename);

    // Read file buffer
    let body;
    if (Buffer.isBuffer(filePathOrBuffer)) {
      body = filePathOrBuffer;
    } else {
      body = await fs.readFile(filePathOrBuffer);
    }

    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: mimetype,
      ContentLength: size || body.length,
    }));

    // Clean up local temp file if it was a file path
    if (!Buffer.isBuffer(filePathOrBuffer)) {
      await fs.remove(filePathOrBuffer).catch(() => {});
    }

    // Generate URL
    let url;
    if (R2_PUBLIC_URL) {
      url = `${R2_PUBLIC_URL}/${key}`;
    } else {
      // Will use signed URLs on-demand
      url = null;
    }

    console.log(`[Storage] Uploaded to R2: ${key}`);
    return {
      storageType: 'r2',
      key,
      filePath: key, // stored in DB
      url, // public URL or null (signed URL generated on request)
    };
  }

  // ─── Local storage fallback ──────────────────────────────
  const uploadsBase = path.join(__dirname, '../../uploads');
  const destDir = path.join(uploadsBase, typeDir);
  await fs.ensureDir(destDir);

  const destPath = path.join(destDir, filename);

  if (Buffer.isBuffer(filePathOrBuffer)) {
    await fs.writeFile(destPath, filePathOrBuffer);
  } else if (filePathOrBuffer !== destPath) {
    // multer already saved to uploads dir — if paths differ, move
    await fs.move(filePathOrBuffer, destPath, { overwrite: true });
  }
  // else: file already in the right place (multer destination matched)

  const relativePath = `uploads/${typeDir}/${filename}`;
  const publicUrl = `/uploads/${typeDir}/${filename}`;

  return {
    storageType: 'local',
    key: relativePath,
    filePath: relativePath,
    url: publicUrl,
  };
}

/**
 * Get a download URL for a stored file.
 *
 * @param {string} key - storage key (R2 key or local relative path)
 * @param {string} [storageType] - 'r2' or 'local'. Auto-detected if not provided.
 * @param {number} [expiresIn=3600] - signed URL expiration in seconds (R2 only)
 * @returns {Promise<string>} download URL
 */
async function getFileUrl(key, storageType, expiresIn = 3600) {
  // Auto-detect storage type
  if (!storageType) {
    storageType = isR2Enabled && !key.startsWith('uploads/') ? 'r2' : 'local';
  }

  if (storageType === 'r2' && r2Client) {
    // If we have a public URL, use it directly
    if (R2_PUBLIC_URL) {
      return `${R2_PUBLIC_URL}/${key}`;
    }
    // Otherwise generate a signed URL
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    return getSignedUrl(r2Client, command, { expiresIn });
  }

  // Local: return the public URL path
  if (key.startsWith('uploads/')) {
    return `/${key}`;
  }
  return `/uploads/${key}`;
}

/**
 * Delete a file from storage.
 *
 * @param {string} key - storage key
 * @param {string} [storageType]
 */
async function deleteFile(key, storageType) {
  if (!storageType) {
    storageType = isR2Enabled && !key.startsWith('uploads/') ? 'r2' : 'local';
  }

  if (storageType === 'r2' && r2Client) {
    try {
      await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
      console.log(`[Storage] Deleted from R2: ${key}`);
    } catch (err) {
      console.error(`[Storage] R2 delete failed for ${key}:`, err.message);
    }
    return;
  }

  // Local
  const fullPath = path.join(__dirname, '../..', key.startsWith('uploads/') ? key : `uploads/${key}`);
  await fs.remove(fullPath).catch(() => {});
}

/**
 * Check if a file exists in storage.
 *
 * @param {string} key
 * @param {string} [storageType]
 * @returns {Promise<boolean>}
 */
async function fileExists(key, storageType) {
  if (!storageType) {
    storageType = isR2Enabled && !key.startsWith('uploads/') ? 'r2' : 'local';
  }

  if (storageType === 'r2' && r2Client) {
    try {
      await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  const fullPath = path.join(__dirname, '../..', key.startsWith('uploads/') ? key : `uploads/${key}`);
  return fs.pathExists(fullPath);
}

/**
 * Generate a content manifest for a device.
 * Lists all content files the device needs, with download URLs.
 *
 * @param {Array} contentItems - array of { id, filePath, storageType, size, mimeType }
 * @returns {Promise<Array<{ id, url, size, mimeType, key }>>}
 */
async function generateManifest(contentItems) {
  const manifest = [];
  for (const item of contentItems) {
    if (!item.filePath) continue;

    const st = item.storageType || (isR2Enabled && !item.filePath.startsWith('uploads/') ? 'r2' : 'local');
    const url = await getFileUrl(item.filePath, st, 7200); // 2-hour signed URL for downloads

    manifest.push({
      id: item.id,
      url,
      size: item.size || 0,
      mimeType: item.mimeType || 'application/octet-stream',
      key: item.filePath,
    });
  }
  return manifest;
}

module.exports = {
  isR2Enabled,
  uploadFile,
  getFileUrl,
  deleteFile,
  fileExists,
  generateManifest,
  getTypeDir,
  R2_BUCKET,
};
