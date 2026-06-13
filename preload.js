const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getInitial:   ()        => ipcRenderer.invoke('get-initial'),
  openFiles:    ()        => ipcRenderer.invoke('open-files'),
  loadMd:       (fp)      => ipcRenderer.invoke('load-md', fp),
  saveFile:     (fp, c)   => ipcRenderer.invoke('save-file', fp, c),
  saveAs:       (n, c)    => ipcRenderer.invoke('save-as', n, c),
  exportHtml:   (n, h)    => ipcRenderer.invoke('export-html', n, h),
  unwatch:      (fp)      => ipcRenderer.invoke('unwatch', fp),
  getRecent:    ()        => ipcRenderer.invoke('get-recent'),
  openExternal: (u)       => ipcRenderer.invoke('open-external', u),
  openPath:     (p)       => ipcRenderer.invoke('open-path', p),

  onFileChanged: (cb) => ipcRenderer.on('file-changed', (_, d) => cb(d)),
  onMenu:        (cb) => ipcRenderer.on('menu', (_, ...a) => cb(...a)),
});
