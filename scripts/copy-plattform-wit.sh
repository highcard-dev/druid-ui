#!/usr/bin/env sh
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DEFAULT_SOURCE="$ROOT/packages/plattform/wit/druid-plattform.wit"

copy_wit() {
  source_path=$1
  destination_path=$2

  if ! [ -f "$source_path" ]; then
    echo "copy-plattform-wit: missing $source_path" >&2
    exit 1
  fi

  destination_directory=$(dirname "$destination_path")
  mkdir -p "$destination_directory"
  temporary_path=$(mktemp "$destination_directory/.druid-plattform.wit.XXXXXX")
  trap 'rm -f "$temporary_path"' EXIT HUP INT TERM
  tr -d '\r' < "$source_path" > "$temporary_path"
  mv "$temporary_path" "$destination_path"
  trap - EXIT HUP INT TERM
}

if [ "$#" -eq 2 ]; then
  copy_wit "$1" "$2"
  exit 0
fi

if [ "$#" -ne 0 ]; then
  echo "Usage: $0 [source.wit destination.wit]" >&2
  exit 2
fi

for destination in \
  "$ROOT/examples/druid-plattform/wit/druid-plattform.wit" \
  "$ROOT/examples/druid-plattform-no-sandbox/wit/druid-plattform.wit" \
  "$ROOT/examples/starter-component-plattform/wit/druid-plattform.wit" \
  "$ROOT/examples/config-editor-plattform/wit/druid-plattform.wit"
do
  copy_wit "$DEFAULT_SOURCE" "$destination"
done
