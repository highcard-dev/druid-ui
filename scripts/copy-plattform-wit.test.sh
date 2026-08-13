#!/usr/bin/env sh
set -eu

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf 'package druid:ui;\r\nworld test {}\r\n' > "$tmp/source.wit"
sh scripts/copy-plattform-wit.sh "$tmp/source.wit" "$tmp/nested/out.wit"

if grep -q "$(printf '\r')" "$tmp/nested/out.wit"; then
  echo "copied WIT still contains CRLF" >&2
  exit 1
fi

expected='package druid:ui;
world test {}'
actual=$(cat "$tmp/nested/out.wit")
if [ "$actual" != "$expected" ]; then
  echo "copied WIT content changed unexpectedly" >&2
  exit 1
fi

echo "WIT copy normalizes CRLF to LF."
