'use strict';

// ─── Utilities ────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dbc = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ─── State ────────────────────────────────────────────────
const S = {
  tabs: [],
  activeIdx: -1,
  mode: 'preview',
  theme: window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  zoom: 1,
  tocOpen: true,
  wide: false,
  mermaidLoaded: false,
  tocObserver: null,
};
let tabSeq = 0;

// ─── Theme ────────────────────────────────────────────────
function setTheme(th) {
  S.theme = th;
  document.documentElement.dataset.theme = th;
  $('hljs-css').href = `./lib/${th === 'light' ? 'github' : 'github-dark'}.min.css`;
  $('icon-moon').style.display = th === 'dark' ? '' : 'none';
  $('icon-sun').style.display  = th === 'light' ? '' : 'none';
  if (S.mermaidLoaded) {
    mermaid.initialize({ startOnLoad: false, theme: th === 'light' ? 'default' : 'dark', securityLevel: 'loose' });
  }
}

// ─── Mermaid lazy load ────────────────────────────────────
function loadMermaid() {
  return new Promise(resolve => {
    if (S.mermaidLoaded) return resolve();
    const s = document.createElement('script');
    s.src = './lib/mermaid.min.js';
    s.onload = () => {
      mermaid.initialize({ startOnLoad: false, theme: S.theme === 'light' ? 'default' : 'dark', securityLevel: 'loose', fontFamily: 'inherit' });
      S.mermaidLoaded = true;
      resolve();
    };
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

// ─── Admonitions ──────────────────────────────────────────
const ADM = { note: '📝 Note', tip: '💡 Tip', important: '❗ Important', warning: '⚠️ Warning', caution: '🔥 Caution' };
function processAdmonitions(root) {
  root.querySelectorAll('blockquote').forEach(bq => {
    const p = bq.querySelector('p');
    if (!p) return;
    const m = p.textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
    if (!m) return;
    const type = m[1].toLowerCase();
    const div = document.createElement('div');
    div.className = `adm adm-${type}`;
    const title = document.createElement('div');
    title.className = 'adm-title';
    title.textContent = ADM[type] || m[1];
    p.innerHTML = p.innerHTML.replace(/^\[!\w+\]\s*/, '');
    div.appendChild(title);
    while (bq.firstChild) div.appendChild(bq.firstChild);
    bq.replaceWith(div);
  });
}

// ─── TOC ──────────────────────────────────────────────────
function buildTOC(el) {
  if (S.tocObserver) { S.tocObserver.disconnect(); S.tocObserver = null; }
  const hs = [...el.querySelectorAll('h1,h2,h3,h4')];
  const toc = $('toc');
  toc.innerHTML = '';
  if (hs.length < 2) return;

  hs.forEach(h => {
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.textContent;
    a.dataset.lvl = h.tagName[1];
    a.dataset.id  = h.id;
    a.addEventListener('click', e => { e.preventDefault(); h.scrollIntoView({ behavior: 'smooth' }); });
    toc.appendChild(a);
  });

  S.tocObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      toc.querySelector(`[data-id="${e.target.id}"]`)?.classList.toggle('active', e.isIntersecting);
    });
  }, { root: $('preview-pane'), rootMargin: '-4px 0px -75% 0px' });
  hs.forEach(h => S.tocObserver.observe(h));
}

// ─── Render ───────────────────────────────────────────────
const debouncedRender = dbc((tab) => renderContent(tab), 300);

