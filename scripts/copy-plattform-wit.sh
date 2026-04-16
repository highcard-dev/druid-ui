#!/usr/bin/env sh
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/packages/plattform/wit/druid-plattform.wit"

if ! [ -f "$SRC" ]; then
  echo "copy-plattform-wit: missing $SRC" >&2
  exit 1
fi

for dest in \
  "$ROOT/examples/druid-plattform/wit/druid-plattform.wit" \
  "$ROOT/examples/druid-plattform-no-sandbox/wit/druid-plattform.wit" \
  "$ROOT/examples/starter-component-plattform/wit/druid-plattform.wit"
do
  mkdir -p "$(dirname "$dest")"
  cp "$SRC" "$dest"
done
