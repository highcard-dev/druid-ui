#!/bin/sh
# Real Cargo/component builds; deliberately runnable without Node/npm.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
mkdir -p "$root/.verification"
fixture=$(mktemp -d "$root/.verification/native-rust-XXXXXX")
watcher=
cleanup() {
  if [ -n "$watcher" ]; then kill "$watcher" 2>/dev/null || true; wait "$watcher" 2>/dev/null || true; fi
  rm -rf -- "$fixture"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
mkdir "$fixture/space in project"
project="$fixture/space in project"
mkdir "$project/guest"
cp "$root/examples/starter-component/guest/Cargo.toml" "$project/guest/"
cp "$root/examples/starter-component/guest/Cargo.lock" "$project/guest/"
cp -R "$root/examples/starter-component/guest/src" "$project/guest/"
cp "$root/examples/starter-component/src/view.openui" "$project/view.openui"
cp "$root/packages/client/build-rust.sh" "$project/build-rust.sh"
cp -R "$root/packages/client/wit" "$project/wit"
cd "$project"
./build-rust.sh guest/Cargo.toml dist --name=example --document=view.openui
wasm-tools component wit dist/example.wasm | grep 'export druid:openui/client;'
cmp view.openui dist/example.openui
original=$(cksum dist/example.wasm dist/example.openui)
if ./build-rust.sh guest/Cargo.toml dist --name=example --document=missing.openui; then
  echo 'Missing document unexpectedly succeeded' >&2; exit 1
fi
test "$original" = "$(cksum dist/example.wasm dist/example.openui)"
if ./build-rust.sh guest/Cargo.toml dist --name=../escape; then
  echo 'Invalid artifact name unexpectedly succeeded' >&2; exit 1
fi

./build-rust.sh guest/Cargo.toml dist --name=example --document=view.openui --watch > watch.log 2>&1 &
watcher=$!
await_log() {
  count=0
  until grep -q "$1" watch.log; do
    count=$((count + 1))
    if [ "$count" -ge 60 ]; then tail -n 30 watch.log; exit 1; fi
    sleep 1
  done
}
await_log 'Built '
cp guest/src/lib.rs "$fixture/original.rs"
printf '\nthis is not Rust;\n' >> guest/src/lib.rs
await_log 'could not compile'
test "$original" = "$(cksum dist/example.wasm dist/example.openui)"
cp "$fixture/original.rs" guest/src/lib.rs
printf '\n// watch-rebuilt\n' >> view.openui
count=0
until cmp -s view.openui dist/example.openui; do
  count=$((count + 1))
  if [ "$count" -ge 60 ]; then tail -n 30 watch.log; exit 1; fi
  sleep 1
done
echo 'PASS: standalone Rust build, paired document, spaces, failures, watch recovery'
