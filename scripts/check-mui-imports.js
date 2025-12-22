#!/usr/bin/env node

/**
 * Script to detect forbidden MUI/Emotion imports in the codebase.
 * Run as part of CI to prevent accidental MUI imports.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SRC_DIR = join(__dirname, "..", "src");

const FORBIDDEN_PATTERNS = [
  { pattern: /from\s+['"]@mui\//g, name: "@mui" },
  { pattern: /from\s+['"]@emotion\//g, name: "@emotion" },
  { pattern: /import\s+['"]@mui\//g, name: "@mui" },
  { pattern: /import\s+['"]@emotion\//g, name: "@emotion" },
  { pattern: /require\s*\(\s*['"]@mui\//g, name: "@mui" },
  { pattern: /require\s*\(\s*['"]@emotion\//g, name: "@emotion" },
];

const VALID_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

function getAllFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (VALID_EXTENSIONS.includes(extname(entry))) {
      files.push(fullPath);
    }
  }

  return files;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const violations = [];

  for (const { pattern, name } of FORBIDDEN_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      violations.push({
        file: filePath,
        package: name,
        count: matches.length,
      });
    }
  }

  return violations;
}

function main() {
  console.log("Checking for forbidden MUI/Emotion imports...\n");

  const files = getAllFiles(SRC_DIR);
  const allViolations = [];

  for (const file of files) {
    const violations = checkFile(file);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    console.error("FORBIDDEN IMPORTS DETECTED:\n");

    for (const { file, package: pkg, count } of allViolations) {
      const relativePath = file.replace(join(__dirname, "..") + "/", "");
      console.error(`  ${relativePath}: ${count} ${pkg} import(s)`);
    }

    console.error(
      "\nThis package must not depend on MUI or Emotion."
    );
    console.error("Use Tailwind CSS for styling instead.\n");
    process.exit(1);
  }

  console.log(`Checked ${files.length} files.`);
  console.log("No MUI/Emotion imports found.\n");
  process.exit(0);
}

main();
