
build: dist/qtalk.js

minify: dist/qtalk.min.js

clobber:
	rm -rf ./dist

dist/qtalk.js: **.ts
	mkdir -p dist
	deno bundle -c tsconfig.json ./index.ts | grep -v '^\s\{4\}\w*;' > ./dist/qtalk.js

dist/qtalk.min.js: dist/qtalk.js
	minify -o dist/qtalk.min.js dist/qtalk.js