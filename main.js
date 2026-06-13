const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs   = require('fs');

let win;
const watchers = new Map(); // filePath → watcher

// ── Persistence ───────────────────────────────────────────
const userData   = app.getPath('userData');
const recentFile = path.join(userData, 'recent.json');

function getRecent() {
  try { return JSON.parse(fs.readFileSync(recentFile, 'utf-8')); }
  catch { return []; }
}
function addRecent(fp) {
  let r = getRecent().filter(p => p !== fp);
  r.unshift(fp);
  try { fs.mkdirSync(userData, { recursive: true }); fs.writeFileSync(recentFile, JSON.stringify(r.slice(0, 25))); } catch {}
}

// ── File utils ────────────────────────────────────────────
function readData(fp) {
  return { filePath: fp, dir: path.dirname(fp), name: path.basename(fp), content: fs.readFileSync(fp, 'utf-8') };
}

function watchFile(fp) {
  if (watchers.has(fp)) return;
  let debounce;
  const w = fs.watch(fp, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      try { win.webContents.send('file-changed', { filePath: fp, content: fs.readFileSync(fp, 'utf-8') }); } catch {}
    }, 150);
  });
  watchers.set(fp, w);
}

// ── Window ────────────────────────────────────────────────
const initialArgs = process.argv.slice(2).filter(a => !a.startsWith('-') && !a.endsWith('.js') && !a.endsWith('.asar'));

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
  const files = initialArgs.filter(a => fs.existsSync(a)).map(a => path.resolve(a));
  files.forEach(fp => { addRecent(fp); watchFile(fp); });
  return { files: files.map(readData), recent: getRecent() };
});

ipcMain.handle('open-files', async () => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx'] }],
    properties: ['openFile', 'multiSelections'],
  });
  const result = [];
  for (const fp of (filePaths || [])) { addRecent(fp); watchFile(fp); result.push(readData(fp)); }
  return result;
});

ipcMain.handle('load-md', (_, fp) => {
  const abs = path.resolve(fp);
  if (!fs.existsSync(abs)) return null;
  addRecent(abs); watchFile(abs);
  return readData(abs);
});

ipcMain.handle('save-file', (_, fp, content) => {
  fs.writeFileSync(fp, content, 'utf-8'); return true;
});

ipcMain.handle('save-as', async (_, defaultName, content) => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName || 'untitled.md',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content, 'utf-8');
  addRecent(filePath); watchFile(filePath);
  return filePath;
});

ipcMain.handle('export-html', async (_, name, html) => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: (name || 'document').replace(/\.mdx?$/, '') + '.html',
    filters: [{ name: 'HTML', extensions: ['html'] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
});

ipcMain.handle('unwatch',       (_, fp) => { watchers.get(fp)?.close(); watchers.delete(fp); });
ipcMain.handle('get-recent',    ()      => getRecent());
ipcMain.handle('open-external', (_, u)  => shell.openExternal(u));
ipcMain.handle('open-path',     (_, p)  => shell.openPath(p));

// ── Menu ──────────────────────────────────────────────────
function buildMenu() {
  const s = (...a) => win.webContents.send('menu', ...a);
  const t = [
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
