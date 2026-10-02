// Chess 2 — Copyright (c) 2026 Dominic Chase. All rights reserved.
// Proprietary; no license granted. This repository is public but is not open source. See LICENSE.
//
// Chess 2 desktop shell: one window around the game. Two ways to run:
//
//  - Bundled (a `game/` folder ships beside this file -- the Steam build): the game runs from the
//    app's own files under app://chess2/, single-player needs no network at all, and only what is
//    online (ranked, friend rooms, the leaderboard) goes to the server: app://chess2/api/* is
//    forwarded there, and the game opens its WebSocket to it directly.
//  - Hosted (no `game/`, or `--remote`): the window loads the game the server serves, so updating
//    the server updates every player; this app only needs a new build when the shell changes.
//
// Which server, in order: `--server <url>` on the command line; %APPDATA%\Chess 2\server.json
// ({ "serverUrl": "..." }) for a player's own override; server.json published in the public
// Chess-2-Installer repo (fetched at every launch, cached for offline starts), so the address can
// change without a new installer; and finally app-config.json next to this file.
const { app, BrowserWindow, ipcMain, net, protocol, shell, session } = require('electron');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');

const packaged = app.isPackaged;

// The app is "Chess 2: Brainrot Edition", but its data stays in %APPDATA%\Chess 2 -- where every version
// before the rename kept it, and a name Windows allows as a folder.
// `--data-dir=<path>`: keep this run's save, settings and caches somewhere else (testing, a second profile)
{
  const arg = process.argv.find((a) => a.startsWith('--data-dir='));
  app.setPath('userData', arg ? path.resolve(arg.slice('--data-dir='.length)) : path.join(app.getPath('appData'), 'Chess 2'));
}
// the taskbar groups the window with its pinned and Start-menu shortcuts by this id (the installer's appId)
if (process.platform === 'win32') app.setAppUserModelId('com.chess2.game');

/** The game shipped inside the app, when it is (see the bundle script in the chess2 workspace). */
const GAME_DIR = path.join(__dirname, 'game');
const bundled = fs.existsSync(path.join(GAME_DIR, 'index.html')) && !process.argv.includes('--remote');
const BUNDLED_ORIGIN = 'app://chess2';
if (bundled) {
  // a real origin for the bundled game: fetch, storage, audio streaming and pointer lock all work as on the web
  protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
}

/**
 * app://chess2/ for the bundled game. A file that exists is served from `game/`; a path with no file
 * extension is one of the game's own routes (/solo, /r/ABCD) and gets index.html; /api/* goes to the
 * server, so the game's online calls work unchanged.
 */
function serveBundledGame(server) {
  protocol.handle('app', async (req) => {
    const u = new URL(req.url);
    if (u.pathname.startsWith('/api/')) {
      try {
        return await net.fetch(server + u.pathname + u.search, { method: req.method, headers: req.headers, body: req.body, duplex: 'half' });
      } catch {
        return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'content-type': 'application/json' } });
      }
    }
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(GAME_DIR, rel));
    // nothing outside the game folder, whatever the path says
    if (!file.startsWith(GAME_DIR)) return new Response('Not found', { status: 404 });
    if (rel && fs.existsSync(file) && fs.statSync(file).isFile()) return net.fetch(pathToFileURL(file).toString(), { headers: req.headers });
    if (!path.extname(rel)) return net.fetch(pathToFileURL(path.join(GAME_DIR, 'index.html')).toString());
    return new Response('Not found', { status: 404 });
  });
}
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
  const server = await serverUrl();
  if (bundled) serveBundledGame(server);
  // the window's page: the bundled game, or the server's
  const url = bundled ? `${BUNDLED_ORIGIN}/` : server;
  const origin = bundled ? BUNDLED_ORIGIN : new URL(server).origin;
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    fullscreen: displayMode() === 'fullscreen',
    autoHideMenuBar: true,
    backgroundColor: '#202d58',
    title: 'Chess 2: Brainrot Edition',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // the menu music and the duel sounds may start without a click
      autoplayPolicy: 'no-user-gesture-required',
      additionalArguments: [`--chess2-server=${server}`, `--chess2-version=${app.getVersion()}`, ...(bundled ? ['--chess2-bundled'] : [])],
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

  /*
   * The page's own process can die: out of memory, a crash in the renderer. Nothing inside the page
   * survives to say so, and what was left was this window's bare background, a plain blue screen
   * with nothing to click. Note why, then put the game back: reload straight away the first time,
   * and if it dies again within a minute show the offline page (which keeps retrying) instead of
   * looping on a crash.
   */
  let lastRendererCrash = 0;
  win.webContents.on('render-process-gone', (_e, details) => {
    logIncident(`renderer gone: ${details.reason} (exit ${details.exitCode})`);
    if (details.reason === 'clean-exit' || !win) return;
    const again = Date.now() - lastRendererCrash < 60_000;
    lastRendererCrash = Date.now();
    if (!again) win.loadURL(url);
    else win.loadFile(path.join(__dirname, 'offline.html'), { query: { server: url, title: 'The game stopped unexpectedly.', reason: details.reason } });
  });
  win.webContents.on('unresponsive', () => logIncident('renderer unresponsive'));

  win.loadURL(url);
  win.on('closed', () => {
    win = null;
  });
}