async function renderContent(tab) {
  if (!tab) return;
  const pp = $('preview-pane');
  const savedScroll = pp.scrollTop;

  const html = marked.parse(tab.content || '', { gfm: true, breaks: false });
  const mdEl = $('md');
  mdEl.innerHTML = html;

  // Heading IDs
  mdEl.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    if (!h.id) {
      h.id = h.textContent.toLowerCase()
        .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'h' + tabSeq++;
    }
  });

  // Fix relative image paths
  if (tab.dir) {
    mdEl.querySelectorAll('img').forEach(img => {
      const s = img.getAttribute('src') || '';
      if (s && !s.startsWith('http') && !s.startsWith('file://') && !s.startsWith('data:')) {
        img.src = `file://${tab.dir}/${s}`;
      }
    });
  }

  // Wrap tables for horizontal scroll
  mdEl.querySelectorAll('table').forEach(table => {
    const w = document.createElement('div');
    w.className = 'table-scroll';
    table.parentNode.insertBefore(w, table);
    w.appendChild(table);
  });

  // Admonitions
  processAdmonitions(mdEl);

  // Syntax highlighting
  mdEl.querySelectorAll('pre code').forEach(block => {
    const lang = (block.className.match(/language-(\S+)/) || [])[1] || '';
    if (lang === 'mermaid') return;
    hljs.highlightElement(block);
    const pre = block.closest('pre');
    if (lang) {
      const lb = document.createElement('span'); lb.className = 'code-lang'; lb.textContent = lang; pre.appendChild(lb);
    }
    const cp = document.createElement('button');
    cp.className = 'copy-btn'; cp.textContent = 'copy';
    cp.onclick = () => { navigator.clipboard.writeText(block.textContent); cp.textContent = '✓'; setTimeout(() => cp.textContent = 'copy', 1600); };
    pre.appendChild(cp);
  });

  // Mermaid
  const mermaidBlocks = mdEl.querySelectorAll('code.language-mermaid');
  if (mermaidBlocks.length) {
    await loadMermaid();
    mermaidBlocks.forEach(block => {
      const w = document.createElement('div'); w.className = 'mermaid-wrap';
      const inner = document.createElement('div'); inner.className = 'mermaid'; inner.textContent = block.textContent;
      w.appendChild(inner);
      block.closest('pre').replaceWith(w);
    });
    try { await mermaid.run({ querySelector: '.mermaid' }); } catch (_) {}
  }

  // Links
  mdEl.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    a.addEventListener('click', e => {
      e.preventDefault();
      if (!href) return;
      if (href.startsWith('#')) {
        document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      if (/^https?:|^mailto:/.test(href)) {
        window.api.openExternal(href);
      } else if (/\.(md|markdown|mdx)$/i.test(href)) {
        const full = href.startsWith('/') ? href : (tab.dir ? `${tab.dir}/${href}` : href);
        openFilePath(full);
      } else {
        const full = href.startsWith('/') ? href : (tab.dir ? `${tab.dir}/${href}` : href);
        window.api.openPath(full);
      }
    });
  });

  // Checkboxes read-only
  mdEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = true);

  // TOC
  buildTOC(mdEl);

  // Restore scroll
  pp.scrollTop = savedScroll;
}

// ─── Editor ───────────────────────────────────────────────
function ensureEditor(tab) {
  if (tab.cm) return;
  const el = document.createElement('div');
  el.className = 'cm-instance';
  $('cm-container').appendChild(el);

  const cm = CodeMirror(el, {
    value: tab.content,
    mode: { name: 'markdown', highlightFormatting: true },
    theme: 'mdv',
    lineNumbers: true,
    lineWrapping: true,
    autofocus: false,
    tabSize: 2,
    indentWithTabs: false,
    extraKeys: {
      'Ctrl-S': () => saveTab(),
      'Cmd-S':  () => saveTab(),
      'Ctrl-F': 'findPersistent',
      'Cmd-F':  'findPersistent',
    },
  });

  const onEdit = dbc(() => {
    if (!tab.cm) return;
    tab.content = tab.cm.getValue();
    tab.modified = tab.content !== tab.savedContent;
    updateTabLabel(tab);
    debouncedRender(tab);
    updateStatus();
  }, 250);

  cm.on('change', onEdit);

  // Scroll sync in split mode
  cm.on('scroll', dbc(() => {
    if (S.mode !== 'split') return;
    const info = cm.getScrollInfo();
    const max = info.height - info.clientHeight;
    if (max <= 0) return;
    const pp = $('preview-pane');
    pp.scrollTop = (info.top / max) * (pp.scrollHeight - pp.clientHeight);
  }, 40));

  tab.cm = cm;
  tab.cmEl = el;
}

