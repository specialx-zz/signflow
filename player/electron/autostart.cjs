/**
 * autostart.js
 * Platform-specific auto-start on boot configuration.
 *
 * Windows: Registry entry in HKCU\Software\Microsoft\Windows\CurrentVersion\Run
 * Linux: .desktop file in ~/.config/autostart/
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs-extra');

const APP_NAME = 'SignFlowPlayer';

/**
 * Enable auto-start on boot
 */
function enableAutoStart() {
  if (process.platform === 'win32') {
    // Windows: use app.setLoginItemSettings
    app.setLoginItemSettings({
      openAtLogin: true,
      name: APP_NAME,
      args: ['--autostart'],
    });
    console.log('[AutoStart] Enabled (Windows login item)');
  } else if (process.platform === 'linux') {
    // Linux: create .desktop file
    const desktopEntry = `[Desktop Entry]
Type=Application
Name=SignFlow Player
Exec=${process.execPath} --autostart
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Comment=SignFlow Digital Signage Player
`;
    const autostartDir = path.join(app.getPath('home'), '.config', 'autostart');
    fs.ensureDirSync(autostartDir);
    fs.writeFileSync(path.join(autostartDir, 'signflow-player.desktop'), desktopEntry);
    console.log('[AutoStart] Enabled (Linux .desktop)');
  }
}

/**
 * Disable auto-start on boot
 */
function disableAutoStart() {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: false,
      name: APP_NAME,
    });
    console.log('[AutoStart] Disabled (Windows)');
  } else if (process.platform === 'linux') {
    const desktopFile = path.join(app.getPath('home'), '.config', 'autostart', 'signflow-player.desktop');
    fs.removeSync(desktopFile);
    console.log('[AutoStart] Disabled (Linux)');
  }
}

/**
 * Check if auto-start is enabled
 */
function isAutoStartEnabled() {
  if (process.platform === 'win32') {
    const settings = app.getLoginItemSettings({ name: APP_NAME });
    return settings.openAtLogin;
  } else if (process.platform === 'linux') {
    const desktopFile = path.join(app.getPath('home'), '.config', 'autostart', 'signflow-player.desktop');
    return fs.pathExistsSync(desktopFile);
  }
  return false;
}

module.exports = { enableAutoStart, disableAutoStart, isAutoStartEnabled };
