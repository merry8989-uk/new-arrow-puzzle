#!/usr/bin/env bash
# Build the YouTube Playables upload bundle.
#
# The bundle must have index.html at its ROOT, contain only the runtime game
# files (no tools, docs, packs or README), use relative paths, and stay within
# the size limits. Produces build/playables-bundle.zip.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="build"
STAGE="$OUT/playables"
rm -rf "$STAGE" "$OUT/playables-bundle.zip"
mkdir -p "$STAGE"

# Only what the game needs at runtime.
cp index.html "$STAGE/"
cp -r css "$STAGE/"
mkdir -p "$STAGE/js"
cp js/playables.js js/core.js js/levels.js js/game.js "$STAGE/js/"

# The staged index.html must not reference packs-config.js (not shipped here),
# otherwise the bundle would 404 on a script inside Playables.
sed -i '/packs-config\.js/d; /Online packs (web only)/d' "$STAGE/index.html"

# Strip anything that isn't a runtime file (safety net).
find "$STAGE" -type f \( -name '*.map' -o -name '*.md' \) -delete

( cd "$STAGE" && zip -q -r "../playables-bundle.zip" . -x '.*' )

echo "bundle: $OUT/playables-bundle.zip"
echo "files : $(find "$STAGE" -type f | wc -l)"
echo "size  : $(du -h "$OUT/playables-bundle.zip" | cut -f1) (raw $(du -sb "$STAGE" | cut -f1) bytes)"
echo
echo "Validating against the Playables limits..."
python3 tools/check_bundle.py "$STAGE"