function activateEditor(tab) {
  ensureEditor(tab);
  document.querySelectorAll('.cm-instance').forEach(el => el.classList.remove('active'));
  tab.cmEl.classList.add('active');
  setTimeout(() => { tab.cm.refresh(); if (S.mode === 'edit') tab.cm.focus(); }, 20);
}

// ─── Mode ─────────────────────────────────────────────────
function setMode(mode) {
  S.mode = mode;
  $('layout').className = `mode-${mode}`;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const tab = getActive();
  if (tab && (mode === 'edit' || mode === 'split')) activateEditor(tab);
  updateStatus();
}

// ─── Tab management ───────────────────────────────────────
function getActive() { return S.tabs[S.activeIdx] || null; }

function renderTabBar() {
  const bar = $('tabs');
  bar.innerHTML = '';
  S.tabs.forEach((tab, idx) => {
    const el = document.createElement('button');
    el.className = `tab${idx === S.activeIdx ? ' active' : ''}`;
    el.title = tab.filePath || tab.name;
    el.setAttribute('role', 'tab');
    el.innerHTML = `<span class="tab-name">${tab.name}</span>${tab.modified ? '<span class="tab-dot">●</span>' : ''}<span class="tab-close" title="Close">×</span>`;
    el.addEventListener('click', e => {
      if (e.target.classList.contains('tab-close')) { e.stopPropagation(); closeTab(idx); return; }
      activateTab(idx);
    });
    el.addEventListener('auxclick', e => { if (e.button === 1) closeTab(idx); });
    bar.appendChild(el);
  });
  $('content-area').classList.toggle('no-tabs', S.tabs.length === 0);
}

function updateTabLabel(tab) {
  const idx = S.tabs.indexOf(tab);
  const el = $('tabs').children[idx];
  if (!el) return;
  el.querySelector('.tab-name').textContent = tab.name;
  const dot = el.querySelector('.tab-dot');
  if (tab.modified && !dot) {
    const d = document.createElement('span'); d.className = 'tab-dot'; d.textContent = '●';
    el.insertBefore(d, el.querySelector('.tab-close'));
  } else if (!tab.modified && dot) {
    dot.remove();
  }
}

function createTab(data) {
  if (data.filePath) {
    const idx = S.tabs.findIndex(t => t.filePath === data.filePath);
    if (idx !== -1) { activateTab(idx); return; }
  }
  const tab = {
    id: ++tabSeq,
    filePath: data.filePath || null,
    name: data.name || 'Untitled',
    content: data.content || '',
    savedContent: data.content || '',
    modified: false,
    diskChanged: false,
    pendingDiskContent: null,
    dir: data.dir || '',
    cm: null, cmEl: null,
    previewScroll: 0,
  };
  S.tabs.push(tab);
  renderTabBar();
  activateTab(S.tabs.length - 1);
}

function activateTab(idx) {
  if (idx < 0 || idx >= S.tabs.length) return;
  const cur = getActive();
  if (cur) cur.previewScroll = $('preview-pane').scrollTop;
  S.activeIdx = idx;
  const tab = S.tabs[idx];

  if (S.mode === 'edit' || S.mode === 'split') activateEditor(tab);

  renderContent(tab).then(() => {
    $('preview-pane').scrollTop = tab.previewScroll;
  });

  $('reload-bar').classList.toggle('hidden', !tab.diskChanged);
  renderTabBar();
  updateStatus();
}

function closeTab(idx) {
  const tab = S.tabs[idx];
  if (!tab) return;
  if (tab.modified && !confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) return;
  if (tab.cmEl) tab.cmEl.remove();
  if (tab.filePath) window.api.unwatch(tab.filePath);
  S.tabs.splice(idx, 1);
  if (S.tabs.length === 0) {
    S.activeIdx = -1;
    $('md').innerHTML = '';
    $('toc').innerHTML = '';
    $('reload-bar').classList.add('hidden');
    renderTabBar();
    updateStatus();
    return;
  }
  S.activeIdx = -1;
  activateTab(Math.min(idx, S.tabs.length - 1));
}

