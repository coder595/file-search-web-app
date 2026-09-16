#!/usr/bin/env bash
# Builds the app and packages the static output into a portable zip that
# runs on Linux, Windows, or macOS with no `npm install` step — just Python
# or Node already on the machine (see run.sh/run.bat for why a static
# server is needed instead of opening index.html directly).
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
OUT_DIR="portable-build"
ZIP_NAME="file-search-web-app-${VERSION}.zip"

echo "Building production bundle..."
npm run build

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp -r dist/* "$OUT_DIR/"
cp scripts/run.sh scripts/run.bat "$OUT_DIR/"
chmod +x "$OUT_DIR/run.sh"

cat > "$OUT_DIR/RUN.txt" <<'EOF'
File Search — portable build

1. Linux/macOS: open a terminal here and run ./run.sh
   Windows:      double-click run.bat (or run it from a terminal)
2. Open http://localhost:8080 in Chrome or Edge.
3. Firefox/Safari also work, in read-only fallback mode (see the README
   on the project's GitHub page for details).

Requires Python 3 (usually already installed on Linux/macOS) or Node.js —
either one is enough to serve these static files locally. No other setup,
no npm install, no build step.
EOF

(cd "$OUT_DIR" && zip -qr "../${ZIP_NAME}" .)
rm -rf "$OUT_DIR"

echo "Done: ${ZIP_NAME}"
