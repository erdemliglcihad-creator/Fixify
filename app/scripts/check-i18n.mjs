// Fails when a t("…") key in src/ has no German entry in src/i18n/de.json.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "src");
const de = JSON.parse(fs.readFileSync(path.join(root, "i18n", "de.json"), "utf8"));
const keys = new Map();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const src = fs.readFileSync(full, "utf8");
      for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
        keys.set(JSON.parse(`"${m[1]}"`), path.relative(root, full));
      }
    }
  }
}

walk(root);
const missing = [...keys].filter(([k]) => !(k in de));
console.log(`${keys.size} keys, ${keys.size - missing.length} translated`);
for (const [k, file] of missing) console.log(`  missing: ${JSON.stringify(k)}  ← ${file}`);
process.exit(missing.length ? 1 : 0);
