// The only bridge between the page and the shell: the offline page's retry button, and which
// server this build points at (handy for a support screen). Nothing else from Node reaches the page.
const { contextBridge, ipcRenderer } = require('electron');

const serverArg = process.argv.find((a) => a.startsWith('--chess2-server='));
/** Running the game shipped inside the app rather than the server's pages */
const bundled = process.argv.includes('--chess2-bundled');
const versionArg = process.argv.find((a) => a.startsWith('--chess2-version='));

contextBridge.exposeInMainWorld('chess2App', {
  version: versionArg ? versionArg.slice('--chess2-version='.length) : '0.1.0',
  serverUrl: serverArg ? serverArg.slice('--chess2-server='.length) : null,
  bundled,
  retry: () => ipcRenderer.send('chess2:retry'),
  /** Close the game from inside it: the menu's Quit button and the one in Settings */
  quit: () => ipcRenderer.send('chess2:quit'),
  /** Close and reopen the app: the only way back once the graphics driver has reset twice and 3D is off */
  restart: () => ipcRenderer.send('chess2:restart'),
  /** The player's save file, in the app's folder: read as the page starts, written as it changes */
  save: {
    read: () => ipcRenderer.sendSync('chess2:save:read'),
    write: (text) => ipcRenderer.send('chess2:save:write', text),
  },
  /**
   * The app's own updates: where the download stands ({ state: 'idle' | 'checking' | 'none' |
   * 'downloading' | 'ready' | 'error', version?, percent? }), word each time it changes, and the
   * "Restart now" that installs a downloaded one.
   */
  updates: {
    get: () => ipcRenderer.invoke('chess2:update:get'),
    on: (cb) => {
      const h = (_e, s) => cb(s);
      ipcRenderer.on('chess2:update', h);
      return () => ipcRenderer.removeListener('chess2:update', h);
    },
    install: () => ipcRenderer.send('chess2:update:install'),
  },
  /** Send the page a trusted F24 key press, so it can take the mouse without waiting for a click */
  activate: () => ipcRenderer.send('chess2:activate'),
  /** 'fullscreen' | 'windowed': read the current mode, or set and remember one */
  display: {
    get: () => ipcRenderer.invoke('chess2:display:get'),
    set: (mode) => ipcRenderer.send('chess2:display:set', mode),
  },
});