// ─── File operations ──────────────────────────────────────
async function openFilePath(fp) {
  const data = await window.api.loadMd(fp);
  if (data) createTab(data);
}

async function saveTab() {
  const tab = getActive();
  if (!tab) return;
  if (!tab.filePath) { await saveTabAs(); return; }
  await window.api.saveFile(tab.filePath, tab.content);
  tab.savedContent = tab.content;
  tab.modified = false;
  updateTabLabel(tab);
  updateStatus();
  showToast(`Saved ${tab.name}`);
}

async function saveTabAs() {
  const tab = getActive();
  if (!tab) return;
  const fp = await window.api.saveAs(tab.name, tab.content);
  if (!fp) return;
  if (tab.filePath && tab.filePath !== fp) window.api.unwatch(tab.filePath);
  tab.filePath = fp;
  tab.name = fp.split('/').pop();
  tab.savedContent = tab.content;
  tab.modified = false;
  updateTabLabel(tab);
  renderTabBar();
  updateStatus();
  showToast(`Saved as ${tab.name}`);
}

async function exportHTML() {
  const tab = getActive();
  if (!tab) return;
  const hljsCSS = await fetch(`./lib/${S.theme === 'light' ? 'github' : 'github-dark'}.min.css`).then(r => r.text()).catch(() => '');
  const html = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>${tab.name.replace(/\.mdx?$/, '')}</title>\n<style>\nbody{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#1f2328;max-width:900px;margin:0 auto;padding:40px 40px 80px}h1,h2{border-bottom:1px solid #d0d7de;padding-bottom:.3em}h1,h2,h3,h4,h5,h6{font-weight:600;line-height:1.3;margin:1.5em 0 .5em}h1{font-size:2em;margin-top:0}h2{font-size:1.5em}h3{font-size:1.25em}a{color:#0969da}code{font-family:monospace;font-size:.875em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:4px;padding:.15em .4em}pre{background:#f6f8fa;border:1px solid #d0d7de;border-radius:8px;padding:16px;overflow-x:auto}pre code{background:none;border:none;padding:0}table{width:100%;border-collapse:collapse;margin-bottom:1em}th,td{border:1px solid #d0d7de;padding:7px 12px;text-align:left}th{background:#f6f8fa;font-weight:600}blockquote{border-left:4px solid #0969da;background:rgba(9,105,218,.06);padding:10px 16px;margin:0 0 1em;border-radius:0 6px 6px 0;color:#636c76}blockquote p{margin:0}img{max-width:100%;border-radius:6px}hr{border:none;border-top:1px solid #d0d7de;margin:2em 0}\n${hljsCSS}\n</style>\n</head>\n<body>\n${$('md').innerHTML}\n</body>\n</html>`;
  const fp = await window.api.exportHtml(tab.name, html);
  if (fp) showToast(`Exported to ${fp.split('/').pop()}`);
}

// ─── File change handling ─────────────────────────────────
function handleFileChanged({ filePath, content }) {
  const idx = S.tabs.findIndex(t => t.filePath === filePath);
  if (idx === -1) return;
  const tab = S.tabs[idx];
  if (tab.content === tab.savedContent) {
    tab.content = content; tab.savedContent = content;
    tab.modified = false; tab.diskChanged = false;
    if (tab.cm) { const cur = tab.cm.getCursor(); tab.cm.setValue(content); tab.cm.setCursor(cur); }
    if (idx === S.activeIdx) { renderContent(tab); $('reload-bar').classList.add('hidden'); }
    updateTabLabel(tab); updateStatus();
  } else {
    tab.diskChanged = true; tab.pendingDiskContent = content;
    if (idx === S.activeIdx) $('reload-bar').classList.remove('hidden');
    updateTabLabel(tab);
  }
}

// ─── Width / Zoom ─────────────────────────────────────────
function toggleWidth() {
  S.wide = !S.wide;
  $('wrap').classList.toggle('wide', S.wide);
  $('icon-narrow').style.display = S.wide ? 'none' : '';
  $('icon-wide').style.display   = S.wide ? '' : 'none';
}

function adjustZoom(delta) {
  if (delta === 0) { S.zoom = 1; $('wrap').style.fontSize = ''; return; }
  S.zoom = Math.max(0.6, Math.min(2.5, S.zoom + delta));
  $('wrap').style.fontSize = S.zoom + 'em';
}

// ─── Sidebar ──────────────────────────────────────────────
function toggleTOC() {
  S.tocOpen = !S.tocOpen;
  $('sidebar').classList.toggle('hidden', !S.tocOpen);
}

// ─── Status bar ───────────────────────────────────────────
function updateStatus() {
  const tab = getActive();
  if (!tab) { $('st-info').textContent = ''; $('st-mode').textContent = ''; $('st-file').textContent = ''; return; }
  const words = tab.content.trim() ? tab.content.trim().split(/\s+/).length : 0;
  const lines = tab.content.split('\n').length;
  $('st-info').textContent = `${words.toLocaleString()} words  ·  ${lines} lines`;
  $('st-mode').textContent = S.mode + (tab.modified ? '  ·  ●' : '');
  $('st-file').textContent = tab.filePath || '';
}

// ─── Toast ────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 220); }, 2200);
}

