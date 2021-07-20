
build: dist/qtalk.js

dist/qtalk.js: **.ts
	mkdir -p dist
	deno bundle -c tsconfig.json ./index.ts ./dist/qtalk.js