const fs = require("fs");
const path = require("path");

const files = [
  "src/app/api/admin/faculty-assignment/assign/route.ts",
  "src/app/api/offerings/save/route.ts",
  "src/app/api/offerings/status-transition/route.ts",
];

const importLine =
  'import { clearReportingCacheWithLog } from "@/lib/reporting-cache";';

for (const rel of files) {
  const file = path.join(process.cwd(), rel);

  if (!fs.existsSync(file)) {
    console.log(`Missing: ${rel}`);
    continue;
  }

  let content = fs.readFileSync(file, "utf8");

  content = content.replace(/\nimport \{ clearReportingCacheWithLog \} from "@\/lib\/reporting-cache";\n/g, "\n");

  const lines = content.split(/\r?\n/);
  let insertAt = -1;
  let inImportBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("import ")) {
      insertAt = i;

      if (line.includes("{") && !line.includes("} from ")) {
        inImportBlock = true;
      }
    } else if (inImportBlock && line.includes("} from ")) {
      insertAt = i;
      inImportBlock = false;
    } else if (!inImportBlock && insertAt >= 0 && !line.startsWith("import ") && line.trim() !== "") {
      break;
    }
  }

  lines.splice(insertAt + 1, 0, importLine);

  fs.writeFileSync(file, lines.join("\n"), "utf8");
  console.log(`Fixed: ${rel}`);
}