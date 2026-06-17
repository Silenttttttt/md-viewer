import { app, BrowserWindow, ipcMain, shell, dialog, Menu, MenuItemConstructorOptions, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';

let win: BrowserWindow;
const watchers = new Map<string, fs.FSWatcher>(); // filePath → watcher

// ── Persistence ───────────────────────────────────────────
const userData   = app.getPath('userData');
const recentFile = path.join(userData, 'recent.json');

function getRecent(): string[] {
  try { return JSON.parse(fs.readFileSync(recentFile, 'utf-8')); }
  catch { return []; }
}

function addRecent(fp: string): void {
  let r = getRecent().filter((p: string) => p !== fp);
  r.unshift(fp);
  try { fs.mkdirSync(userData, { recursive: true }); fs.writeFileSync(recentFile, JSON.stringify(r.slice(0, 25))); } catch {}
}

// ── File utils ────────────────────────────────────────────
function isReadableFile(fp: string): boolean {
  try { return fs.statSync(fp).isFile(); } catch { return false; }
}

function readData(fp: string): { filePath: string; dir: string; name: string; content: string } {
  return { filePath: fp, dir: path.dirname(fp), name: path.basename(fp), content: fs.readFileSync(fp, 'utf-8') };
}

function watchFile(fp: string): void {
  if (watchers.has(fp)) return;
  let debounce: ReturnType<typeof setTimeout>;
  const w = fs.watch(fp, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      try { win.webContents.send('file-changed', { filePath: fp, content: fs.readFileSync(fp, 'utf-8') }); } catch {}
    }, 150);
  });
  watchers.set(fp, w);
}

// ── Single instance lock ──────────────────────────────────
// If another instance tries to open, hand off its files and quit.
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event: Electron.Event, argv: string[]) => {
    // Focus the existing window
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    // Open any file(s) the second instance was given
    const files = argv
      .slice(2)
      .filter((a: string) => !a.startsWith('-') && !a.endsWith('.js') && !a.endsWith('.asar'))
      .map((a: string) => path.resolve(a))
      .filter(isReadableFile);
    files.forEach((fp: string) => {
      addRecent(fp);
      watchFile(fp);
      win.webContents.send('open-tab', readData(fp));
    });
  });
}

// ── Window ────────────────────────────────────────────────
const initialArgs = process.argv.slice(2).filter((a: string) => !a.startsWith('-') && !a.endsWith('.js') && !a.endsWith('.asar'));

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1340, height: 920, minWidth: 700, minHeight: 500,
    backgroundColor: '#0d1117', show: false, title: 'MDViewer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  buildMenu();
  win.loadFile('renderer.html');
  win.once('ready-to-show', () => win.show());
});

// ── IPC ───────────────────────────────────────────────────
ipcMain.handle('get-initial', () => {
  const files = initialArgs.map((a: string) => path.resolve(a)).filter(isReadableFile);
  files.forEach((fp: string) => { addRecent(fp); watchFile(fp); });
  return { files: files.map(readData), recent: getRecent() };
});

ipcMain.handle('open-files', async () => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx'] }],
    properties: ['openFile', 'multiSelections'],
  });
  const result: ReturnType<typeof readData>[] = [];
  for (const fp of (filePaths || [])) { addRecent(fp); watchFile(fp); result.push(readData(fp)); }
  return result;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcMain.handle('load-md', (_: any, fp: string) => {
  const abs = path.resolve(fp);
  if (!isReadableFile(abs)) return null;
  addRecent(abs); watchFile(abs);
  return readData(abs);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcMain.handle('save-file', (_: any, fp: string, content: string) => {
  fs.writeFileSync(fp, content, 'utf-8'); return true;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcMain.handle('save-as', async (_: any, defaultName: string, content: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName || 'untitled.md',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content, 'utf-8');
  addRecent(filePath); watchFile(filePath);
  return filePath;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcMain.handle('export-html', async (_: any, name: string, html: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: (name || 'document').replace(/\.mdx?$/, '') + '.html',
    filters: [{ name: 'HTML', extensions: ['html'] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcMain.handle('unwatch',       (_: any, fp: string) => { watchers.get(fp)?.close(); watchers.delete(fp); });
ipcMain.handle('get-recent',    ()                   => getRecent());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcMain.handle('open-external', (_: any, u: string)  => shell.openExternal(u));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcMain.handle('open-path',     (_: any, p: string)  => shell.openPath(p));

// Native file drag-out (lets user drag a tab into Thunar, file pickers, etc.)
ipcMain.on('start-drag', async (event, filePath: string) => {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    const icon = await app.getFileIcon(filePath, { size: 'normal' });
    event.sender.startDrag({ file: filePath, icon });
  } catch {
    event.sender.startDrag({ file: filePath, icon: nativeImage.createEmpty() });
  }
});

// ── Menu ──────────────────────────────────────────────────
function buildMenu(): void {
  const s = (...a: unknown[]): void => { win.webContents.send('menu', ...a); };
  const t: MenuItemConstructorOptions[] = [
    { label: 'File', submenu: [
      { label: 'New',             accelerator: 'CmdOrCtrl+N',       click: () => s('new') },
      { label: 'Open...',         accelerator: 'CmdOrCtrl+O',       click: () => s('open') },
      { type: 'separator' },
      { label: 'Save',            accelerator: 'CmdOrCtrl+S',       click: () => s('save') },
      { label: 'Save As...',      accelerator: 'CmdOrCtrl+Shift+S', click: () => s('save-as') },
      { label: 'Export as HTML',  accelerator: 'CmdOrCtrl+Shift+E', click: () => s('export-html') },
      { type: 'separator' },
      { label: 'Close Tab',       accelerator: 'CmdOrCtrl+W',       click: () => s('close-tab') },
      { type: 'separator' },
      { role: 'quit' },
    ]},
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ]},
    { label: 'View', submenu: [
      { label: 'Preview',        accelerator: 'CmdOrCtrl+1',        click: () => s('mode', 'preview') },
      { label: 'Edit',           accelerator: 'CmdOrCtrl+2',        click: () => s('mode', 'edit') },
      { label: 'Split',          accelerator: 'CmdOrCtrl+3',        click: () => s('mode', 'split') },
      { type: 'separator' },
      { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\',       click: () => s('toggle-toc') },
      { label: 'Toggle Width',   accelerator: 'CmdOrCtrl+Shift+W',  click: () => s('toggle-width') },
      { label: 'Toggle Theme',   accelerator: 'CmdOrCtrl+Shift+T',  click: () => s('theme') },
      { type: 'separator' },
      { label: 'Zoom In',        accelerator: 'CmdOrCtrl+=',        click: () => s('zoom', 1) },
      { label: 'Zoom Out',       accelerator: 'CmdOrCtrl+-',        click: () => s('zoom', -1) },
      { label: 'Reset Zoom',     accelerator: 'CmdOrCtrl+0',        click: () => s('zoom', 0) },
      { type: 'separator' },
      { role: 'toggleDevTools' },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

app.on('window-all-closed', () => app.quit());
