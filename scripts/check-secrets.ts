#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ignoredDirectories = new Set([".git", "node_modules", "coverage", "dist", ".tmp", ".cookies"]);
const ignoredFiles = new Set(["bun.lock"]);
const highRiskPatterns: Array<[RegExp, string]> = [
  [new RegExp("remember" + "_token="), "Rails remember_token cookie"],
  [new RegExp("cf" + "_clearance="), "Cloudflare clearance cookie"],
  [new RegExp("__cf" + "_bm="), "Cloudflare bot-management cookie"],
  [new RegExp("_session" + "_id=[0-9a-f]{16,}", "i"), "session id cookie value"],
  [new RegExp("connect" + "\\.sid=s%3A", "i"), "Express session cookie"],
  [new RegExp("ttcsid" + "(_[A-Z0-9]+)?="), "TikTok tracking cookie value"],
  [new RegExp("eyJfcmF" + "pbHMiOnsibWVzc2FnZSI6", "i"), "encoded Rails cookie payload"],
];

let failed = false;

for (const file of walk(".")) {
  const text = readFileSync(file, "utf8");
  for (const [pattern, label] of highRiskPatterns) {
    if (pattern.test(text)) {
      console.error(`${file}: possible ${label}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("High-risk captured credential patterns were found. Remove real session data before release.");
  process.exit(1);
}

console.log("No high-risk captured credential patterns found.");

function* walk(directory: string): Generator<string> {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) {
      continue;
    }

    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      yield* walk(path);
      continue;
    }

    if (stat.isFile() && !ignoredFiles.has(entry)) {
      yield path;
    }
  }
}
