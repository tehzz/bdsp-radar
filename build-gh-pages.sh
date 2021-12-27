#!/usr/bin/env sh

# https://gist.github.com/mohanpedala/1e2ff5661761d3abd0385e8223e16425
set -e
set -u
set -x

# build
./build.sh

# remove .gitignore and package files from wasm-pack
rm -fv ./www/pkg/.gitignore ./www/pkg/package.json

# add .nojekyll 
touch ./www/.nojekyll
