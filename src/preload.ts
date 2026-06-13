import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Local inline type matching MDViewerAPI from types.ts
// (types.ts is included via tsconfig for the renderer; preload compiles separately)
type ExposedAPI = {
  getInitial:   ()                              => Promise<{ files: unknown[]; recent: string[] }>;
  openFiles:    ()                              => Promise<unknown[]>;
  loadMd:       (fp: string)                   => Promise<unknown>;
  saveFile:     (fp: string, c: string)        => Promise<boolean>;
  saveAs:       (n: string, c: string)         => Promise<string | null>;
  exportHtml:   (n: string, h: string)         => Promise<string | null>;
  unwatch:      (fp: string)                   => Promise<void>;
  getRecent:    ()                              => Promise<string[]>;
  openExternal: (u: string)                    => Promise<void>;
  openPath:     (p: string)                    => Promise<void>;

  onFileChanged: (cb: (data: { filePath: string; content: string }) => void) => void;
  onMenu:        (cb: (action: string, ...args: unknown[]) => void)           => void;
};

const api: ExposedAPI = {
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

  onFileChanged: (cb) => ipcRenderer.on('file-changed', (_: IpcRendererEvent, d: { filePath: string; content: string }) => cb(d)),
  onMenu:        (cb) => ipcRenderer.on('menu', (_: IpcRendererEvent, ...a: unknown[]) => cb(a[0] as string, ...a.slice(1))),
};

contextBridge.exposeInMainWorld('api', api);
