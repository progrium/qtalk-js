
build: dist/qtalk.js  dist/qtalk.min.js

npm:
	deno run -A scripts/build_npm.ts 0.1.0

clobber:
	rm -rf ./dist

dist/qtalk.js: **.ts
	mkdir -p dist
	esbuild index_browser.ts --bundle --format=esm --outfile=./dist/qtalk.js 

dist/qtalk.min.js: **.ts
	esbuild index_browser.ts --bundle --format=esm --outfile=./dist/qtalk.min.js --minify