process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';

const { getUploadDir } = require('../../../src/middleware/upload');

// ─── getUploadDir ────────────────────────────────────────

describe('getUploadDir', () => {
  describe('image mimetypes', () => {
    test('returns "images" for image/jpeg', () => {
      expect(getUploadDir('image/jpeg')).toBe('images');
    });

    test('returns "images" for image/png', () => {
      expect(getUploadDir('image/png')).toBe('images');
    });

    test('returns "images" for image/gif', () => {
      expect(getUploadDir('image/gif')).toBe('images');
    });

    test('returns "images" for image/webp', () => {
      expect(getUploadDir('image/webp')).toBe('images');
    });

    test('returns "images" for image/bmp', () => {
      expect(getUploadDir('image/bmp')).toBe('images');
    });
  });

  describe('video mimetypes', () => {
    test('returns "videos" for video/mp4', () => {
      expect(getUploadDir('video/mp4')).toBe('videos');
    });

    test('returns "videos" for video/mpeg', () => {
      expect(getUploadDir('video/mpeg')).toBe('videos');
    });

    test('returns "videos" for video/webm', () => {
      expect(getUploadDir('video/webm')).toBe('videos');
    });
  });

  describe('audio mimetypes', () => {
    test('returns "audio" for audio/mpeg', () => {
      expect(getUploadDir('audio/mpeg')).toBe('audio');
    });

    test('returns "audio" for audio/wav', () => {
      expect(getUploadDir('audio/wav')).toBe('audio');
    });

    test('returns "audio" for audio/ogg', () => {
      expect(getUploadDir('audio/ogg')).toBe('audio');
    });
  });

  describe('document and fallback mimetypes', () => {
    test('returns "documents" for application/pdf', () => {
      expect(getUploadDir('application/pdf')).toBe('documents');
    });

    test('returns "documents" for text/html', () => {
      expect(getUploadDir('text/html')).toBe('documents');
    });

    test('returns "documents" for application/zip', () => {
      expect(getUploadDir('application/zip')).toBe('documents');
    });

    test('returns "documents" for unknown mimetypes', () => {
      expect(getUploadDir('application/octet-stream')).toBe('documents');
      expect(getUploadDir('font/woff2')).toBe('documents');
    });
  });
});

// ─── fileFilter (tested via callback simulation) ─────────

describe('fileFilter (via multer upload config)', () => {
  // The fileFilter function is not exported directly, but the upload
  // middleware is configured with it. We can test the allowed types
  // list by verifying the upload config rejects disallowed types.
  // Since fileFilter uses a callback pattern and is embedded in multer,
  // we test it indirectly by verifying the allowed type list is consistent
  // with getUploadDir categories.

  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'video/mp4', 'video/mpeg', 'video/avi', 'video/webm', 'video/mov',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
    'application/pdf', 'text/html', 'application/zip',
  ];

  test('all allowed image types map to "images" directory', () => {
    const imageTypes = allowedTypes.filter(t => t.startsWith('image/'));
    for (const type of imageTypes) {
      expect(getUploadDir(type)).toBe('images');
    }
  });

  test('all allowed video types map to "videos" directory', () => {
    const videoTypes = allowedTypes.filter(t => t.startsWith('video/'));
    for (const type of videoTypes) {
      expect(getUploadDir(type)).toBe('videos');
    }
  });

  test('all allowed audio types map to "audio" directory', () => {
    const audioTypes = allowedTypes.filter(t => t.startsWith('audio/'));
    for (const type of audioTypes) {
      expect(getUploadDir(type)).toBe('audio');
    }
  });

  test('all remaining allowed types map to "documents" directory', () => {
    const docTypes = allowedTypes.filter(t =>
      !t.startsWith('image/') && !t.startsWith('video/') && !t.startsWith('audio/')
    );
    for (const type of docTypes) {
      expect(getUploadDir(type)).toBe('documents');
    }
  });
});
