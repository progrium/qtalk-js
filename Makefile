
build: dist/qtalk.js

minify: dist/qtalk.min.js

npm:
	deno run -A scripts/build_npm.ts 0.1.0

clobber:
	rm -rf ./dist

dist/qtalk.js: **.ts
	mkdir -p dist
	deno bundle -c tsconfig.json ./index.ts | grep -v '^\s\{4\}\w*;' > ./dist/qtalk.js

dist/qtalk.min.js: dist/qtalk.js
	minify -o dist/qtalk.min.js dist/qtalk.js