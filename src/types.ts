// Shared type declarations for MDViewer
// Used in module:"none" context for the renderer — no import/export.

// ── Domain types ───────────────────────────────────────────

interface FileData {
  filePath: string;
  dir: string;
  name: string;
  content: string;
}

interface InitialData {
  files: FileData[];
  recent: string[];
}

type ViewMode = 'preview' | 'edit' | 'split';
type Theme = 'dark' | 'light';

interface TabState {
  id: number;
  filePath: string | null;
  name: string;
  content: string;
  savedContent: string;
  modified: boolean;
  diskChanged: boolean;
  pendingDiskContent: string | null;
  dir: string;
  cm: CodeMirrorEditor | null;
  cmEl: HTMLElement | null;
  previewScroll: number;
}

interface AppState {
  tabs: TabState[];
  activeIdx: number;
  mode: ViewMode;
  theme: Theme;
  zoom: number;
  tocOpen: boolean;
  wide: boolean;
  mermaidLoaded: boolean;
  tocObserver: IntersectionObserver | null;
}

// ── Renderer API (window.api) ──────────────────────────────

interface MDViewerAPI {
  getInitial: () => Promise<InitialData>;
  openFiles: () => Promise<FileData[]>;
  loadMd: (fp: string) => Promise<FileData | null>;
  saveFile: (fp: string, content: string) => Promise<boolean>;
  saveAs: (name: string, content: string) => Promise<string | null>;
  exportHtml: (name: string, html: string) => Promise<string | null>;
  unwatch: (fp: string) => Promise<void>;
  getRecent: () => Promise<string[]>;
  openExternal: (url: string) => Promise<void>;
  openPath: (p: string) => Promise<void>;

  onFileChanged: (cb: (data: { filePath: string; content: string }) => void) => void;
  onMenu: (cb: (action: string, ...args: unknown[]) => void) => void;
}

// ── Window extension ───────────────────────────────────────

interface Window {
  api: MDViewerAPI;
}

// ── CodeMirror editor (minimal surface used by renderer) ──

interface CodeMirrorCursor {
  line: number;
  ch: number;
}

interface CodeMirrorScrollInfo {
  top: number;
  left: number;
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
}

interface CodeMirrorEditor {
  getValue(): string;
  setValue(content: string): void;
  getCursor(): CodeMirrorCursor;
  setCursor(pos: CodeMirrorCursor | { line: number; ch: number }): void;
  getScrollInfo(): CodeMirrorScrollInfo;
  scrollTo(x: number | null, y: number | null): void;
  refresh(): void;
  focus(): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

// ── CodeMirror constructor (global) ──────────────────────

declare function CodeMirror(
  element: HTMLElement,
  options: {
    value?: string;
    mode?: unknown;
    theme?: string;
    lineNumbers?: boolean;
    lineWrapping?: boolean;
    autofocus?: boolean;
    tabSize?: number;
    indentWithTabs?: boolean;
    extraKeys?: Record<string, string | (() => void)>;
  }
): CodeMirrorEditor;

// ── marked (CDN global) ──────────────────────────────────

declare const marked: {
  parse(src: string, options?: { gfm?: boolean; breaks?: boolean }): string;
};

// ── highlight.js (CDN global) ────────────────────────────

declare const hljs: {
  highlightElement(block: HTMLElement): void;
};

// ── mermaid (lazy-loaded CDN global) ────────────────────

declare const mermaid: {
  initialize(config: {
    startOnLoad: boolean;
    theme: string;
    securityLevel: string;
    fontFamily?: string;
  }): void;
  run(options: { querySelector: string }): Promise<void>;
};
