#!/usr/bin/env bash
set -euo pipefail

# Directory containing translation files
LOCALE_DIR="../locale"

BASE_FILE="en.js"                  # the source of truth file
IGNORE_FILE="commmonHTML.js"       # helper file to ignore

BASE_PATH="$LOCALE_DIR/$BASE_FILE"

if [[ ! -f "$BASE_PATH" ]]; then
  echo "❌ Base file '$BASE_PATH' not found."
  exit 1
fi

echo "🔍 Checking translation keys in directory: $LOCALE_DIR"
echo

# Extract translation keys from a given .js file
extract_keys() {
  local file="$1"

  sed -n 's/^[[:space:]]*\([A-Za-z0-9_][A-Za-z0-9_]*\)[[:space:]]*:.*/\1/p' "$file" \
    | sort -u
}

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# Build baseline key list from en.js
extract_keys "$BASE_PATH" > "$tmpdir/base.keys"

echo "Using $BASE_FILE as source of truth."
echo "Found $(wc -l < "$tmpdir/base.keys") keys in $BASE_FILE."
echo

# Iterate through every .js file in locale directory
for file in "$LOCALE_DIR"/*.js; do
  filename=$(basename "$file")

  [[ "$filename" == "$BASE_FILE" ]] && continue
  [[ "$filename" == "$IGNORE_FILE" ]] && continue

  extract_keys "$file" > "$tmpdir/$filename.keys"

  echo "=== $filename ==="

  missing="$tmpdir/$filename.missing"
  extra="$tmpdir/$filename.extra"

  comm -23 "$tmpdir/base.keys" "$tmpdir/$filename.keys" > "$missing" || true
  comm -13 "$tmpdir/base.keys" "$tmpdir/$filename.keys" > "$extra" || true

  if [[ -s "$missing" ]]; then
    echo "  🔴 Missing keys:"
    sed 's/^/    - /' "$missing"
  else
    echo "  ✅ No missing keys"
  fi

  if [[ -s "$extra" ]]; then
    echo "  ⚠️ Extra keys (not in $BASE_FILE):"
    sed 's/^/    + /' "$extra"
  else
    echo "  ✅ No extra keys"
  fi

  echo
done
