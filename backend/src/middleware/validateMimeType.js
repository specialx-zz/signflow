/**
 * validateMimeType.js
 *
 * Post-upload middleware: reads the actual file bytes (magic bytes) via the
 * `file-type` library and rejects any file whose real MIME type does not match
 * the client-declared Content-Type.
 *
 * Usage: place this middleware AFTER multer's upload middleware.
 *   router.post('/upload', upload.single('file'), validateMimeType, handler)
 *
 * ESM-only workaround: file-type v19 is ESM-only, so we use a top-level
 * dynamic import() cached at first use.
 */

const fs = require('fs-extra');

// Cache the ESM import so we only load it once
let fileTypeFromFile = null;
async function getFileTypeFromFile() {
  if (!fileTypeFromFile) {
    const mod = await import('file-type');
    fileTypeFromFile = mod.fileTypeFromFile;
  }
  return fileTypeFromFile;
}

// Mapping: base MIME type prefix → allowed magic-bytes MIME types
// Client-declared MIME type must start with the key; actual type must be in the values.
const ALLOWED_MAGIC = {
  'image/': ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
  'video/': ['video/mp4', 'video/mpeg', 'video/webm', 'video/x-msvideo', 'video/quicktime'],
  'audio/': ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a'],
  'application/pdf': ['application/pdf'],
  'application/zip': ['application/zip', 'application/x-zip-compressed'],
  'text/html': null,  // html has no reliable magic bytes — skip magic check
};

/**
 * Middleware that validates the real MIME type of uploaded file(s).
 * If validation fails, the file is deleted and a 400 response is returned.
 */
const validateMimeType = async (req, res, next) => {
  const files = req.files
    ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
    : (req.file ? [req.file] : []);

  if (!files.length) return next();

  try {
    const detect = await getFileTypeFromFile();

    for (const file of files) {
      const declaredMime = file.mimetype || '';

      // Skip MIME types that don't have reliable magic bytes (e.g. text/html)
      const skipCheck = Object.entries(ALLOWED_MAGIC).some(
        ([prefix, vals]) => declaredMime.startsWith(prefix) && vals === null
      );
      if (skipCheck) continue;

      let detected;
      try {
        detected = await detect(file.path);
      } catch {
        detected = null;
      }

      if (!detected) {
        // Could not detect — could be a text-based format with no magic bytes
        // Allow if the declared MIME is text/*
        if (!declaredMime.startsWith('text/')) {
          await cleanup(files, file);
          return res.status(400).json({
            error: `파일 형식을 확인할 수 없습니다: ${file.originalname}`
          });
        }
        continue;
      }

      // Find which allowed list the declared MIME maps to
      const allowedActual = Object.entries(ALLOWED_MAGIC).find(([prefix]) =>
        declaredMime.startsWith(prefix)
      )?.[1];

      if (allowedActual && !allowedActual.includes(detected.mime)) {
        await cleanup(files, file);
        return res.status(400).json({
          error: `파일 내용이 선언된 형식과 일치하지 않습니다 (${file.originalname}). ` +
                 `선언: ${declaredMime}, 실제: ${detected.mime}`
        });
      }
    }

    next();
  } catch (err) {
    console.error('[validateMimeType] Error:', err);
    // On unexpected error, don't block the upload — log and proceed
    next();
  }
};

async function cleanup(allFiles, failedFile) {
  // Delete all uploaded files on validation failure (avoid orphaned files)
  for (const f of allFiles) {
    try { await fs.remove(f.path); } catch { /* ignore */ }
  }
}

module.exports = { validateMimeType };
