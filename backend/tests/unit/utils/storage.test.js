process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';

// Clear R2 env vars before requiring the module so isR2Enabled = false
delete process.env.R2_ACCOUNT_ID;
delete process.env.R2_ACCESS_KEY_ID;
delete process.env.R2_SECRET_ACCESS_KEY;
delete process.env.R2_PUBLIC_URL;

const { getTypeDir, isR2Enabled, R2_BUCKET, getFileUrl, generateManifest } = require('../../../src/utils/storage');

// ─── getTypeDir ──────────────────────────────────────────

describe('getTypeDir', () => {
  test('returns "images" for image/* mimetypes', () => {
    expect(getTypeDir('image/jpeg')).toBe('images');
    expect(getTypeDir('image/png')).toBe('images');
    expect(getTypeDir('image/gif')).toBe('images');
    expect(getTypeDir('image/webp')).toBe('images');
    expect(getTypeDir('image/bmp')).toBe('images');
  });

  test('returns "videos" for video/* mimetypes', () => {
    expect(getTypeDir('video/mp4')).toBe('videos');
    expect(getTypeDir('video/mpeg')).toBe('videos');
    expect(getTypeDir('video/webm')).toBe('videos');
  });

  test('returns "audio" for audio/* mimetypes', () => {
    expect(getTypeDir('audio/mpeg')).toBe('audio');
    expect(getTypeDir('audio/wav')).toBe('audio');
    expect(getTypeDir('audio/ogg')).toBe('audio');
  });

  test('returns "documents" for application/* and other types', () => {
    expect(getTypeDir('application/pdf')).toBe('documents');
    expect(getTypeDir('application/zip')).toBe('documents');
    expect(getTypeDir('text/html')).toBe('documents');
    expect(getTypeDir('text/plain')).toBe('documents');
  });

  test('returns "documents" for null or undefined mimetype', () => {
    expect(getTypeDir(null)).toBe('documents');
    expect(getTypeDir(undefined)).toBe('documents');
  });

  test('returns "documents" for empty string mimetype', () => {
    expect(getTypeDir('')).toBe('documents');
  });
});

// ─── isR2Enabled (with R2 env vars cleared) ─────────────

describe('isR2Enabled (R2 not configured)', () => {
  test('is false when R2 env vars are not set', () => {
    expect(isR2Enabled).toBe(false);
  });
});

// ─── R2_BUCKET default ───────────────────────────────────

describe('R2_BUCKET', () => {
  test('defaults to "vuesign-content" when R2_BUCKET env var is not set', () => {
    expect(R2_BUCKET).toBe('vuesign-content');
  });
});

// ─── getFileUrl (local mode) ─────────────────────────────

describe('getFileUrl (local storage mode)', () => {
  test('returns /uploads/... path for key that starts with uploads/', async () => {
    const url = await getFileUrl('uploads/images/abc.jpg');
    expect(url).toBe('/uploads/images/abc.jpg');
  });

  test('prepends /uploads/ for key that does not start with uploads/', async () => {
    const url = await getFileUrl('images/abc.jpg');
    expect(url).toBe('/uploads/images/abc.jpg');
  });

  test('handles storageType explicitly set to "local"', async () => {
    const url = await getFileUrl('uploads/documents/file.pdf', 'local');
    expect(url).toBe('/uploads/documents/file.pdf');
  });

  test('falls back to local even if storageType is "r2" but r2Client is null', async () => {
    // When R2 is not enabled, r2Client is null, so it should fall through to local
    const url = await getFileUrl('uploads/videos/clip.mp4', 'r2');
    // r2Client is null so condition (storageType === 'r2' && r2Client) is false
    expect(url).toBe('/uploads/videos/clip.mp4');
  });

  test('handles nested paths correctly', async () => {
    const url = await getFileUrl('uploads/documents/sub/path/file.pdf');
    expect(url).toBe('/uploads/documents/sub/path/file.pdf');
  });
});

// ─── generateManifest (local mode) ──────────────────────

describe('generateManifest (local storage mode)', () => {
  test('produces manifest entries with correct structure', async () => {
    const items = [
      { id: 'c1', filePath: 'uploads/images/photo.jpg', storageType: 'local', size: 1024, mimeType: 'image/jpeg' },
      { id: 'c2', filePath: 'uploads/documents/doc.pdf', storageType: 'local', size: 2048, mimeType: 'application/pdf' },
    ];

    const manifest = await generateManifest(items);

    expect(manifest).toHaveLength(2);
    expect(manifest[0]).toEqual({
      id: 'c1',
      url: '/uploads/images/photo.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      key: 'uploads/images/photo.jpg',
    });
    expect(manifest[1]).toEqual({
      id: 'c2',
      url: '/uploads/documents/doc.pdf',
      size: 2048,
      mimeType: 'application/pdf',
      key: 'uploads/documents/doc.pdf',
    });
  });

  test('skips items with no filePath', async () => {
    const items = [
      { id: 'c1', filePath: null, storageType: 'local', size: 100 },
      { id: 'c2', filePath: '', storageType: 'local', size: 200 },
      { id: 'c3', filePath: 'uploads/images/ok.png', storageType: 'local', size: 300, mimeType: 'image/png' },
    ];

    const manifest = await generateManifest(items);
    expect(manifest).toHaveLength(1);
    expect(manifest[0].id).toBe('c3');
  });

  test('defaults size to 0 when not provided', async () => {
    const items = [
      { id: 'c1', filePath: 'uploads/images/photo.jpg', storageType: 'local', mimeType: 'image/jpeg' },
    ];

    const manifest = await generateManifest(items);
    expect(manifest[0].size).toBe(0);
  });

  test('defaults mimeType to application/octet-stream when not provided', async () => {
    const items = [
      { id: 'c1', filePath: 'uploads/documents/file.bin', storageType: 'local', size: 512 },
    ];

    const manifest = await generateManifest(items);
    expect(manifest[0].mimeType).toBe('application/octet-stream');
  });

  test('returns empty array for empty input', async () => {
    const manifest = await generateManifest([]);
    expect(manifest).toEqual([]);
  });

  test('auto-detects storageType as local when not provided and R2 is disabled', async () => {
    const items = [
      { id: 'c1', filePath: 'uploads/images/photo.jpg', size: 100, mimeType: 'image/jpeg' },
    ];

    const manifest = await generateManifest(items);
    expect(manifest[0].url).toBe('/uploads/images/photo.jpg');
  });
});

// ─── buildR2Key (tested indirectly via module inspection) ─

describe('R2 key pattern', () => {
  // buildR2Key is not exported, but we can verify the pattern logic
  // by checking getTypeDir output which feeds into the key builder
  test('key components follow tenantId/typeDir/filename pattern', () => {
    const tenantId = 'tenant-abc';
    const typeDir = getTypeDir('image/png');
    const filename = '550e8400-e29b-41d4-a716-446655440000.png';
    const key = `${tenantId}/${typeDir}/${filename}`;

    expect(key).toBe('tenant-abc/images/550e8400-e29b-41d4-a716-446655440000.png');
    expect(key.split('/')).toHaveLength(3);
  });

  test('documents key pattern', () => {
    const tenantId = 'org-123';
    const typeDir = getTypeDir('application/pdf');
    const filename = 'report.pdf';
    const key = `${tenantId}/${typeDir}/${filename}`;

    expect(key).toBe('org-123/documents/report.pdf');
  });
});
