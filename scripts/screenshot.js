#!/usr/bin/env node
'use strict';
const { _electron: electron } = require('playwright');
const path = require('path');

const APP_DIR = path.join(__dirname, '..');
const SAMPLE  = path.join(APP_DIR, 'test/fixtures/sample.md');
const OUT     = path.join(APP_DIR, 'assets/screenshot.png');

(async () => {
  const app = await electron.launch({
    executablePath: '/usr/bin/electron',
    args: [APP_DIR, SAMPLE],
    env: { ...process.env, ELECTRON_NO_ATTACH_CONSOLE: '1' },
  });

  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1280, height: 800 });
  await win.waitForLoadState('domcontentloaded');

  // Poll until content appears (IPC round-trip can be slow under Playwright)
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const hasTab = await win.$('.tab');
    if (hasTab) break;
    await new Promise(r => setTimeout(r, 300));
  }

  await win.waitForSelector('#md h1', { timeout: 10_000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000)); // mermaid + hljs

  await win.screenshot({ path: OUT });
  console.log('Screenshot saved to', OUT);
  await app.close();
})().catch(e => { console.error(e); process.exit(1); });