// ─── Recent files ─────────────────────────────────────────
function showRecentFiles(recent) {
  const list = $('recent-list');
  if (!recent?.length) return;
  const lbl = document.createElement('p');
  lbl.style.cssText = 'font-size:11.5px;color:var(--muted);margin-bottom:6px;';
  lbl.textContent = 'Recent files';
  list.appendChild(lbl);
  recent.slice(0, 8).forEach(fp => {
    const btn = document.createElement('button');
    btn.className = 'recent-item';
    const name = fp.split('/').pop();
    const dir  = fp.split('/').slice(-2, -1)[0] || '';
    btn.innerHTML = `<b>${name}</b><span>${dir ? ' — ' + dir : ''}</span>`;
    btn.title = fp;
    btn.onclick = () => openFilePath(fp);
    list.appendChild(btn);
  });
}

// ─── Drag & drop ──────────────────────────────────────────
// Counter-based so nested-element enter/leave doesn't flicker
let _dragCount = 0;

document.addEventListener('dragenter', e => {
  _dragCount++;
  e.preventDefault();
  document.body.classList.add('drag-over');
});
document.addEventListener('dragleave', () => {
  _dragCount = Math.max(0, _dragCount - 1);
  if (!_dragCount) document.body.classList.remove('drag-over');
});
document.addEventListener('dragover', e => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('drop', async e => {
  e.preventDefault();
  _dragCount = 0;
  document.body.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer?.files || []);
  for (const f of files) {
    if (!/\.(md|markdown|mdx)$/i.test(f.name)) continue;
    if (f.path) {
      // Electron exposes .path on dropped File objects
      await openFilePath(f.path);
    } else {
      // Fallback: read via FileReader (e.g. when path is unavailable)
      try {
        const content = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = ev => res(ev.target.result);
          r.onerror = rej;
          r.readAsText(f);
        });
        createTab({ name: f.name, content, dir: '' });
      } catch (_) {}
    }
  }
});

