/**
 * SignFlow Player — Electron Main Process
 *
 * Wraps the web player in an Electron shell with:
 * - Kiosk mode (fullscreen, no Esc exit)
 * - File system content cache (bypasses IndexedDB size limits)
 * - Auto-start on boot
 * - Auto-update via electron-updater
 * - OS-level controls (volume, brightness, power schedule)
 * - IPC bridge for renderer ↔ main communication
 */

const { app, BrowserWindow, ipcMain, screen, globalShortcut, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { autoUpdater } = require('electron-updater');
const { enableAutoStart, disableAutoStart, isAutoStartEnabled } = require('./autostart');

// ─── Configuration ──────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged;
const KIOSK_MODE = process.env.KIOSK_MODE !== 'false'; // Default: true
const CACHE_DIR = path.join(app.getPath('userData'), 'content-cache');
const CONFIG_PATH = path.join(app.getPath('userData'), 'player-config.json');

// Ensure cache directory
fs.ensureDirSync(CACHE_DIR);

let mainWindow = null;
let powerBlockerId = null;

// ─── Single Instance Lock ───────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ─── Window Creation ────────────────────────────────────────
function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    fullscreen: KIOSK_MODE,
    kiosk: KIOSK_MODE,
    autoHideMenuBar: true,
    frame: !KIOSK_MODE,
    resizable: !KIOSK_MODE,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Load the web player
  if (IS_DEV) {
    // Development: load from Vite dev server
    const devUrl = process.env.VITE_DEV_URL || 'http://localhost:5174';
    mainWindow.loadURL(devUrl);
    if (!KIOSK_MODE) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    // Production: load from built files
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Prevent window close in kiosk mode
  mainWindow.on('close', (e) => {
    if (KIOSK_MODE && !app.isQuitting) {
      e.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Block screen saver / display sleep
  powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  console.log('[Electron] Power save blocker active:', powerBlockerId);
}

// ─── App Lifecycle ──────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  // Register global shortcuts
  if (KIOSK_MODE) {
    // Block Alt+F4, Ctrl+W, etc.
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F4' && input.alt) event.preventDefault();
      if (input.key === 'w' && input.control) event.preventDefault();
      if (input.key === 'F11') event.preventDefault();
    });
  }

  // Admin escape: Ctrl+Shift+Alt+Q to exit kiosk
  globalShortcut.register('CommandOrControl+Shift+Alt+Q', () => {
    console.log('[Electron] Admin exit shortcut triggered');
    app.isQuitting = true;
    app.quit();
  });

  // Dev tools toggle: Ctrl+Shift+I
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Check for updates (production only)
  if (!IS_DEV) {
    setupAutoUpdater();
  }

  console.log('[Electron] SignFlow Player started');
  console.log(`[Electron] Kiosk: ${KIOSK_MODE}, Dev: ${IS_DEV}`);
  console.log(`[Electron] Cache dir: ${CACHE_DIR}`);
});

app.on('window-all-closed', () => {
  if (powerBlockerId !== null) {
    powerSaveBlocker.stop(powerBlockerId);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
});

// ─── IPC Handlers: File System Cache ────────────────────────
// Download and cache a file to local filesystem
ipcMain.handle('cache:download', async (event, { url, contentId, filename }) => {
  try {
    const contentDir = path.join(CACHE_DIR, contentId);
    fs.ensureDirSync(contentDir);
    const filePath = path.join(contentDir, filename);

    // Check if already cached
    if (await fs.pathExists(filePath)) {
      const stat = await fs.stat(filePath);
      console.log(`[Cache] Already cached: ${contentId}/${filename} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
      return { success: true, path: filePath, cached: true, size: stat.size };
    }

    // Download
    console.log(`[Cache] Downloading: ${url}`);
    const { net } = require('electron');
    const response = await net.fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    console.log(`[Cache] Saved: ${contentId}/${filename} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    return { success: true, path: filePath, cached: false, size: buffer.length };
  } catch (error) {
    console.error(`[Cache] Download failed:`, error.message);
    return { success: false, error: error.message };
  }
});

// Get cached file path (returns file:// URL for renderer)
ipcMain.handle('cache:getPath', async (event, { contentId, filename }) => {
  const filePath = path.join(CACHE_DIR, contentId, filename);
  if (await fs.pathExists(filePath)) {
    return `file://${filePath.replace(/\\/g, '/')}`;
  }
  return null;
});

// Check if content is cached
ipcMain.handle('cache:exists', async (event, { contentId, filename }) => {
  const filePath = path.join(CACHE_DIR, contentId, filename);
  return fs.pathExists(filePath);
});

// Get cache statistics
ipcMain.handle('cache:stats', async () => {
  try {
    let totalSize = 0;
    let fileCount = 0;
    const dirs = await fs.readdir(CACHE_DIR).catch(() => []);

    for (const dir of dirs) {
      const dirPath = path.join(CACHE_DIR, dir);
      const stat = await fs.stat(dirPath);
      if (stat.isDirectory()) {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
          const fstat = await fs.stat(path.join(dirPath, file));
          totalSize += fstat.size;
          fileCount++;
        }
      }
    }

    return { totalSize, fileCount, cacheDir: CACHE_DIR };
  } catch {
    return { totalSize: 0, fileCount: 0, cacheDir: CACHE_DIR };
  }
});

// Clear cache
ipcMain.handle('cache:clear', async () => {
  try {
    await fs.emptyDir(CACHE_DIR);
    console.log('[Cache] Cache cleared');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Remove specific content from cache
ipcMain.handle('cache:remove', async (event, { contentId }) => {
  try {
    const contentDir = path.join(CACHE_DIR, contentId);
    await fs.remove(contentDir);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── IPC Handlers: Config ───────────────────────────────────
ipcMain.handle('config:get', async () => {
  try {
    if (await fs.pathExists(CONFIG_PATH)) {
      return JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
    }
    return null;
  } catch {
    return null;
  }
});

ipcMain.handle('config:set', async (event, config) => {
  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── IPC Handlers: System Control ───────────────────────────
ipcMain.handle('system:info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    isKiosk: KIOSK_MODE,
    isDev: IS_DEV,
    cacheDir: CACHE_DIR,
    userData: app.getPath('userData'),
  };
});

ipcMain.handle('system:restart', () => {
  app.relaunch();
  app.isQuitting = true;
  app.quit();
});

ipcMain.handle('system:exitKiosk', () => {
  if (mainWindow && KIOSK_MODE) {
    mainWindow.setKiosk(false);
    mainWindow.setFullScreen(false);
  }
});

ipcMain.handle('system:enterKiosk', () => {
  if (mainWindow) {
    mainWindow.setKiosk(true);
    mainWindow.setFullScreen(true);
  }
});

// Auto-start
ipcMain.handle('system:autostart:get', () => isAutoStartEnabled());
ipcMain.handle('system:autostart:set', (event, enabled) => {
  if (enabled) enableAutoStart();
  else disableAutoStart();
  return isAutoStartEnabled();
});

// ─── Auto Updater ───────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('updater:available', info);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] App is up to date');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[Updater] Download: ${progress.percent.toFixed(1)}%`);
    if (mainWindow) {
      mainWindow.webContents.send('updater:progress', progress);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded, will install on restart');
    if (mainWindow) {
      mainWindow.webContents.send('updater:downloaded', info);
    }
    // Auto-install after 10 seconds
    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 10000);
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message);
  });

  // Check every 4 hours
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}
