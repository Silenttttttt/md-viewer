#!/usr/bin/env bash
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB="$APP_DIR/lib"

echo "═══ MDViewer Setup ═══"
mkdir -p "$LIB"

dl() {
  local name="$1" url="$2"
  if [ -f "$LIB/$name" ]; then
    echo "  ✓ $name (cached)"
  else
    printf "  ↓ %-32s ... " "$name"
    curl -sSL "$url" -o "$LIB/$name" && echo "done" || { echo "FAILED"; exit 1; }
  fi
}

echo ""
echo "Downloading libraries:"

# Markdown parser
dl "marked.umd.js"        "https://cdn.jsdelivr.net/npm/marked@15/lib/marked.umd.js"

# Diagram support
dl "mermaid.min.js"       "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"

# Syntax highlighting
dl "highlight.min.js"     "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"
dl "github-dark.min.css"  "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css"
dl "github.min.css"       "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css"

# CodeMirror 5 editor
CM="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16"
dl "codemirror.min.js"    "$CM/codemirror.min.js"
dl "codemirror.min.css"   "$CM/codemirror.min.css"
dl "cm-xml.js"            "$CM/mode/xml/xml.min.js"
dl "cm-javascript.js"     "$CM/mode/javascript/javascript.min.js"
dl "cm-overlay.js"        "$CM/addon/mode/overlay.min.js"
dl "cm-markdown.js"       "$CM/mode/markdown/markdown.min.js"
dl "cm-searchcursor.js"   "$CM/addon/search/searchcursor.min.js"
dl "cm-search.js"         "$CM/addon/search/search.min.js"
dl "cm-dialog.js"         "$CM/addon/dialog/dialog.min.js"
dl "cm-dialog.css"        "$CM/addon/dialog/dialog.min.css"

echo ""
echo "Installing desktop entry:"
mkdir -p ~/.local/share/applications
cat > ~/.local/share/applications/mdviewer.desktop << EOF
[Desktop Entry]
Name=md-viewer
GenericName=Markdown Viewer
Comment=Fast markdown viewer and editor with tabs, Mermaid, and live reload
Exec=/usr/bin/electron $APP_DIR %f
Icon=text-x-markdown
Type=Application
Categories=Utility;Viewer;TextEditor;
MimeType=text/markdown;text/x-markdown;
StartupNotify=true
Keywords=markdown;md;viewer;editor;mermaid;
EOF
echo "  ✓ ~/.local/share/applications/mdviewer.desktop"

echo ""
echo "Registering MIME types:"
xdg-mime default mdviewer.desktop text/markdown      && echo "  ✓ text/markdown"
xdg-mime default mdviewer.desktop text/x-markdown    && echo "  ✓ text/x-markdown"
update-desktop-database ~/.local/share/applications/ 2>/dev/null && echo "  ✓ desktop database" || true

mkdir -p ~/.local/share/mime/packages
cat > ~/.local/share/mime/packages/text-markdown.xml << 'MIME'
<?xml version="1.0"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="text/markdown">
    <comment>Markdown document</comment>
    <glob pattern="*.md"/>
    <glob pattern="*.markdown"/>
    <glob pattern="*.mdx"/>
  </mime-type>
</mime-info>
MIME
update-mime-database ~/.local/share/mime 2>/dev/null || true
xdg-mime default mdviewer.desktop text/markdown 2>/dev/null || true

echo ""
echo "═══════════════════════════"
echo "  MDViewer is ready!"
echo ""
echo "  Run:  electron $APP_DIR [file.md]"
echo "  Or double-click any .md file"
echo "═══════════════════════════"
