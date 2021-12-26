#!/usr/bin/env sh

# build
./build.sh

# remove .gitignore and package files from wasm-pack
rm -fv ./www/pkg/.gitignore ./www/pkg/package.json

# add .nojekyll 
touch ./www/.nojekyll
