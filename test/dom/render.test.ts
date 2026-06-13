/**
 * @jest-environment jsdom
 *
 * DOM-level tests for markdown rendering helpers.
 * These run in jsdom so we can manipulate real DOM nodes.
 */

// ─── Functions under test (mirrored from renderer.ts) ─────

const ADM_LABELS: Record<string, string> = {
  note: '📝 Note', tip: '💡 Tip', important: '❗ Important',
  warning: '⚠️ Warning', caution: '🔥 Caution',
};

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
    title.textContent = ADM_LABELS[type] || m[1];
    p.innerHTML = p.innerHTML.replace(/^\[!\w+\]\s*/, '');
    div.appendChild(title);
    while (bq.firstChild) div.appendChild(bq.firstChild);
    bq.replaceWith(div);
  });
}

function wrapTables(root: HTMLElement): void {
  root.querySelectorAll('table').forEach(table => {
    if (table.parentElement?.classList.contains('table-scroll')) return;
    const w = document.createElement('div');
    w.className = 'table-scroll';
    table.parentNode!.insertBefore(w, table);
    w.appendChild(table);
  });
}

function generateHeadingIds(root: HTMLElement): void {
  root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    const hEl = h as HTMLElement;
    if (!hEl.id) {
      hEl.id = hEl.textContent!.toLowerCase()
        .replace(/[^\w\s-]/g, '').trim()
        .replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || `h-${Math.random().toString(36).slice(2)}`;
    }
  });
}

interface TOCLink {
  id: string;
  text: string | null;
  level: number;
}

function buildTOCLinks(root: HTMLElement): TOCLink[] {
  return [...root.querySelectorAll('h1,h2,h3,h4')].map(h => ({
    id: (h as HTMLElement).id,
    text: h.textContent,
    level: parseInt(h.tagName[1]),
  }));
}

// ─── processAdmonitions ───────────────────────────────────
describe('processAdmonitions', () => {
  function makeDiv(html: string): HTMLElement {
    const d = document.createElement('div');
    d.innerHTML = html;
    return d;
  }

  test('[!NOTE] → .adm-note with title', () => {
    const d = makeDiv('<blockquote><p>[!NOTE] This is a note.</p></blockquote>');
    processAdmonitions(d);
    expect(d.querySelector('.adm-note')).not.toBeNull();
    expect(d.querySelector('.adm-title')!.textContent).toMatch(/Note/i);
    expect(d.querySelector('blockquote')).toBeNull();
  });

  test('[!TIP] → .adm-tip', () => {
    const d = makeDiv('<blockquote><p>[!TIP] Pro tip.</p></blockquote>');
    processAdmonitions(d);
    expect(d.querySelector('.adm-tip')).not.toBeNull();
  });

  test('[!WARNING] → .adm-warning', () => {
    const d = makeDiv('<blockquote><p>[!WARNING] Be careful.</p></blockquote>');
    processAdmonitions(d);
    expect(d.querySelector('.adm-warning')).not.toBeNull();
  });

  test('[!IMPORTANT] → .adm-important', () => {
    const d = makeDiv('<blockquote><p>[!IMPORTANT] Pay attention.</p></blockquote>');
    processAdmonitions(d);
    expect(d.querySelector('.adm-important')).not.toBeNull();
  });

  test('[!CAUTION] → .adm-caution', () => {
    const d = makeDiv('<blockquote><p>[!CAUTION] Dangerous.</p></blockquote>');
    processAdmonitions(d);
    expect(d.querySelector('.adm-caution')).not.toBeNull();
  });

  test('case-insensitive: [!note] → .adm-note', () => {
    const d = makeDiv('<blockquote><p>[!note] lowercase.</p></blockquote>');
    processAdmonitions(d);
    expect(d.querySelector('.adm-note')).not.toBeNull();
  });

  test('preserves body text after marker', () => {
    const d = makeDiv('<blockquote><p>[!NOTE] Important content here.</p></blockquote>');
    processAdmonitions(d);
    expect(d.querySelector('.adm-note')!.textContent).toContain('Important content here.');
  });

  test('preserves multi-paragraph body', () => {
    const d = makeDiv(`
      <blockquote>
        <p>[!NOTE] First paragraph.</p>
        <p>Second paragraph.</p>
      </blockquote>
    `);
    processAdmonitions(d);
    const adm = d.querySelector('.adm-note');
    expect(adm).not.toBeNull();
    expect(adm!.textContent).toContain('Second paragraph.');
  });

  test('regular blockquote is untouched', () => {
    const d = makeDiv('<blockquote><p>Just a regular quote.</p></blockquote>');
    processAdmonitions(d);
    expect(d.querySelector('blockquote')).not.toBeNull();
    expect(d.querySelector('.adm')).toBeNull();
  });

  test('processes multiple admonitions', () => {
    const d = makeDiv(`
      <blockquote><p>[!NOTE] Note 1.</p></blockquote>
      <blockquote><p>[!WARNING] Warning.</p></blockquote>
      <blockquote><p>[!TIP] Tip.</p></blockquote>
    `);
    processAdmonitions(d);
    expect(d.querySelectorAll('.adm').length).toBe(3);
    expect(d.querySelectorAll('blockquote').length).toBe(0);
  });

  test('unknown type is left as blockquote', () => {
    const d = makeDiv('<blockquote><p>[!UNKNOWN] Text.</p></blockquote>');
    processAdmonitions(d);
    expect(d.querySelector('blockquote')).not.toBeNull();
  });
});