// ─── Keyboard shortcuts ───────────────────────────────────
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key;
  if (k === 'o' || k === 'O')         { e.preventDefault(); $('btn-open').click(); }
  if (k === 'n' || k === 'N')         { e.preventDefault(); createTab({ name: 'Untitled', content: '', dir: '' }); }
  if (k === 's' && !e.shiftKey)       { e.preventDefault(); saveTab(); }
  if (k === 'S' && e.shiftKey)        { e.preventDefault(); saveTabAs(); }
  if (k === 'w' || k === 'W')         { e.preventDefault(); const t = getActive(); if (t) closeTab(S.activeIdx); }
  if (k === '\\')                     { e.preventDefault(); toggleTOC(); }
  if (k === '1')                      { e.preventDefault(); setMode('preview'); }
  if (k === '2')                      { e.preventDefault(); setMode('edit'); }
  if (k === '3')                      { e.preventDefault(); setMode('split'); }
  if (k === '=' || k === '+')         { e.preventDefault(); adjustZoom(0.1); }
  if (k === '-')                      { e.preventDefault(); adjustZoom(-0.1); }
  if (k === '0')                      { e.preventDefault(); adjustZoom(0); }
  if (k === 'W' && e.shiftKey)        { e.preventDefault(); toggleWidth(); }
  if (k === 'T' && e.shiftKey)        { e.preventDefault(); setTheme(S.theme === 'dark' ? 'light' : 'dark'); }
  if (k === 'E' && e.shiftKey)        { e.preventDefault(); exportHTML(); }
  // Cycle tabs with Ctrl+PageDown / Ctrl+PageUp
  if (k === 'PageDown' && S.tabs.length > 1) { e.preventDefault(); activateTab((S.activeIdx + 1) % S.tabs.length); }
  if (k === 'PageUp'   && S.tabs.length > 1) { e.preventDefault(); activateTab((S.activeIdx - 1 + S.tabs.length) % S.tabs.length); }
});

// ─── Initialization ───────────────────────────────────────
async function init() {
  setTheme(S.theme);

  // Wire up toolbar
  $('btn-toc').onclick     = toggleTOC;
  $('btn-new').onclick     = () => createTab({ name: 'Untitled', content: '', dir: '' });
  $('btn-open').onclick    = async () => { const fs = await window.api.openFiles(); fs.forEach(f => createTab(f)); };
  $('btn-save').onclick    = saveTab;
  $('btn-width').onclick   = toggleWidth;
  $('btn-theme').onclick   = () => setTheme(S.theme === 'dark' ? 'light' : 'dark');
  $('btn-zm').onclick      = () => adjustZoom(-0.1);
  $('btn-zp').onclick      = () => adjustZoom(0.1);
  $('btn-new-tab').onclick = () => createTab({ name: 'Untitled', content: '', dir: '' });
  document.querySelectorAll('.mode-btn').forEach(b => b.onclick = () => setMode(b.dataset.mode));

  $('btn-reload').onclick = () => {
    const tab = getActive();
    if (!tab?.pendingDiskContent) return;
    tab.content = tab.pendingDiskContent; tab.savedContent = tab.pendingDiskContent;
    tab.modified = false; tab.diskChanged = false; tab.pendingDiskContent = null;
    if (tab.cm) { tab.cm.setValue(tab.content); }
    renderContent(tab);
    $('reload-bar').classList.add('hidden');
    updateTabLabel(tab); updateStatus();
  };
  $('btn-dismiss').onclick = () => {
    const tab = getActive();
    if (tab) tab.diskChanged = false;
    $('reload-bar').classList.add('hidden');
  };

  // IPC
  window.api.onFileChanged(handleFileChanged);
  window.api.onMenu((action, ...args) => {
    switch (action) {
      case 'new':          createTab({ name: 'Untitled', content: '', dir: '' }); break;
      case 'open':         $('btn-open').click(); break;
      case 'save':         saveTab(); break;
      case 'save-as':      saveTabAs(); break;
      case 'export-html':  exportHTML(); break;
      case 'close-tab':    { const t = getActive(); if (t) closeTab(S.activeIdx); } break;
      case 'toggle-toc':   toggleTOC(); break;
      case 'toggle-width': toggleWidth(); break;
      case 'theme':        setTheme(S.theme === 'dark' ? 'light' : 'dark'); break;
      case 'mode':         setMode(args[0]); break;
      case 'zoom':         args[0] === 0 ? adjustZoom(0) : adjustZoom(args[0] * 0.1); break;
    }
  });

  // ResizeObserver to keep CodeMirror sized correctly
  new ResizeObserver(() => S.tabs.forEach(t => t.cm?.refresh())).observe($('editor-pane'));

  // Load initial files
  try {
    const { files, recent } = await window.api.getInitial();
    showRecentFiles(recent);
    if (files.length > 0) {
      files.forEach(f => createTab(f));
    }
  } catch (e) {
    console.error('init error:', e);
  }
}

init();
