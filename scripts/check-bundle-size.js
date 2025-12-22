#!/usr/bin/env node

/**
 * Script to check bundle sizes against budgets.
 * Run after build to ensure bundle sizes are within limits.
 */

import { readFileSync, existsSync } from "fs";
import { gzipSync } from "zlib";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = join(__dirname, "..", "dist");

// Bundle size budgets in bytes (gzipped)
const BUDGETS = {
  "index.js": 80 * 1024, // 80KB - full bundle
  "primitives/index.js": 15 * 1024, // 15KB - primitives only
  "styled/index.js": 40 * 1024, // 40KB - styled components
  "hooks/index.js": 10 * 1024, // 10KB - hooks
  "context/index.js": 5 * 1024, // 5KB - context
  "styles.css": 15 * 1024, // 15KB - CSS
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getGzipSize(filePath) {
  const content = readFileSync(filePath);
  return gzipSync(content).length;
}

function main() {
  console.log("Checking bundle sizes...\n");

  let hasErrors = false;
  const results = [];

  for (const [file, budget] of Object.entries(BUDGETS)) {
    const filePath = join(DIST_DIR, file);

    if (!existsSync(filePath)) {
      console.log(`  ${file}: SKIPPED (not found)`);
      continue;
    }

    const size = getGzipSize(filePath);
    const overBudget = size > budget;

    if (overBudget) {
      hasErrors = true;
    }

    results.push({
      file,
      size,
      budget,
      overBudget,
    });
  }

  // Print results
  console.log("Bundle Size Report (gzipped):\n");
  console.log("File                      Size        Budget      Status");
  console.log("-".repeat(65));

  for (const { file, size, budget, overBudget } of results) {
    const sizeStr = formatBytes(size).padEnd(11);
    const budgetStr = formatBytes(budget).padEnd(11);
    const status = overBudget ? "OVER BUDGET" : "OK";
    const indicator = overBudget ? "" : "";

    console.log(
      `${file.padEnd(25)} ${sizeStr} ${budgetStr} ${indicator} ${status}`
    );
  }

  console.log("-".repeat(65));

  if (hasErrors) {
    console.error("\nBundle size check FAILED.");
    console.error("Some bundles exceed their size budget.\n");
    process.exit(1);
  }

  console.log("\nBundle size check PASSED.\n");
  process.exit(0);
}

main();
