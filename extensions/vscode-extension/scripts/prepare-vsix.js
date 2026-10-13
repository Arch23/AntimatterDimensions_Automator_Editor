"use strict";

const fs = require("node:fs");
const path = require("node:path");

const extensionRoot = path.resolve(__dirname, "..");
const sharedRoot = path.resolve(extensionRoot, "../../packages/automator-language/src");
const vendorRoot = path.join(extensionRoot, "vendor/automator-language");
const outputRoot = path.resolve(extensionRoot, "../../bin");

fs.mkdirSync(vendorRoot, { recursive: true });
fs.mkdirSync(outputRoot, { recursive: true });
for (const filename of ["index.js", "highlighting.js", "node-snippets.js"]) {
  fs.copyFileSync(path.join(sharedRoot, filename), path.join(vendorRoot, filename));
}
