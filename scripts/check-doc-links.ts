#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const markdownFiles = [
  "README.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ...Array.from(new Bun.Glob("docs/*.md").scanSync(".")),
].sort();

let failed = false;

for (const file of markdownFiles) {
  const text = await Bun.file(file).text();
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1]?.trim();
    if (!target || isExternalLink(target) || target.startsWith("#")) {
      continue;
    }

    const pathOnly = target.split("#")[0];
    if (!pathOnly) {
      continue;
    }

    const resolved = join(dirname(file), pathOnly);
    if (!existsSync(resolved)) {
      console.error(`${file}: missing link target ${target}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Checked ${markdownFiles.length} Markdown files.`);

function isExternalLink(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(target);
}
