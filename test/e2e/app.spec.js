/**
 * End-to-end tests for MDViewer using Playwright + Electron.
 *
 * Run with:  npm run test:e2e
 *
 * These tests launch the real Electron app and drive it via Playwright.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const APP_DIR  = path.join(__dirname, '../..');
const ELECTRON = '/usr/bin/electron';
const FIXTURES = path.join(__dirname, '../fixtures');

// Helper: launch MDViewer (optionally with a file argument)
async function launchApp(args = []) {
  const { _electron: electron } = require('playwright');
  return electron.launch({
    executablePath: ELECTRON,
    args: [APP_DIR, ...args],
    env: { ...process.env, NODE_ENV: 'test' },
  });
}

// Helper: write a temp .md file, run a test, clean up
async function withTmpFile(content, fn) {
  const fp = path.join(os.tmpdir(), `mdv-e2e-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(fp, content, 'utf-8');
  try {
    await fn(fp);
  } finally {
    try { fs.unlinkSync(fp); } catch {}
  }
}

// ─── Launch & empty state ─────────────────────────────────
test.describe('Launch', () => {
  let app;
  test.afterEach(async () => { if (app) { await app.close(); app = null; } });

  test('app launches without crashing', async () => {
    app = await launchApp();
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    expect(await win.title()).toBe('MDViewer');
  });

  test('shows empty state when no file provided', async () => {
    app = await launchApp();
    const win = await app.firstWindow();
    await win.waitForSelector('#empty', { state: 'visible', timeout: 10_000 });
    const text = await win.$eval('#empty h2', el => el.textContent);
    expect(text).toContain('Open a Markdown file');
  });

  test('toolbar is visible', async () => {
    app = await launchApp();
    const win = await app.firstWindow();
    await win.waitForSelector('#toolbar', { state: 'visible', timeout: 10_000 });
    expect(await win.isVisible('#btn-open')).toBe(true);
    expect(await win.isVisible('#btn-new')).toBe(true);
  });

  test('mode buttons are present', async () => {
    app = await launchApp();
    const win = await app.firstWindow();
    await win.waitForSelector('#mode-group', { state: 'visible', timeout: 10_000 });
    expect(await win.isVisible('[data-mode="preview"]')).toBe(true);
    expect(await win.isVisible('[data-mode="edit"]')).toBe(true);
    expect(await win.isVisible('[data-mode="split"]')).toBe(true);
  });
});

// ─── File opening ─────────────────────────────────────────
test.describe('File opening', () => {
  let app;
  test.afterEach(async () => { if (app) { await app.close(); app = null; } });

  test('opens file from CLI argument', async () => {
    await withTmpFile('# CLI Heading\n\nContent here.', async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('#md h1', { timeout: 10_000 });
      const heading = await win.$eval('#md h1', el => el.textContent);
      expect(heading.trim()).toBe('CLI Heading');
    });
  });

  test('shows filename in tab', async () => {
    await withTmpFile('# Hello', async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('.tab.active', { timeout: 10_000 });
      const name = await win.$eval('.tab.active .tab-name', el => el.textContent);
      expect(name).toBe(path.basename(fp));
    });
  });

  test('hides empty state after opening file', async () => {
    await withTmpFile('# Hello', async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('#md h1', { timeout: 10_000 });
      expect(await win.isHidden('#empty')).toBe(true);
    });
  });
});

// ─── Markdown rendering ───────────────────────────────────
test.describe('Markdown rendering', () => {
  let app;
  test.afterEach(async () => { if (app) { await app.close(); app = null; } });

  test('renders headings', async () => {
    const md = '# H1\n## H2\n### H3\n';
    await withTmpFile(md, async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('#md h1', { timeout: 10_000 });
      expect(await win.isVisible('#md h2')).toBe(true);
      expect(await win.isVisible('#md h3')).toBe(true);
    });
  });

  test('renders tables with .table-scroll wrapper', async () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |\n';
    await withTmpFile(md, async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('.table-scroll', { timeout: 10_000 });
      expect(await win.isVisible('.table-scroll table')).toBe(true);
    });
  });

  test('renders code blocks with syntax highlighting', async () => {
    const md = '```javascript\nconst x = 42;\n```\n';
    await withTmpFile(md, async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('pre', { timeout: 10_000 });
      // hljs adds class to pre or code
      const hasHljs = await win.$('pre code.hljs') || await win.$('code.hljs');
      expect(hasHljs).not.toBeNull();
    });
  });

  test('renders admonitions', async () => {
    const md = '> [!NOTE]\n> This is a note.\n';
    await withTmpFile(md, async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('.adm-note', { timeout: 10_000 });
      expect(await win.isVisible('.adm-note')).toBe(true);
    });
  });

  test('renders mermaid diagrams', async () => {
    const md = '```mermaid\ngraph TD\n  A --> B\n```\n';
    await withTmpFile(md, async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('.mermaid-wrap', { timeout: 20_000 });
      expect(await win.isVisible('.mermaid-wrap')).toBe(true);
    });
  });

  test('generates TOC for multi-heading documents', async () => {
    const md = '# Section 1\n## Sub 1.1\n## Sub 1.2\n# Section 2\n';
    await withTmpFile(md, async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('#toc a', { timeout: 10_000 });
      const count = await win.$$eval('#toc a', els => els.length);
      expect(count).toBeGreaterThanOrEqual(3);
    });
  });

  test('renders task list checkboxes', async () => {
    const md = '- [x] Done\n- [ ] Pending\n';
    await withTmpFile(md, async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('input[type="checkbox"]', { timeout: 10_000 });
      const checkboxes = await win.$$('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);
    });
  });
});

// ─── Tab management ───────────────────────────────────────
test.describe('Tabs', () => {
  let app;
  test.afterEach(async () => { if (app) { await app.close(); app = null; } });

  test('Ctrl+N creates new untitled tab', async () => {
    app = await launchApp();
    const win = await app.firstWindow();
    await win.waitForSelector('#empty', { timeout: 10_000 });
    await win.keyboard.press('Control+n');
    await win.waitForSelector('.tab', { timeout: 5_000 });
    const name = await win.$eval('.tab.active .tab-name', el => el.textContent);
    expect(name).toBe('Untitled');
  });

  test('opening multiple files creates multiple tabs', async () => {
    const f1 = path.join(os.tmpdir(), `mdv-tab1-${process.pid}.md`);
    const f2 = path.join(os.tmpdir(), `mdv-tab2-${process.pid}.md`);
    fs.writeFileSync(f1, '# File 1');
    fs.writeFileSync(f2, '# File 2');
    try {
      app = await launchApp([f1, f2]);
      const win = await app.firstWindow();
      await win.waitForSelector('.tab', { timeout: 10_000 });
      const tabCount = await win.$$eval('.tab', els => els.length);
      expect(tabCount).toBe(2);
    } finally {
      try { fs.unlinkSync(f1); fs.unlinkSync(f2); } catch {}
    }
  });

  test('Ctrl+W closes active tab and shows empty state', async () => {
    await withTmpFile('# Hello', async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('.tab.active', { timeout: 10_000 });
      await win.keyboard.press('Control+w');
      await win.waitForSelector('#empty', { state: 'visible', timeout: 5_000 });
    });
  });

  test('same file opens only once (dedup)', async () => {
    await withTmpFile('# Hello', async fp => {
      app = await launchApp([fp, fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('.tab', { timeout: 10_000 });
      const tabCount = await win.$$eval('.tab', els => els.length);
      expect(tabCount).toBe(1);
    });
  });
});

// ─── Mode switching ───────────────────────────────────────
test.describe('Mode switching', () => {
  let app;
  test.afterEach(async () => { if (app) { await app.close(); app = null; } });

  test('Ctrl+2 switches to edit mode', async () => {
    await withTmpFile('# Hello', async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('#md h1', { timeout: 10_000 });
      await win.keyboard.press('Control+2');
      await win.waitForSelector('.CodeMirror', { timeout: 5_000 });
      const cls = await win.$eval('#layout', el => el.className);
      expect(cls).toContain('mode-edit');
    });
  });

  test('Ctrl+1 switches back to preview mode', async () => {
    await withTmpFile('# Hello', async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('#md h1', { timeout: 10_000 });
      await win.keyboard.press('Control+2');
      await win.keyboard.press('Control+1');
      const cls = await win.$eval('#layout', el => el.className);
      expect(cls).toContain('mode-preview');
    });
  });

  test('Ctrl+3 switches to split mode', async () => {
    await withTmpFile('# Hello', async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('#md h1', { timeout: 10_000 });
      await win.keyboard.press('Control+3');
      const cls = await win.$eval('#layout', el => el.className);
      expect(cls).toContain('mode-split');
    });
  });
});

// ─── Width toggle ─────────────────────────────────────────
test.describe('Width toggle', () => {
  let app;
  test.afterEach(async () => { if (app) { await app.close(); app = null; } });

  test('starts in narrow mode', async () => {
    await withTmpFile('# Hello', async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('#wrap', { timeout: 10_000 });
      const isWide = await win.$eval('#wrap', el => el.classList.contains('wide'));
      expect(isWide).toBe(false);
    });
  });

  test('#btn-width toggles wide class', async () => {
    await withTmpFile('# Hello', async fp => {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('#btn-width', { timeout: 10_000 });
      await win.click('#btn-width');
      expect(await win.$eval('#wrap', el => el.classList.contains('wide'))).toBe(true);
      await win.click('#btn-width');
      expect(await win.$eval('#wrap', el => el.classList.contains('wide'))).toBe(false);
    });
  });
});

// ─── Auto-reload ──────────────────────────────────────────
test.describe('File auto-reload', () => {
  let app;
  test.afterEach(async () => { if (app) { await app.close(); app = null; } });

  test('silently reloads when file changes on disk', async () => {
    const fp = path.join(os.tmpdir(), `mdv-reload-${process.pid}.md`);
    fs.writeFileSync(fp, '# Original');
    try {
      app = await launchApp([fp]);
      const win = await app.firstWindow();
      await win.waitForSelector('#md h1', { timeout: 10_000 });

      // Modify file on disk
      fs.writeFileSync(fp, '# Updated');

      // Wait for the heading to update (file watcher + debounce)
      await win.waitForFunction(
        () => document.querySelector('#md h1')?.textContent?.includes('Updated'),
        { timeout: 5_000 }
      );
      const heading = await win.$eval('#md h1', el => el.textContent);
      expect(heading.trim()).toBe('Updated');
    } finally {
      try { fs.unlinkSync(fp); } catch {}
    }
  });
});
