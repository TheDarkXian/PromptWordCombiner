import fs from 'node:fs';
import path from 'node:path';

const STRICT_MODE = process.argv.includes('--strict');
const targetFile = path.resolve(process.cwd(), 'services/i18n.ts');

const source = fs.readFileSync(targetFile, 'utf8');

const extractTranslationKeys = (text) => {
  const match = text.match(/type TranslationKey =([\s\S]*?);/);
  if (!match) return new Set();
  return new Set(Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]));
};

const extractObjectBlock = (text, marker) => {
  const startIndex = text.indexOf(marker);
  if (startIndex < 0) return '';
  const openIndex = text.indexOf('{', startIndex);
  if (openIndex < 0) return '';
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(openIndex + 1, i);
      }
    }
  }
  return '';
};

const extractLocaleKeys = (text, locale) => {
  const results = new Set();
  const objectBlock = extractObjectBlock(text, `'${locale}': {`);
  Array.from(objectBlock.matchAll(/'([^']+)'\s*:/g)).forEach((item) => results.add(item[1]));

  const assignRegex = new RegExp(`Object\\.assign\\(messages\\['${locale}'\\],\\s*\\{([\\s\\S]*?)\\}\\);`, 'g');
  for (const match of text.matchAll(assignRegex)) {
    Array.from(match[1].matchAll(/'([^']+)'\s*:/g)).forEach((item) => results.add(item[1]));
  }

  return results;
};

const findGarbledEntries = (text, locale) => {
  const block = extractObjectBlock(text, `'${locale}': {`);
  const lines = block.split('\n');
  const suspectLineRegex = /�|Ã.|¤|å|æ|ç|è|é|ê|ì|í|î|ï|ð|ñ|ò|ó|ô|õ|ö|ø|ù|ú|û|ü|ý|þ|ÿ/;
  return lines
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => line.includes(':') && suspectLineRegex.test(line))
    .slice(0, 30)
    .map(({ line, index }) => {
      const cleaned = line.trim().slice(0, 120);
      return `zh-CN 行${index}: ${cleaned}`;
    });
};

const translationKeys = extractTranslationKeys(source);
const zhKeys = extractLocaleKeys(source, 'zh-CN');
const enKeys = extractLocaleKeys(source, 'en-US');

const missingInZh = [...translationKeys].filter((key) => !zhKeys.has(key));
const missingInEn = [...translationKeys].filter((key) => !enKeys.has(key));
const unknownInZh = [...zhKeys].filter((key) => !translationKeys.has(key));
const unknownInEn = [...enKeys].filter((key) => !translationKeys.has(key));
const garbled = findGarbledEntries(source, 'zh-CN');

const problems = [];
if (missingInZh.length) problems.push(`zh-CN 缺失 key（${missingInZh.length}）: ${missingInZh.slice(0, 10).join(', ')}`);
if (missingInEn.length) problems.push(`en-US 缺失 key（${missingInEn.length}）: ${missingInEn.slice(0, 10).join(', ')}`);
if (unknownInZh.length) problems.push(`zh-CN 存在未声明 key（${unknownInZh.length}）: ${unknownInZh.slice(0, 10).join(', ')}`);
if (unknownInEn.length) problems.push(`en-US 存在未声明 key（${unknownInEn.length}）: ${unknownInEn.slice(0, 10).join(', ')}`);
if (garbled.length) problems.push(`检测到疑似乱码（示例 ${Math.min(garbled.length, 5)} 条）:\n${garbled.slice(0, 5).join('\n')}`);

if (problems.length === 0) {
  console.log('i18n 检查通过：key 对齐且未发现疑似乱码。');
  process.exit(0);
}

const modeLabel = STRICT_MODE ? '阻断模式' : '告警模式';
console.warn(`[i18n完整性检查][${modeLabel}] 发现问题：`);
problems.forEach((item, index) => console.warn(`${index + 1}. ${item}`));

if (STRICT_MODE) {
  process.exit(1);
}
