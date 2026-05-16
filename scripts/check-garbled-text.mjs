import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md']);
const IGNORE_DIR = new Set(['node_modules', '.git', 'dist', 'coverage', 'target', 'src-tauri/target']);

const suspiciousPatterns = [
  /�{2,}/,
  /锟/,
  /Ã[\w\u00C0-\u017F]/,
  /(?:æ|å|ç|é|ö|ñ){3,}/,
  /(?:鎻|瀵煎叆|妯|宸茬|鍚堝苟|闃熷垪){2,}/,
];

const allowLiteralPatterns = [
  /SUSPICIOUS_GARBLED_REGEX/,
  /decodeImportText\('����'\)/,
  /\/锟\//,
];

const walk = (dir, out = []) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!IGNORE_DIR.has(name)) walk(full, out);
      continue;
    }
    if (TARGET_EXT.has(path.extname(name))) {
      if (full.includes(`${path.sep}target${path.sep}`)) continue;
      out.push(full);
    }
  }
  return out;
};

const files = walk(ROOT);
const findings = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  if (rel === 'scripts/check-garbled-text.mjs') continue;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (allowLiteralPatterns.some((p) => p.test(line))) return;
    if (suspiciousPatterns.some((p) => p.test(line))) {
      findings.push({
        file: rel,
        line: idx + 1,
        text: trimmed.slice(0, 140),
      });
    }
  });
}

if (findings.length === 0) {
  console.log('乱码检查通过：未发现可疑硬编码。');
  process.exit(0);
}

console.error(`发现 ${findings.length} 处可疑乱码，请先修复：`);
for (const item of findings.slice(0, 80)) {
  console.error(`- ${item.file}:${item.line} ${item.text}`);
}
process.exit(1);
