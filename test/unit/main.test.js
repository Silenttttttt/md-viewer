/**
 * Unit tests for main process utility logic.
 * Electron is mocked so these run in plain Node.js.
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ─── Mock Electron ────────────────────────────────────────
// jest.mock factory cannot reference out-of-scope variables — use a literal path
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => require('os').tmpdir()),
    whenReady: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    once: jest.fn(),
    on: jest.fn(),
    setTitle: jest.fn(),
    webContents: {
      send: jest.fn(),
      once: jest.fn(),
      on: jest.fn(),
    },
  })),
  ipcMain: { handle: jest.fn() },
  shell: { openExternal: jest.fn(), openPath: jest.fn() },
  dialog: {
    showOpenDialog: jest.fn().mockResolvedValue({ filePaths: [] }),
    showSaveDialog: jest.fn().mockResolvedValue({ canceled: true }),
  },
  Menu: {
    setApplicationMenu: jest.fn(),
    buildFromTemplate: jest.fn(() => ({})),
  },
}), { virtual: true });

// ─── Replicate main.js utilities under test ───────────────
// (avoids requiring main.js which auto-starts the Electron app)

const TEST_RECENT_FILE = path.join(os.tmpdir(), `mdviewer-test-recent-${process.pid}.json`);
const MAX_RECENT = 25;

function getRecent() {
  try { return JSON.parse(fs.readFileSync(TEST_RECENT_FILE, 'utf-8')); }
  catch { return []; }
}

function addRecent(fp) {
  let r = getRecent().filter(p => p !== fp);
  r.unshift(fp);
  fs.writeFileSync(TEST_RECENT_FILE, JSON.stringify(r.slice(0, MAX_RECENT)));
}

function readData(fp) {
  return {
    filePath: fp,
    dir:  path.dirname(fp),
    name: path.basename(fp),
    content: fs.readFileSync(fp, 'utf-8'),
  };
}

// ─── Cleanup ──────────────────────────────────────────────
afterAll(() => {
  try { fs.unlinkSync(TEST_RECENT_FILE); } catch {}
});

beforeEach(() => {
  try { fs.unlinkSync(TEST_RECENT_FILE); } catch {}
});

// ─── Recent files ─────────────────────────────────────────
describe('getRecent / addRecent', () => {
  test('returns empty array when no file exists', () => {
    expect(getRecent()).toEqual([]);
  });

  test('adds first entry', () => {
    addRecent('/home/user/doc.md');
    expect(getRecent()).toEqual(['/home/user/doc.md']);
  });

  test('newest file is at index 0', () => {
    addRecent('/a.md');
    addRecent('/b.md');
    expect(getRecent()[0]).toBe('/b.md');
    expect(getRecent()[1]).toBe('/a.md');
  });

  test('deduplicates — reopening moves file to front', () => {
    addRecent('/a.md');
    addRecent('/b.md');
    addRecent('/a.md');
    const r = getRecent();
    expect(r[0]).toBe('/a.md');
    expect(r.filter(x => x === '/a.md').length).toBe(1);
  });

  test('caps list at MAX_RECENT entries', () => {
    for (let i = 0; i < MAX_RECENT + 5; i++) {
      addRecent(`/file${i}.md`);
    }
    expect(getRecent().length).toBe(MAX_RECENT);
  });

  test('persists across calls (reads from disk)', () => {
    addRecent('/persistent.md');
    // simulate a new "process" by calling getRecent fresh
    const fresh = getRecent();
    expect(fresh).toContain('/persistent.md');
  });

  test('handles Unicode paths', () => {
    addRecent('/docs/документ.md');
    expect(getRecent()[0]).toBe('/docs/документ.md');
  });
});

// ─── readData ─────────────────────────────────────────────
describe('readData', () => {
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `mdviewer-readdata-${process.pid}.md`);
  });
  afterEach(() => {
    try { fs.unlinkSync(tmpFile); } catch {}
  });

  test('returns correct filePath', () => {
    fs.writeFileSync(tmpFile, '# Hello', 'utf-8');
    expect(readData(tmpFile).filePath).toBe(tmpFile);
  });

  test('returns correct name (basename)', () => {
    fs.writeFileSync(tmpFile, '# Hello', 'utf-8');
    expect(readData(tmpFile).name).toBe(path.basename(tmpFile));
  });

  test('returns correct dir (dirname)', () => {
    fs.writeFileSync(tmpFile, '# Hello', 'utf-8');
    expect(readData(tmpFile).dir).toBe(os.tmpdir());
  });

  test('returns full file content', () => {
    const content = '# Title\n\nParagraph with **bold** and _italic_.';
    fs.writeFileSync(tmpFile, content, 'utf-8');
    expect(readData(tmpFile).content).toBe(content);
  });

  test('handles UTF-8 content', () => {
    const content = '# 日本語\n\nПривет мир\n\n🎉 emoji';
    fs.writeFileSync(tmpFile, content, 'utf-8');
    expect(readData(tmpFile).content).toBe(content);
  });

  test('handles empty file', () => {
    fs.writeFileSync(tmpFile, '', 'utf-8');
    expect(readData(tmpFile).content).toBe('');
  });

  test('throws for nonexistent file', () => {
    expect(() => readData('/nonexistent/file.md')).toThrow();
  });
});

// ─── Path utilities ───────────────────────────────────────
describe('path utilities', () => {
  test('path.basename strips directory', () => {
    expect(path.basename('/home/user/docs/readme.md')).toBe('readme.md');
  });

  test('path.dirname returns directory', () => {
    expect(path.dirname('/home/user/docs/readme.md')).toBe('/home/user/docs');
  });

  test('path.resolve makes path absolute', () => {
    const abs = path.resolve('relative.md');
    expect(path.isAbsolute(abs)).toBe(true);
  });

  test('path.extname detects .md', () => {
    expect(path.extname('readme.md')).toBe('.md');
    expect(path.extname('readme.markdown')).toBe('.markdown');
    expect(path.extname('readme.txt')).toBe('.txt');
  });
});
