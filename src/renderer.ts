'use strict';

// ─── Utilities ────────────────────────────────────────────
const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
const dbc = (fn: (...a: unknown[]) => void, ms: number): ((...a: unknown[]) => void) => {
  let t: ReturnType<typeof setTimeout>;
  return (...a: unknown[]): void => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

// ─── State ────────────────────────────────────────────────
const S: AppState = {
  tabs: [],
  activeIdx: -1,
  mode: 'preview',
  theme: window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  zoom: 1,
  tocOpen: true,
  wide: true,
  mermaidLoaded: false,
  tocObserver: null,
};
let tabSeq: number = 0;

// ─── Theme ────────────────────────────────────────────────
function setTheme(th: Theme): void {
  S.theme = th;
  document.documentElement.dataset.theme = th;
  ($('hljs-css') as HTMLLinkElement).href = `./lib/${th === 'light' ? 'github' : 'github-dark'}.min.css`;
  $('icon-moon').style.display = th === 'dark' ? '' : 'none';
  $('icon-sun').style.display  = th === 'light' ? '' : 'none';
  if (S.mermaidLoaded) {
    mermaid.initialize({ startOnLoad: false, theme: th === 'light' ? 'default' : 'dark', securityLevel: 'loose' });
  }
}

// ─── Mermaid lazy load ────────────────────────────────────
function loadMermaid(): Promise<void> {
  return new Promise<void>(resolve => {
    if (S.mermaidLoaded) return resolve();
    const s = document.createElement('script');
    s.src = './lib/mermaid.min.js';
    s.onload = (): void => {
      mermaid.initialize({ startOnLoad: false, theme: S.theme === 'light' ? 'default' : 'dark', securityLevel: 'loose', fontFamily: 'inherit' });
      S.mermaidLoaded = true;
      resolve();
    };
    s.onerror = (): void => resolve();
    document.head.appendChild(s);
  });
}

// ─── Admonitions ──────────────────────────────────────────
const ADM: Record<string, string> = { note: '📝 Note', tip: '💡 Tip', important: '❗ Important', warning: '⚠️ Warning', caution: '🔥 Caution' };
function processAdmonitions(root: HTMLElement): void {
  root.querySelectorAll('blockquote').forEach(bq => {
    const p = bq.querySelector('p');
    if (!p) return;
    const m = p.textContent!.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
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
function buildTOC(el: HTMLElement): void {
  if (S.tocObserver) { S.tocObserver.disconnect(); S.tocObserver = null; }
  const hs = [...el.querySelectorAll('h1,h2,h3,h4')] as HTMLElement[];
  const toc = $('toc');
  toc.innerHTML = '';
  if (hs.length < 2) return;

  hs.forEach(h => {
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.textContent;
    a.dataset.lvl = h.tagName[1];
    a.dataset.id  = h.id;
    a.addEventListener('click', (e: Event) => { e.preventDefault(); h.scrollIntoView({ behavior: 'smooth' }); });
    toc.appendChild(a);
  });

  S.tocObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      toc.querySelector(`[data-id="${e.target.id}"]`)?.classList.toggle('active', e.isIntersecting);
    });
  }, { root: $('preview-pane'), rootMargin: '-4px 0px -75% 0px' });
  hs.forEach(h => S.tocObserver!.observe(h));
}

// ─── Render ───────────────────────────────────────────────
const debouncedRender = (dbc as (fn: (tab: TabState) => void, ms: number) => (tab: TabState) => void)((tab: TabState) => renderContent(tab), 300);

