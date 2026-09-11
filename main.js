// Chess 2 desktop shell: one window that loads the hosted game. The game itself (React, the 3D
// table, the duels, the music) is served by the server, so updating the server updates every
// player; this app only needs a new build when the shell itself changes.
//
// Which server, in order: `--server <url>` on the command line; %APPDATA%\Chess 2\server.json
// ({ "serverUrl": "..." }) for a player's own override; server.json published in the public
// Chess-2-Installer repo (fetched at every launch, cached for offline starts), so the address can
// change without a new installer; and finally app-config.json next to this file.
const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');

const packaged = app.isPackaged;
const DEFAULT_CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-config.json'), 'utf8'));
const PUBLISHED_CONFIG = 'https://raw.githubusercontent.com/dominicfury/Chess-2-Installer/main/server.json';

const clean = (u) => String(u).trim().replace(/\/+$/, '');
const valid = (u) => typeof u === 'string' && /^https?:\/\//.test(u.trim());
const cacheFile = () => path.join(app.getPath('userData'), 'published-server.json');

/** The published address, fetched fresh when possible, else the last one seen. */
async function publishedServerUrl() {
  try {
    const res = await fetch(PUBLISHED_CONFIG, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (res.ok) {
      const body = await res.json();
      if (valid(body.serverUrl)) {
        try {
          fs.mkdirSync(app.getPath('userData'), { recursive: true });
          fs.writeFileSync(cacheFile(), JSON.stringify({ serverUrl: clean(body.serverUrl) }));
        } catch {
          /* not cached this time */
        }
        return clean(body.serverUrl);
      }
    }
  } catch {
    /* offline or GitHub unreachable */
  }
  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
    if (valid(cached.serverUrl)) return clean(cached.serverUrl);
  } catch {
    /* nothing cached */
  }
  return null;
}

async function serverUrl() {
  const flag = process.argv.findIndex((a) => a === '--server');
  if (flag >= 0 && valid(process.argv[flag + 1])) return clean(process.argv[flag + 1]);
  try {
    const override = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'server.json'), 'utf8'));
    if (valid(override.serverUrl)) return clean(override.serverUrl);
  } catch {
    /* no override file */
  }
  return (await publishedServerUrl()) ?? clean(DEFAULT_CONFIG.serverUrl);
}

let win = null;

// Fullscreen or windowed, chosen in the game's Settings and remembered between launches.
const displayFile = () => path.join(app.getPath('userData'), 'display.json');
function displayMode() {
  try {
    const saved = JSON.parse(fs.readFileSync(displayFile(), 'utf8'));
    if (saved.mode === 'fullscreen' || saved.mode === 'windowed') return saved.mode;
  } catch {
    /* first run */
  }
  return 'windowed';
}
function setDisplayMode(mode) {
  if (mode !== 'fullscreen' && mode !== 'windowed') return;
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(displayFile(), JSON.stringify({ mode }));
  } catch {
    /* not persisted this time */
  }
  if (win) win.setFullScreen(mode === 'fullscreen');
}

async function createWindow() {
  const url = await serverUrl();
  const origin = new URL(url).origin;
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    fullscreen: displayMode() === 'fullscreen',
    autoHideMenuBar: true,
    backgroundColor: '#202d58',
    title: 'Chess 2',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // the menu music and the duel sounds may start without a click
      autoplayPolicy: 'no-user-gesture-required',
      additionalArguments: [`--chess2-server=${url}`],
    },
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());

  // Pointer lock (duel aiming) and fullscreen are what the game asks for; nothing else is granted.
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const ours = (details.requestingUrl ?? contents.getURL()).startsWith(origin);
    callback(ours && (permission === 'pointerLock' || permission === 'fullscreen'));
  });

  // Links to other sites open in the player's browser; the game's own pages stay in this window.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith(origin)) win.loadURL(target);
    else shell.openExternal(target);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, target) => {
    if (!target.startsWith(origin) && !target.startsWith('file:')) {
      e.preventDefault();
      shell.openExternal(target);
    }
  });

  // When the server cannot be reached, show the offline page with a retry button.
  win.webContents.on('did-fail-load', (_e, code, description, failedUrl, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3: a navigation was aborted by another one
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { server: url, reason: `${description} (${code})` } });
  });

  // F11 toggles fullscreen; Esc leaves it. Ctrl+Shift+I opens the tools while developing.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      setDisplayMode(win.isFullScreen() ? 'windowed' : 'fullscreen');
      e.preventDefault();
    } else if (input.key === 'Escape' && win.isFullScreen() && !win.webContents.isDevToolsOpened()) {
      /* the game uses Esc to release the mouse; leave fullscreen only from the shell shortcut */
    } else if (!packaged && input.control && input.shift && input.key.toUpperCase() === 'I') {
      win.webContents.toggleDevTools();
    }
  });

  win.loadURL(url);
  win.on('closed', () => {
    win = null;
  });
}

ipcMain.on('chess2:retry', async () => {
  const url = await serverUrl();
  if (win) win.loadURL(url);
});
ipcMain.handle('chess2:display:get', () => (win && win.isFullScreen() ? 'fullscreen' : 'windowed'));
ipcMain.on('chess2:display:set', (_e, mode) => setDisplayMode(mode));

/**
 * The window itself updates from its GitHub releases, and only when the shell changes: the game
 * inside it is served fresh by the server, so almost every release needs no new installer at all.
 * Downloads in the background and installs when the player quits.
 */
function checkForShellUpdates() {
  if (!packaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('error', () => {
    /* no releases yet, or no network: the app carries on unchanged */
  });
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

app.whenReady().then(() => {
  createWindow();
  checkForShellUpdates();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
