#!/usr/bin/env bash
# Serves the pre-built File Search app over a local static server.
#
# Why this is needed instead of just double-clicking index.html: the app
# loads its Web Worker and JS modules via the ES module system, which
# Chrome/Edge refuse to run from a file:// URL (CORS blocks module loading
# from a null origin). Any plain static file server works — this script
# just finds one that's already on your machine.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8080}"

echo "File Search — starting a local server on http://localhost:$PORT"
echo "Open that URL in Chrome or Edge. Press Ctrl+C to stop."
echo

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -l "$PORT" .
else
  echo "No Python or Node/npx found. Install either one, or serve this folder" >&2
  echo "with any static file server of your choice." >&2
  exit 1
fi
