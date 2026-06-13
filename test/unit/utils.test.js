/**
 * Unit tests for pure utility functions extracted from renderer.js.
 * These run in a Node.js environment with no DOM or Electron.
 */

// ─── Replicate the pure functions under test ──────────────
// (kept in sync with renderer.js — if you change the logic there, update here)

function countWords(text) {
  if (!text?.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function generateHeadingId(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '').trim()
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isMarkdownFile(name) {
  return /\.(md|markdown|mdx)$/i.test(name);
}

function isExternalLink(href) {
  return /^https?:|^mailto:|^ftp:/.test(href);
}

function resolveFilePath(dir, href) {
  if (!href) return href;
  if (/^(https?:|mailto:|ftp:|file:\/\/|\/)/.test(href)) return href;
  return dir ? `${dir}/${href}` : href;
}

function parseAdmonitionType(text) {
  const m = text?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
  return m ? m[1].toLowerCase() : null;
}

// ─── countWords ───────────────────────────────────────────
describe('countWords', () => {
  test('returns 0 for empty string', ()        => expect(countWords('')).toBe(0));
  test('returns 0 for null',         ()        => expect(countWords(null)).toBe(0));
  test('returns 0 for whitespace',   ()        => expect(countWords('   \n\t  ')).toBe(0));
  test('counts a single word',       ()        => expect(countWords('hello')).toBe(1));
  test('counts two words',           ()        => expect(countWords('hello world')).toBe(2));
  test('ignores extra whitespace',   ()        => expect(countWords('  a  b  c  ')).toBe(3));
  test('counts newline-separated',   ()        => expect(countWords('one\ntwo\nthree')).toBe(3));
  test('counts a long sentence',     () => {
    const sentence = 'The quick brown fox jumps over the lazy dog';
    expect(countWords(sentence)).toBe(9);
  });
  test('handles markdown headings',  () => {
    // '#' counts as a token: #, Hello, World, This, is, a, paragraph. = 7
    expect(countWords('# Hello World\n\nThis is a paragraph.')).toBe(7);
  });
});

// ─── generateHeadingId ────────────────────────────────────
describe('generateHeadingId', () => {
  test('lowercases',                 ()  => expect(generateHeadingId('HELLO')).toBe('hello'));
  test('replaces spaces with hyphens', () => expect(generateHeadingId('Hello World')).toBe('hello-world'));
  test('removes punctuation',        ()  => expect(generateHeadingId('Hello, World!')).toBe('hello-world'));
  test('collapses multiple spaces',  ()  => expect(generateHeadingId('a  b   c')).toBe('a-b-c'));
  test('trims leading hyphens',      ()  => expect(generateHeadingId('!Hello')).toBe('hello'));
  test('trims trailing hyphens',     ()  => expect(generateHeadingId('Hello!')).toBe('hello'));
  test('preserves existing hyphens', ()  => expect(generateHeadingId('my-heading')).toBe('my-heading'));
  test('preserves numbers',          ()  => expect(generateHeadingId('Section 1.2')).toBe('section-12'));
  test('handles code in headings',   ()  => expect(generateHeadingId('Using `console.log`')).toBe('using-consolelog'));
  test('empty string → empty',       ()  => expect(generateHeadingId('')).toBe(''));
  test('all-special → empty',        ()  => expect(generateHeadingId('!@#$%')).toBe(''));
});

// ─── isMarkdownFile ───────────────────────────────────────
describe('isMarkdownFile', () => {
  test('.md → true',                   () => expect(isMarkdownFile('readme.md')).toBe(true));
  test('.markdown → true',             () => expect(isMarkdownFile('notes.markdown')).toBe(true));
  test('.mdx → true',                  () => expect(isMarkdownFile('page.mdx')).toBe(true));
  test('.MD (uppercase) → true',       () => expect(isMarkdownFile('DOC.MD')).toBe(true));
  test('.txt → false',                 () => expect(isMarkdownFile('notes.txt')).toBe(false));
  test('.html → false',                () => expect(isMarkdownFile('page.html')).toBe(false));
  test('.js → false',                  () => expect(isMarkdownFile('app.js')).toBe(false));
  test('no extension → false',         () => expect(isMarkdownFile('Makefile')).toBe(false));
  test('path with .md file → true',    () => expect(isMarkdownFile('/docs/guide.md')).toBe(true));
  test('.md.bak → false',              () => expect(isMarkdownFile('file.md.bak')).toBe(false));
});

// ─── isExternalLink ───────────────────────────────────────
describe('isExternalLink', () => {
  test('https → true',                 () => expect(isExternalLink('https://example.com')).toBe(true));
  test('http → true',                  () => expect(isExternalLink('http://example.com')).toBe(true));
  test('mailto → true',                () => expect(isExternalLink('mailto:user@example.com')).toBe(true));
  test('ftp → true',                   () => expect(isExternalLink('ftp://files.example.com')).toBe(true));
  test('relative path → false',        () => expect(isExternalLink('./local.md')).toBe(false));
  test('absolute path → false',        () => expect(isExternalLink('/absolute/path.md')).toBe(false));
  test('anchor → false',               () => expect(isExternalLink('#section')).toBe(false));
  test('bare filename → false',        () => expect(isExternalLink('readme.md')).toBe(false));
  test('parent path → false',          () => expect(isExternalLink('../other.md')).toBe(false));
});

// ─── resolveFilePath ──────────────────────────────────────
describe('resolveFilePath', () => {
  test('resolves relative to dir',     () => expect(resolveFilePath('/docs', 'readme.md')).toBe('/docs/readme.md'));
  test('nested relative path',         () => expect(resolveFilePath('/a/b', 'c/d.md')).toBe('/a/b/c/d.md'));
  test('absolute path → unchanged',    () => expect(resolveFilePath('/docs', '/abs.md')).toBe('/abs.md'));
  test('https → unchanged',            () => expect(resolveFilePath('/docs', 'https://example.com')).toBe('https://example.com'));
  test('mailto → unchanged',           () => expect(resolveFilePath('/docs', 'mailto:a@b.com')).toBe('mailto:a@b.com'));
  test('file:// → unchanged',          () => expect(resolveFilePath('/docs', 'file:///x.md')).toBe('file:///x.md'));
  test('empty dir → bare href',        () => expect(resolveFilePath('', 'file.md')).toBe('file.md'));
  test('null href → null',             () => expect(resolveFilePath('/docs', null)).toBeNull());
});

// ─── parseAdmonitionType ──────────────────────────────────
describe('parseAdmonitionType', () => {
  test('[!NOTE] → note',               () => expect(parseAdmonitionType('[!NOTE]')).toBe('note'));
  test('[!TIP] → tip',                 () => expect(parseAdmonitionType('[!TIP]')).toBe('tip'));
  test('[!WARNING] → warning',         () => expect(parseAdmonitionType('[!WARNING]')).toBe('warning'));
  test('[!IMPORTANT] → important',     () => expect(parseAdmonitionType('[!IMPORTANT]')).toBe('important'));
  test('[!CAUTION] → caution',         () => expect(parseAdmonitionType('[!CAUTION]')).toBe('caution'));
  test('case-insensitive [!note]',     () => expect(parseAdmonitionType('[!note]')).toBe('note'));
  test('[!note] with trailing text',   () => expect(parseAdmonitionType('[!NOTE] Hello')).toBe('note'));
  test('no match → null',              () => expect(parseAdmonitionType('regular text')).toBeNull());
  test('[!INVALID] → null',            () => expect(parseAdmonitionType('[!INVALID]')).toBeNull());
  test('null → null',                  () => expect(parseAdmonitionType(null)).toBeNull());
  test('empty → null',                 () => expect(parseAdmonitionType('')).toBeNull());
});
