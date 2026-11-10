#!/usr/bin/env bash
# Sync the companion editor source from the Slide-Editor checkout and refresh the bundled build.
# Usage: python3 scripts/sync-editor.sh [SOURCE_DIR]   (SOURCE_DIR defaults to ~/Desktop/Slide-Editor)
set -euo pipefail

SRC="${1:-$HOME/Desktop/Slide-Editor}"
DST="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$SRC/src" ]; then
  echo "sync-editor: no Slide-Editor checkout at $SRC" >&2
  exit 1
fi

mkdir -p "$DST/editor/src" "$DST/editor/test" "$DST/editor/fixtures/synthetic" \
         "$DST/editor/scripts" "$DST/resources/nm-studio"

rsync -a --delete --exclude node_modules "$SRC/src/" "$DST/editor/src/"
rsync -a --delete "$SRC/test/" "$DST/editor/test/"
rsync -a --delete "$SRC/fixtures/synthetic/" "$DST/editor/fixtures/synthetic/"

for f in package.json package-lock.json tsconfig.json vitest.config.ts playwright.config.ts PRODUCT.md; do
  cp "$SRC/$f" "$DST/editor/"
done

cp "$SRC"/scripts/build.mjs "$SRC"/scripts/sync-fixtures.mjs "$SRC"/scripts/progress-server.mjs "$DST/editor/scripts/"
cp "$SRC"/scripts/phase*-gate.mjs "$DST/editor/scripts/"

# Rebuild when the dependencies are installed; otherwise reuse the checkout's existing build.
if [ -d "$SRC/node_modules" ]; then
  (cd "$SRC" && npm run build)
fi
cp "$SRC/dist/nm-studio.mjs" "$DST/resources/nm-studio/nm-studio.mjs"

echo "sync-editor: editor/ and resources/nm-studio/ updated from $SRC"
