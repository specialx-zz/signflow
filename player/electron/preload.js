/**
 * VueSign Player — Electron Preload Script
 *
 * Exposes safe IPC bridges to the renderer process via contextBridge.
 * The renderer (web player) can check `window.electronAPI` to detect
 * if running inside Electron and use enhanced capabilities.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ─── Platform Detection ────────────────────────────────
  isElectron: true,
  platform: process.platform,

  // ─── File System Cache ─────────────────────────────────
  cache: {
    /**
     * Download a file from URL and cache it locally.
     * @returns {{ success, path, cached, size } | { success: false, error }}
     */
    download: (url, contentId, filename) =>
      ipcRenderer.invoke('cache:download', { url, contentId, filename }),

    /**
     * Get file:// URL for a cached content file.
     * @returns {string|null}
     */
    getPath: (contentId, filename) =>
      ipcRenderer.invoke('cache:getPath', { contentId, filename }),

    /**
     * Check if a content file is cached.
     * @returns {boolean}
     */
    exists: (contentId, filename) =>
      ipcRenderer.invoke('cache:exists', { contentId, filename }),

    /**
     * Get cache statistics.
     * @returns {{ totalSize, fileCount, cacheDir }}
     */
    stats: () => ipcRenderer.invoke('cache:stats'),

    /**
     * Clear entire cache.
     */
    clear: () => ipcRenderer.invoke('cache:clear'),

    /**
     * Remove a specific content from cache.
     */
    remove: (contentId) =>
      ipcRenderer.invoke('cache:remove', { contentId }),
  },

  // ─── Config Persistence ────────────────────────────────
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config) => ipcRenderer.invoke('config:set', config),
  },

  // ─── System Control ────────────────────────────────────
  system: {
    info: () => ipcRenderer.invoke('system:info'),
    restart: () => ipcRenderer.invoke('system:restart'),
    exitKiosk: () => ipcRenderer.invoke('system:exitKiosk'),
    enterKiosk: () => ipcRenderer.invoke('system:enterKiosk'),
    autostart: {
      get: () => ipcRenderer.invoke('system:autostart:get'),
      set: (enabled) => ipcRenderer.invoke('system:autostart:set', enabled),
    },
  },

  // ─── Auto Updater Events ──────────────────────────────
  updater: {
    onAvailable: (callback) =>
      ipcRenderer.on('updater:available', (_event, info) => callback(info)),
    onProgress: (callback) =>
      ipcRenderer.on('updater:progress', (_event, progress) => callback(progress)),
    onDownloaded: (callback) =>
      ipcRenderer.on('updater:downloaded', (_event, info) => callback(info)),
  },
});

console.log('[Preload] electronAPI exposed to renderer');
