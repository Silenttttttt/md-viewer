# MDViewer

A fast, beautiful Markdown viewer and editor for Linux. Built with Electron — opens as your default app for `.md` files.

![MDViewer screenshot](https://raw.githubusercontent.com/Silenttttttt/mdviewer/main/assets/screenshot.png)

## Features

- **Tabbed interface** — open multiple files at once, middle-click or `Ctrl+W` to close
- **Three modes** — Preview, Edit (CodeMirror), and Split (live preview as you type)
- **Full Markdown** — GFM tables, task lists, strikethrough, footnotes, autolinks
- **Mermaid diagrams** — flowcharts, sequence diagrams, ER diagrams, etc.
- **Syntax highlighting** — 100+ languages via highlight.js
- **GitHub-style admonitions** — `[!NOTE]`, `[!WARNING]`, `[!TIP]`, `[!IMPORTANT]`, `[!CAUTION]`
- **Auto-reload** — silently reloads when the file changes on disk; shows a banner if you have unsaved edits
- **Width toggle** — narrow (centered prose column) or wide (full pane), `Ctrl+Shift+W`
- **Dark / Light theme** — follows system preference, toggleable
- **TOC sidebar** — auto-generated from headings with scroll-spy
- **Drag & drop** — drop any `.md` file onto the window to open it
- **Recent files** — shown in the empty state
- **Export as HTML** — self-contained HTML file with styles and syntax highlighting embedded
- **Zoom** — `Ctrl+=` / `Ctrl+-` / `Ctrl+0`
- **Copy button** on every code block
- **Scrollable tables** — wide tables scroll horizontally, numbers never wrap
- **Print-ready** — `Ctrl+P` hides UI chrome

## Installation

### 1. Clone

```bash
git clone https://github.com/Silenttttttt/mdviewer.git
cd mdviewer
```

### 2. Run setup

Downloads the JS libraries and registers the app as the default handler for `.md` files:

```bash
bash setup.sh
```

This downloads (once, cached afterwards):
- [marked](https://marked.js.org/) — Markdown parser
- [mermaid](https://mermaid.js.org/) — diagram renderer
- [highlight.js](https://highlightjs.org/) — syntax highlighting
- [CodeMirror 5](https://codemirror.net/5/) — editor

### 3. Open a file

```bash
electron /path/to/mdviewer file.md
```

Or just double-click any `.md` file in your file manager.

## Requirements

- **Electron** — `pacman -S electron` (or your distro's equivalent)
- **xdg-utils** — for MIME type registration (usually pre-installed)

> Tested on Manjaro Linux with Electron 39 and Node 25.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+O` | Open file |
| `Ctrl+N` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+Shift+E` | Export as HTML |
| `Ctrl+1` | Preview mode |
| `Ctrl+2` | Edit mode |
| `Ctrl+3` | Split mode |
| `Ctrl+\` | Toggle TOC sidebar |
| `Ctrl+Shift+W` | Toggle content width |
| `Ctrl+Shift+T` | Toggle theme |
| `Ctrl+F` | Find (editor) |
| `Ctrl+=` / `Ctrl+-` | Zoom in / out |
| `Ctrl+0` | Reset zoom |
| `Ctrl+PageDown/Up` | Next / previous tab |

## Development

```bash
# Install dev dependencies (Jest for tests)
npm install

# Run unit + DOM tests (113 tests, ~1s)
npm test

# Watch mode
npm run test:watch

# E2E tests (launches real Electron — run when you have a display)
npm run test:e2e
```

## Project Structure

```
mdviewer/
├── main.js          — Electron main process (IPC, file I/O, menus)
├── preload.js       — Context bridge (exposes safe APIs to renderer)
├── renderer.html    — App shell (HTML structure)
├── renderer.css     — All styles (dark + light themes, CodeMirror theme)
├── renderer.js      — Renderer logic (tabs, rendering, editor, drag/drop)
├── setup.sh         — One-time setup: downloads libs, registers MIME type
├── lib/             — Downloaded JS libraries (gitignored)
├── test/
│   ├── unit/        — Pure function tests (Jest, Node env)
│   ├── dom/         — DOM manipulation tests (Jest, jsdom)
│   ├── e2e/         — End-to-end tests (Playwright + Electron)
│   └── fixtures/    — Sample .md file for tests
└── package.json
```

## License

MIT