async function renderContent(tab: TabState): Promise<void> {
  if (!tab) return;
  const pp = $('preview-pane');
  const savedScroll = pp.scrollTop;

  const html = marked.parse(tab.content || '', { gfm: true, breaks: false });
  const mdEl = $('md');
  mdEl.innerHTML = html;

  // Heading IDs
  mdEl.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    const hEl = h as HTMLElement;
    if (!hEl.id) {
      hEl.id = hEl.textContent!.toLowerCase()
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
    table.parentNode!.insertBefore(w, table);
    w.appendChild(table);
  });

  // Admonitions
  processAdmonitions(mdEl);

  // Syntax highlighting
  mdEl.querySelectorAll('pre code').forEach(block => {
    const codeEl = block as HTMLElement;
    const lang = (codeEl.className.match(/language-(\S+)/) || [])[1] || '';
    if (lang === 'mermaid') return;
    hljs.highlightElement(codeEl);
    const pre = codeEl.closest('pre') as HTMLElement;
    if (lang) {
      const lb = document.createElement('span'); lb.className = 'code-lang'; lb.textContent = lang; pre.appendChild(lb);
    }
    const cp = document.createElement('button');
    cp.className = 'copy-btn'; cp.textContent = 'copy';
    cp.onclick = (): void => { navigator.clipboard.writeText(codeEl.textContent!); cp.textContent = '✓'; setTimeout(() => cp.textContent = 'copy', 1600); };
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
      (block.closest('pre') as HTMLElement).replaceWith(w);
    });
    try { await mermaid.run({ querySelector: '.mermaid' }); } catch (_) {}
  }

  // Links
  mdEl.querySelectorAll('a[href]').forEach(a => {
    const aEl = a as HTMLAnchorElement;
    const href = aEl.getAttribute('href');
    aEl.addEventListener('click', (e: Event) => {
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
  mdEl.querySelectorAll('input[type="checkbox"]').forEach(cb => (cb as HTMLInputElement).disabled = true);

  // TOC
  buildTOC(mdEl);

  // Restore scroll
  pp.scrollTop = savedScroll;
}

function reattachLinks(tab: TabState): void {
  const mdEl = $('md') as HTMLElement;
  mdEl.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(aEl => {
    const href = aEl.getAttribute('href');
    aEl.addEventListener('click', (e: Event) => {
      e.preventDefault();
      if (!href) return;
      if (href.startsWith('#')) { document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' }); return; }
      if (/^https?:|^mailto:/.test(href)) window.api.openExternal(href);
      else if (/\.(md|markdown|mdx)$/i.test(href)) openFilePath(href.startsWith('/') ? href : (tab.dir ? `${tab.dir}/${href}` : href));
      else window.api.openPath(href.startsWith('/') ? href : (tab.dir ? `${tab.dir}/${href}` : href));
    });
  });
}

// ─── Editor ───────────────────────────────────────────────
function ensureEditor(tab: TabState): void {
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

  const onEdit = (dbc as (fn: () => void, ms: number) => () => void)(() => {
    if (!tab.cm) return;
    tab.content = tab.cm.getValue();
    tab.modified = tab.content !== tab.savedContent;
    updateTabLabel(tab);
    debouncedRender(tab);
    updateStatus();
  }, 250);

  cm.on('change', onEdit);

  // Scroll sync in split mode
  cm.on('scroll', (dbc as (fn: () => void, ms: number) => () => void)(() => {
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

function activateEditor(tab: TabState): void {
  ensureEditor(tab);
  document.querySelectorAll('.cm-instance').forEach(el => el.classList.remove('active'));
  tab.cmEl!.classList.add('active');
  setTimeout(() => { tab.cm!.refresh(); if (S.mode === 'edit') tab.cm!.focus(); }, 20);
}

// ─── Mode ─────────────────────────────────────────────────
function setMode(mode: ViewMode): void {
  if (F.open) closeFind();
  S.mode = mode;
  $('layout').className = `mode-${mode}`;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.mode === mode));
  const tab = getActive();
  if (tab && (mode === 'edit' || mode === 'split')) activateEditor(tab);
  updateStatus();
}

// ─── Tab management ───────────────────────────────────────
function getActive(): TabState | null { return S.tabs[S.activeIdx] || null; }

function renderTabBar(): void {
  const bar = $('tabs');
  bar.innerHTML = '';
  S.tabs.forEach((tab, idx) => {
    const el = document.createElement('button');
    el.className = `tab${idx === S.activeIdx ? ' active' : ''}`;
    el.title = tab.filePath || tab.name;
    el.setAttribute('role', 'tab');
    el.innerHTML = `<span class="tab-name">${tab.name}</span>${tab.modified ? '<span class="tab-dot">●</span>' : ''}<span class="tab-close" title="Close">×</span>`;
    el.addEventListener('click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('tab-close')) { e.stopPropagation(); closeTab(idx); return; }
      activateTab(idx);
    });
    el.addEventListener('auxclick', (e: MouseEvent) => { if (e.button === 1) closeTab(idx); });
    bar.appendChild(el);
  });
  $('content-area').classList.toggle('no-tabs', S.tabs.length === 0);
}

function updateTabLabel(tab: TabState): void {
  const idx = S.tabs.indexOf(tab);
  const el = $('tabs').children[idx] as HTMLElement;
  if (!el) return;
  (el.querySelector('.tab-name') as HTMLElement).textContent = tab.name;
  const dot = el.querySelector('.tab-dot');
  if (tab.modified && !dot) {
    const d = document.createElement('span'); d.className = 'tab-dot'; d.textContent = '●';
    el.insertBefore(d, el.querySelector('.tab-close'));
  } else if (!tab.modified && dot) {
    dot.remove();
  }
}

function createTab(data: Partial<FileData> & { name?: string; content?: string; dir?: string }): void {
  if (data.filePath) {
    const idx = S.tabs.findIndex(t => t.filePath === data.filePath);
    if (idx !== -1) { activateTab(idx); return; }
  }
  const tab: TabState = {
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

function activateTab(idx: number): void {
  if (idx < 0 || idx >= S.tabs.length) return;
  if (F.open) closeFind();
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

function closeTab(idx: number): void {
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
async function openFilePath(fp: string): Promise<void> {
  const data = await window.api.loadMd(fp);
  if (data) createTab(data);
}

async function saveTab(): Promise<void> {
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

async function saveTabAs(): Promise<void> {
  const tab = getActive();
  if (!tab) return;
  const fp = await window.api.saveAs(tab.name, tab.content);
  if (!fp) return;
  if (tab.filePath && tab.filePath !== fp) window.api.unwatch(tab.filePath);
  tab.filePath = fp;
  tab.name = fp.split('/').pop()!;
  tab.savedContent = tab.content;
  tab.modified = false;
  updateTabLabel(tab);
  renderTabBar();
  updateStatus();
  showToast(`Saved as ${tab.name}`);
}

async function exportHTML(): Promise<void> {
  const tab = getActive();
  if (!tab) return;
  const hljsCSS = await fetch(`./lib/${S.theme === 'light' ? 'github' : 'github-dark'}.min.css`).then(r => r.text()).catch(() => '');
  const html = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>${tab.name.replace(/\.mdx?$/, '')}</title>\n<style>\nbody{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#1f2328;max-width:900px;margin:0 auto;padding:40px 40px 80px}h1,h2{border-bottom:1px solid #d0d7de;padding-bottom:.3em}h1,h2,h3,h4,h5,h6{font-weight:600;line-height:1.3;margin:1.5em 0 .5em}h1{font-size:2em;margin-top:0}h2{font-size:1.5em}h3{font-size:1.25em}a{color:#0969da}code{font-family:monospace;font-size:.875em;background:#f6f8fa;border:1px solid #d0d7de;border-radius:4px;padding:.15em .4em}pre{background:#f6f8fa;border:1px solid #d0d7de;border-radius:8px;padding:16px;overflow-x:auto}pre code{background:none;border:none;padding:0}table{width:100%;border-collapse:collapse;margin-bottom:1em}th,td{border:1px solid #d0d7de;padding:7px 12px;text-align:left}th{background:#f6f8fa;font-weight:600}blockquote{border-left:4px solid #0969da;background:rgba(9,105,218,.06);padding:10px 16px;margin:0 0 1em;border-radius:0 6px 6px 0;color:#636c76}blockquote p{margin:0}img{max-width:100%;border-radius:6px}hr{border:none;border-top:1px solid #d0d7de;margin:2em 0}\n${hljsCSS}\n</style>\n</head>\n<body>\n${$('md').innerHTML}\n</body>\n</html>`;
  const fp = await window.api.exportHtml(tab.name, html);
  if (fp) showToast(`Exported to ${fp.split('/').pop()}`);
}

// ─── File change handling ─────────────────────────────────
function handleFileChanged({ filePath, content }: { filePath: string; content: string }): void {
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
function toggleWidth(): void {
  S.wide = !S.wide;
  $('wrap').classList.toggle('wide', S.wide);
  $('icon-narrow').style.display = S.wide ? 'none' : '';
  $('icon-wide').style.display   = S.wide ? '' : 'none';
}

function adjustZoom(delta: number): void {
  if (delta === 0) { S.zoom = 1; $('wrap').style.fontSize = ''; return; }
  S.zoom = Math.max(0.6, Math.min(2.5, S.zoom + delta));
  $('wrap').style.fontSize = S.zoom + 'em';
}

// ─── Sidebar ──────────────────────────────────────────────
function toggleTOC(): void {
  S.tocOpen = !S.tocOpen;
  $('sidebar').classList.toggle('hidden', !S.tocOpen);
}

// ─── Status bar ───────────────────────────────────────────
function updateStatus(): void {
  const tab = getActive();
  if (!tab) { $('st-info').textContent = ''; $('st-mode').textContent = ''; $('st-file').textContent = ''; return; }
  const words = tab.content.trim() ? tab.content.trim().split(/\s+/).length : 0;
  const lines = tab.content.split('\n').length;
  $('st-info').textContent = `${words.toLocaleString()} words  ·  ${lines} lines`;
  $('st-mode').textContent = S.mode + (tab.modified ? '  ·  ●' : '');
  $('st-file').textContent = tab.filePath || '';
}

// ─── Toast ────────────────────────────────────────────────
function showToast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 220); }, 2200);
}

// ─── Recent files ─────────────────────────────────────────
function showRecentFiles(recent: string[]): void {
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
    btn.onclick = (): void => { openFilePath(fp); };
    list.appendChild(btn);
  });
}

// ─── Find in preview ──────────────────────────────────────
interface FindState {
  open: boolean;
  query: string;
  matches: HTMLElement[];
  idx: number;
  savedHTML: string;
}
const F: FindState = { open: false, query: '', matches: [], idx: 0, savedHTML: '' };

function openFind(): void {
  if (S.mode === 'edit') return;
  F.open = true;
  ($('find-bar') as HTMLElement).classList.remove('hidden');
  const inp = $('find-input') as HTMLInputElement;
  inp.value = F.query;
  inp.focus(); inp.select();
  if (F.query) _doFind(F.query);
}

function closeFind(): void {
  if (!F.open) return;
  F.open = false;
  ($('find-bar') as HTMLElement).classList.add('hidden');
  _clearFind();
}

function _clearFind(): void {
  // Clear scrollbar markers
  const track = $('find-scroll-marks') as HTMLElement;
  if (track) track.innerHTML = '';

  if (F.savedHTML) {
    ($('md') as HTMLElement).innerHTML = F.savedHTML;
    F.savedHTML = '';
    const tab = getActive();
    if (tab) reattachLinks(tab);
  }
  F.matches = []; F.idx = 0;
  ($('find-count') as HTMLElement).textContent = '';
  ($('find-input') as HTMLInputElement).classList.remove('no-match');
}

// Re-query live mark elements — avoids stale refs that cause navigation to break
function _liveFindMarks(): HTMLElement[] {
  return Array.from(($('md') as HTMLElement).querySelectorAll<HTMLElement>('mark.find-hit'));
}

function _buildScrollbarMarkers(): void {
  const track = $('find-scroll-marks') as HTMLElement;
  if (!track || !F.matches.length) return;
  track.innerHTML = '';
  const pp = $('preview-pane') as HTMLElement;
  const scrollH = pp.scrollHeight;
  if (scrollH <= pp.clientHeight) return;
  const ppRect = pp.getBoundingClientRect();
  F.matches.forEach((match, i) => {
    const mRect = match.getBoundingClientRect();
    const absTop = pp.scrollTop + mRect.top - ppRect.top;
    const pct = Math.min(99, Math.max(1, (absTop / scrollH) * 100));
    const dot = document.createElement('div');
    dot.className = `fsm${i === F.idx ? ' cur' : ''}`;
    dot.style.top = `${pct}%`;
    track.appendChild(dot);
  });
}

function _updateScrollbarCursor(): void {
  const track = $('find-scroll-marks') as HTMLElement;
  if (!track) return;
  track.querySelectorAll<HTMLElement>('.fsm').forEach((dot, i) => {
    dot.classList.toggle('cur', i === F.idx);
  });
}

function _highlightTextNodes(root: HTMLElement, regex: RegExp): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      const tag = (node as Text).parentElement?.tagName?.toLowerCase() ?? '';
      if (['script','style','code','pre','mark'].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);

  nodes.forEach(textNode => {
    const text = textNode.textContent ?? '';
    regex.lastIndex = 0;
    if (!regex.test(text)) return;
    regex.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const mark = document.createElement('mark');
      mark.className = 'find-hit';
      mark.textContent = m[0];
      frag.appendChild(mark);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode?.replaceChild(frag, textNode);
  });
}

function _doFind(query: string): void {
  const mdEl = $('md') as HTMLElement;
  // Always restore clean HTML before re-highlighting
  if (F.savedHTML) { mdEl.innerHTML = F.savedHTML; F.savedHTML = ''; const tab = getActive(); if (tab) reattachLinks(tab); }
  if (!query.trim()) {
    F.matches = [];
    ($('find-count') as HTMLElement).textContent = '';
    ($('find-input') as HTMLInputElement).classList.remove('no-match');
    ($('find-scroll-marks') as HTMLElement).innerHTML = '';
    return;
  }
  F.savedHTML = mdEl.innerHTML;
  try {
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    _highlightTextNodes(mdEl, regex);
  } catch (_) { return; }
  // Always re-query from live DOM after highlighting
  F.matches = _liveFindMarks();
  F.idx = 0;
  const inp = $('find-input') as HTMLInputElement;
  if (F.matches.length === 0) {
    inp.classList.add('no-match');
    ($('find-count') as HTMLElement).textContent = 'No results';
    ($('find-scroll-marks') as HTMLElement).innerHTML = '';
    return;
  }
  inp.classList.remove('no-match');
  _activateMatch(0);
  // Build scrollbar markers after first paint
  requestAnimationFrame(_buildScrollbarMarkers);
}

function _activateMatch(idx: number): void {
  // Re-query from live DOM every time — eliminates stale reference bugs
  F.matches = _liveFindMarks();
  if (!F.matches.length) return;

  // Safe modulo (handles any idx value)
  F.idx = ((idx % F.matches.length) + F.matches.length) % F.matches.length;

  F.matches.forEach(m => m.classList.remove('current'));
  const el = F.matches[F.idx];
  el.classList.add('current');

  // Use 'instant' instead of 'smooth' — avoids scroll-queue buildup on rapid clicks
  el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'nearest' });
  ($('find-count') as HTMLElement).textContent = `${F.idx + 1} of ${F.matches.length}`;

  _updateScrollbarCursor();
}

function findNext(): void {
  if (!F.matches.length && !_liveFindMarks().length) return;
  _activateMatch(F.idx + 1);
}
function findPrev(): void {
  if (!F.matches.length && !_liveFindMarks().length) return;
  _activateMatch(F.idx - 1);
}

// ─── Drag & drop ──────────────────────────────────────────
// Counter-based so nested-element enter/leave doesn't flicker
let _dragCount: number = 0;

document.addEventListener('dragenter', (e: DragEvent) => {
  _dragCount++;
  e.preventDefault();
  document.body.classList.add('drag-over');
});
document.addEventListener('dragleave', () => {
  _dragCount = Math.max(0, _dragCount - 1);
  if (!_dragCount) document.body.classList.remove('drag-over');
});
document.addEventListener('dragover', (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('drop', async (e: DragEvent) => {
  e.preventDefault();
  _dragCount = 0;
  document.body.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer?.files || []);
  for (const f of files) {
    if (!/\.(md|markdown|mdx)$/i.test(f.name)) continue;
    const fAny = f as File & { path?: string };
    if (fAny.path) {
      // Electron exposes .path on dropped File objects
      await openFilePath(fAny.path);
    } else {
      // Fallback: read via FileReader (e.g. when path is unavailable)
      try {
        const content = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = (ev: ProgressEvent<FileReader>): void => res(ev.target!.result as string);
          r.onerror = rej;
          r.readAsText(f);
        });
        createTab({ name: f.name, content, dir: '' });
      } catch (_) {}
    }
  }
});

// ─── Keyboard shortcuts ───────────────────────────────────
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key;
  if (k === 'f' || k === 'F')         { e.preventDefault(); F.open ? closeFind() : openFind(); }
  if (k === 'o' || k === 'O')         { e.preventDefault(); ($('btn-open') as HTMLButtonElement).click(); }
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
async function init(): Promise<void> {
  setTheme(S.theme);

  // Apply default wide mode
  ($('wrap') as HTMLElement).classList.add('wide');
  ($('icon-narrow') as HTMLElement).style.display = 'none';
  ($('icon-wide') as HTMLElement).style.display = '';

  // Wire up toolbar
  $('btn-toc').onclick     = toggleTOC;
  $('btn-new').onclick     = (): void => createTab({ name: 'Untitled', content: '', dir: '' });
  $('btn-open').onclick    = async (): Promise<void> => { const fs = await window.api.openFiles(); fs.forEach(f => createTab(f)); };
  $('btn-save').onclick    = saveTab;
  $('btn-width').onclick   = toggleWidth;
  $('btn-theme').onclick   = (): void => setTheme(S.theme === 'dark' ? 'light' : 'dark');
  $('btn-zm').onclick      = (): void => adjustZoom(-0.1);
  $('btn-zp').onclick      = (): void => adjustZoom(0.1);
  $('btn-new-tab').onclick = (): void => createTab({ name: 'Untitled', content: '', dir: '' });
  document.querySelectorAll('.mode-btn').forEach(b => (b as HTMLElement).onclick = (): void => setMode((b as HTMLElement).dataset.mode as ViewMode));

  // Find bar
  const findInp = $('find-input') as HTMLInputElement;
  findInp.addEventListener('input', () => { F.query = findInp.value; _doFind(F.query); });
  findInp.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter')     { e.shiftKey ? findPrev() : findNext(); }
    if (e.key === 'Escape')    { closeFind(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); findNext(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); findPrev(); }
  });
  ($('find-prev') as HTMLElement).onclick  = findPrev;
  ($('find-next') as HTMLElement).onclick  = findNext;
  ($('find-close') as HTMLElement).onclick = closeFind;

  $('btn-reload').onclick = (): void => {
    const tab = getActive();
    if (!tab?.pendingDiskContent) return;
    tab.content = tab.pendingDiskContent; tab.savedContent = tab.pendingDiskContent;
    tab.modified = false; tab.diskChanged = false; tab.pendingDiskContent = null;
    if (tab.cm) { tab.cm.setValue(tab.content); }
    renderContent(tab);
    $('reload-bar').classList.add('hidden');
    updateTabLabel(tab); updateStatus();
  };
  $('btn-dismiss').onclick = (): void => {
    const tab = getActive();
    if (tab) tab.diskChanged = false;
    $('reload-bar').classList.add('hidden');
  };

  // IPC
  window.api.onFileChanged(handleFileChanged);
  // Triggered when a second app instance hands off a file (single-instance lock)
  window.api.onOpenTab((data: FileData) => {
    createTab(data); // createTab already deduplicates by filePath
  });
  window.api.onMenu((action: string, ...args: unknown[]) => {
    switch (action) {
      case 'new':          createTab({ name: 'Untitled', content: '', dir: '' }); break;
      case 'open':         $('btn-open').click(); break;
      case 'save':         saveTab(); break;
      case 'save-as':      saveTabAs(); break;
      case 'export-html':  exportHTML(); break;
      case 'close-tab':    { const t = getActive(); if (t) closeTab(S.activeIdx); } break;
      case 'find':         F.open ? closeFind() : openFind(); break;
      case 'toggle-toc':   toggleTOC(); break;
      case 'toggle-width': toggleWidth(); break;
      case 'theme':        setTheme(S.theme === 'dark' ? 'light' : 'dark'); break;
      case 'mode':         setMode(args[0] as ViewMode); break;
      case 'zoom':         (args[0] as number) === 0 ? adjustZoom(0) : adjustZoom((args[0] as number) * 0.1); break;
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
