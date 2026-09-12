// The only bridge between the page and the shell: the offline page's retry button, and which
// server this build points at (handy for a support screen). Nothing else from Node reaches the page.
const { contextBridge, ipcRenderer } = require('electron');

const serverArg = process.argv.find((a) => a.startsWith('--chess2-server='));

contextBridge.exposeInMainWorld('chess2App', {
  version: '0.1.0',
  serverUrl: serverArg ? serverArg.slice('--chess2-server='.length) : null,
  retry: () => ipcRenderer.send('chess2:retry'),
  /** Close the game from inside it: the menu's Quit button and the one in Settings */
  quit: () => ipcRenderer.send('chess2:quit'),
  /** 'fullscreen' | 'windowed': read the current mode, or set and remember one */
  display: {
    get: () => ipcRenderer.invoke('chess2:display:get'),
    set: (mode) => ipcRenderer.send('chess2:display:set', mode),
  },
});
