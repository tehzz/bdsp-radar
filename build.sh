#!/usr/bin/env sh

# https://gist.github.com/mohanpedala/1e2ff5661761d3abd0385e8223e16425
set -e
set -u
set -x

# use wasm-pack to build the rust wasm code
wasm-pack build --release --target no-modules -d ../www/pkg radarweb
