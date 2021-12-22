#!/usr/bin/env sh

# use wasm-pack to build the rust wasm code
wasm-pack build --release --target no-modules -d ./www/pkg radarweb
