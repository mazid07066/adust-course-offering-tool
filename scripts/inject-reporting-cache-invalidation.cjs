const fs = require("fs");
const path = require("path");

const root = process.cwd();
const apiRoot = path.join(root, "src", "app", "api");

const targetPathRegex =
  /(drafts|slots|teachers|faculty-assignment|faculty-course-choices|co-offering|offering-template|offerings)/i;

const excludePathRegex =
  /(reports|export)/i;

const mutationMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const item of items) {
    const full = path.join(dir, item.name);

    if (item.isDirectory()) {
      files.push(...walk(full));
    } else if (item.isFile() && item.name === "route.ts") {
      files.push(full);
    }
  }

  return files;
}

function ensureImport(content) {
  if (content.includes('clearReportingCacheWithLog')) return content;

  const importLine =
    'import { clearReportingCacheWithLog } from "@/lib/reporting-cache";';

  const lines = content.split(/\r?\n/);
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, importLine);
    return lines.join("\n");
  }

  return `${importLine}\n${content}`;
}

function injectIntoMutationFunctions(content) {
  const lines = content.split(/\r?\n/);
  const output = [];

  let inMutation = false;
  let braceDepth = 0;
  let currentMethod = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fnMatch = line.match(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\s*\(/);

    if (fnMatch) {
      currentMethod = fnMatch[1];
      inMutation = mutationMethods.has(currentMethod);
      braceDepth = 0;
    }

    if (
      inMutation &&
      line.includes("return NextResponse.json(")
    ) {
      const previousFew = output.slice(-6).join("\n");

      if (!previousFew.includes("clearReportingCacheWithLog(")) {
        const indent = line.match(/^(\s*)/)?.[1] || "";
        output.push(
          `${indent}clearReportingCacheWithLog("offering/reporting data changed");`
        );
      }
    }

    output.push(line);

    if (fnMatch || inMutation) {
      const openCount = (line.match(/{/g) || []).length;
      const closeCount = (line.match(/}/g) || []).length;
      braceDepth += openCount - closeCount;

      if (inMutation && braceDepth <= 0 && line.includes("}")) {
        inMutation = false;
        currentMethod = "";
      }
    }
  }

  return output.join("\n");
}

function main() {
  const files = walk(apiRoot).filter((file) => {
    const rel = path.relative(root, file);
    return targetPathRegex.test(rel) && !excludePathRegex.test(rel);
  });

  const changed = [];

  for (const file of files) {
    const original = fs.readFileSync(file, "utf8");

    const hasMutation = /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\s*\(/.test(
      original
    );

    if (!hasMutation) continue;

    let updated = ensureImport(original);
    updated = injectIntoMutationFunctions(updated);

    if (updated !== original) {
      fs.writeFileSync(file, updated, "utf8");
      changed.push(path.relative(root, file));
    }
  }

  console.log("Updated files:");
  if (!changed.length) {
    console.log("No files changed.");
  } else {
    changed.forEach((file) => console.log(`- ${file}`));
  }
}

main();