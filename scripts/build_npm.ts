import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./index.ts"],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
    webSocket: true,
    custom: [{
      globalNames: ["TextEncoder", "TextDecoder"],
      module: "util",
    }]
  },
  typeCheck: false,
  package: {
    // package.json properties
    name: "qtalk",
    version: Deno.args[0],
    description: "",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/progrium/qtalk-js.git",
    },
    bugs: {
      url: "https://github.com/progrium/qtalk-js/issues",
    },
  },
});

// post build steps
//Deno.copyFileSync("LICENSE", "npm/LICENSE");
//Deno.copyFileSync("README.md", "npm/README.md");