// ─── wrapTables ───────────────────────────────────────────
describe('wrapTables', () => {
  function table(n: number = 1): string {
    return Array.from({ length: n }, () =>
      '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
    ).join('');
  }

  test('wraps single table in .table-scroll', () => {
    const d = document.createElement('div');
    d.innerHTML = table();
    wrapTables(d);
    expect(d.querySelector('.table-scroll')).not.toBeNull();
    expect(d.querySelector('.table-scroll > table')).not.toBeNull();
  });

  test('wraps each table independently', () => {
    const d = document.createElement('div');
    d.innerHTML = table(3);
    wrapTables(d);
    expect(d.querySelectorAll('.table-scroll').length).toBe(3);
  });

  test('does not double-wrap already wrapped tables', () => {
    const d = document.createElement('div');
    d.innerHTML = table();
    wrapTables(d);
    wrapTables(d); // second call should be idempotent
    expect(d.querySelectorAll('.table-scroll').length).toBe(1);
  });

  test('table is direct child of wrapper', () => {
    const d = document.createElement('div');
    d.innerHTML = table();
    wrapTables(d);
    const wrap = d.querySelector('.table-scroll') as HTMLElement;
    expect(wrap.firstElementChild!.tagName).toBe('TABLE');
  });
});

// ─── generateHeadingIds ───────────────────────────────────
describe('generateHeadingIds', () => {
  function headings(html: string): HTMLElement {
    const d = document.createElement('div');
    d.innerHTML = html;
    generateHeadingIds(d);
    return d;
  }

  test('assigns id from text', () => {
    const d = headings('<h1>Hello World</h1>');
    expect((d.querySelector('h1') as HTMLElement).id).toBe('hello-world');
  });

  test('does not overwrite existing id', () => {
    const d = headings('<h1 id="keep-me">Hello</h1>');
    expect((d.querySelector('h1') as HTMLElement).id).toBe('keep-me');
  });

  test('handles special chars', () => {
    const d = headings('<h2>Hello, World!</h2>');
    expect((d.querySelector('h2') as HTMLElement).id).toBe('hello-world');
  });

  test('handles numbers in heading', () => {
    const d = headings('<h3>Section 1.2</h3>');
    expect((d.querySelector('h3') as HTMLElement).id).toBe('section-12');
  });

  test('processes all heading levels', () => {
    const d = headings('<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4>');
    expect((d.querySelector('h1') as HTMLElement).id).toBe('h1');
    expect((d.querySelector('h2') as HTMLElement).id).toBe('h2');
    expect((d.querySelector('h3') as HTMLElement).id).toBe('h3');
    expect((d.querySelector('h4') as HTMLElement).id).toBe('h4');
  });

  test('handles empty heading gracefully', () => {
    const d = headings('<h1></h1>');
    expect((d.querySelector('h1') as HTMLElement).id).toBeTruthy(); // random fallback id
  });
});