/** One line per incident in %APPDATA%\Chess 2\incidents.log, for when a player reports something. */
function logIncident(text) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.appendFileSync(path.join(app.getPath('userData'), 'incidents.log'), `${new Date().toISOString()} ${text}\n`);
  } catch {
    /* nowhere to write: nothing else to do */
  }
}

// A GPU process that dies takes 3D with it; the page recovers or explains, but the log says why.
app.on('child-process-gone', (_e, details) => {
  logIncident(`${details.type} process gone: ${details.reason} (exit ${details.exitCode})`);
});

ipcMain.on('chess2:retry', async () => {
  const url = bundled ? `${BUNDLED_ORIGIN}/` : await serverUrl();
  if (win) win.loadURL(url);
});
/** The in-game Quit button. Closing the window is what quits, and that path already installs
 * any update waiting in the background, so this takes it rather than calling app.quit() flat. */
ipcMain.on('chess2:quit', () => {
  if (win) win.close();
  else app.quit();
});
/** Relaunch: after two graphics driver resets the browser keeps 3D off until the app restarts. */
ipcMain.on('chess2:restart', () => {
  app.relaunch();
  app.exit(0);
});
/**
 * A trusted key press for the page. Browsers only lock the pointer during a user gesture, so a duel
 * or the casino could not take the mouse on arrival; the page asks for this, sees F24 go by (which
 * nothing in the game uses) and locks the pointer from inside that key's handler.
 */
ipcMain.on('chess2:activate', (e) => {
  e.sender.sendInputEvent({ type: 'keyDown', keyCode: 'F24' });
  e.sender.sendInputEvent({ type: 'keyUp', keyCode: 'F24' });
});
/**
 * The player's save: one signed document the game keeps here, in the app's own folder, rather than in
 * the page's storage -- where Steam Cloud can sync it, and where it survives the page's cache being
 * cleared. The page signs and checks it; this only keeps it safe on disk. Each write replaces the file
 * atomically and keeps the copy it replaced as a backup.
 */
const savePath = () => path.join(app.getPath('userData'), 'save.json');
const backupPath = () => path.join(app.getPath('userData'), 'save.bak.json');
ipcMain.on('chess2:save:read', (e) => {
  const read = (p) => {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch {
      return null;
    }
  };
  e.returnValue = { current: read(savePath()), backup: read(backupPath()) };
});
ipcMain.on('chess2:save:write', (_e, text) => {
  if (typeof text !== 'string' || text.length > 5_000_000) return;
  try {
    const file = savePath();
    if (fs.existsSync(file)) fs.copyFileSync(file, backupPath());
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error('[save] could not write the save', err);
  }
});
ipcMain.handle('chess2:display:get', () => (win && win.isFullScreen() ? 'fullscreen' : 'windowed'));
ipcMain.on('chess2:display:set', (_e, mode) => setDisplayMode(mode));

/**
 * The app updates itself from its GitHub releases: the game ships inside it, so every change to the
 * game is a new release. It downloads in the background as soon as one is out, and installs when the
 * player quits -- or straight away, from the game's "Restart now". The game is told how it is going
 * (chess2:update), so it can show the download and keep the player out of online play until they have
 * restarted onto the new version.
 */
let updateState = { state: 'idle' };
function tellUpdate(next) {
  updateState = { ...updateState, ...next };
  if (win && !win.isDestroyed()) win.webContents.send('chess2:update', updateState);
}
function checkForShellUpdates() {
  if (!packaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('checking-for-update', () => {
    if (updateState.state !== 'downloading' && updateState.state !== 'ready') tellUpdate({ state: 'checking' });
  });
  autoUpdater.on('update-not-available', () => tellUpdate({ state: 'none' }));
  autoUpdater.on('update-available', (info) => tellUpdate({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => tellUpdate({ state: 'downloading', percent: Math.floor(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => tellUpdate({ state: 'ready', version: info.version }));
  autoUpdater.on('error', () => {
    // no network, or GitHub unreachable: the app carries on as it is, and says so only if a download broke
    tellUpdate({ state: updateState.state === 'downloading' ? 'error' : 'none' });
  });
  const check = () => {
    if (updateState.state === 'downloading' || updateState.state === 'ready') return;
    autoUpdater.checkForUpdates().catch(() => {});
  };
  check();
  // a game left open still hears about a release
  setInterval(check, 30 * 60_000);
}
ipcMain.handle('chess2:update:get', () => updateState);
ipcMain.on('chess2:update:install', () => {
  // install now and open the new version straight after
  if (updateState.state === 'ready') autoUpdater.quitAndInstall(true, true);
});

app.whenReady().then(() => {
  createWindow();
  checkForShellUpdates();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