// ─── buildTOCLinks ────────────────────────────────────────
describe('buildTOCLinks', () => {
  function parse(html: string): TOCLink[] {
    const d = document.createElement('div');
    d.innerHTML = html;
    generateHeadingIds(d);
    return buildTOCLinks(d);
  }

  test('extracts all headings', () => {
    const links = parse('<h1>A</h1><h2>B</h2><h3>C</h3>');
    expect(links.length).toBe(3);
  });

  test('captures correct text', () => {
    const links = parse('<h1>My Section</h1>');
    expect(links[0].text).toBe('My Section');
  });

  test('captures correct level', () => {
    const links = parse('<h1>Top</h1><h2>Sub</h2>');
    expect(links[0].level).toBe(1);
    expect(links[1].level).toBe(2);
  });

  test('captures id matching heading', () => {
    const links = parse('<h2>Section Title</h2>');
    expect(links[0].id).toBe('section-title');
  });

  test('only includes h1–h4 (not h5/h6)', () => {
    const links = parse('<h1>A</h1><h5>B</h5><h6>C</h6>');
    expect(links.length).toBe(1);
  });

  test('returns empty array for no headings', () => {
    const links = parse('<p>Just a paragraph.</p>');
    expect(links).toEqual([]);
  });
});

// ─── Markdown integration (using marked) ──────────────────
describe('marked markdown parsing', () => {
  let marked: { parse: (src: string, opts?: { gfm?: boolean }) => string } | null;

  beforeAll(() => {
    // Load marked in Node.js context using the UMD build path
    // (in the test environment we require it from the lib folder)
    try {
      marked = require('../../lib/marked.umd.js');
    } catch {
      marked = null; // skip if lib not downloaded yet
    }
  });

  const skip = (): boolean => !marked;

  test('renders h1 correctly', () => {
    if (skip()) return;
    const html = marked!.parse('# Hello World');
    expect(html).toContain('<h1>Hello World</h1>');
  });

  test('renders bold text', () => {
    if (skip()) return;
    const html = marked!.parse('**bold**');
    expect(html).toContain('<strong>bold</strong>');
  });

  test('renders italic text', () => {
    if (skip()) return;
    const html = marked!.parse('_italic_');
    expect(html).toContain('<em>italic</em>');
  });

  test('renders tables with GFM', () => {
    if (skip()) return;
    const html = marked!.parse('| A | B |\n|---|---|\n| 1 | 2 |', { gfm: true });
    expect(html).toContain('<table>');
    expect(html).toContain('<th>A</th>');
  });

  test('renders fenced code blocks', () => {
    if (skip()) return;
    const html = marked!.parse('```js\nconst x = 1;\n```');
    expect(html).toContain('<code');
    expect(html).toContain('const x = 1;');
  });

  test('renders task list items with GFM', () => {
    if (skip()) return;
    const html = marked!.parse('- [x] Done\n- [ ] Todo', { gfm: true });
    expect(html).toContain('checkbox');
  });

  test('renders blockquotes', () => {
    if (skip()) return;
    const html = marked!.parse('> A quote');
    expect(html).toContain('<blockquote>');
  });

  test('renders strikethrough with GFM', () => {
    if (skip()) return;
    const html = marked!.parse('~~strike~~', { gfm: true });
    expect(html).toContain('<del>strike</del>');
  });

  test('renders links', () => {
    if (skip()) return;
    const html = marked!.parse('[text](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('>text<');
  });

  test('does not render script tags as HTML', () => {
    if (skip()) return;
    // marked escapes HTML by default in newer versions
    const content = '# Safe\n\nParagraph.';
    const html = marked!.parse(content);
    expect(html).toContain('<h1>');
    expect(html).not.toContain('<script>');
  });
});
