import type { ImportEncoding } from '../types';

export interface DecodedImportText {
  text: string;
  encoding: ImportEncoding;
  warnings: string[];
  suspiciousGarbled: boolean;
}

const SUSPICIOUS_GARBLED_REGEX = /(?:�|锟|Ã.|æ|å|ç|é|ö|ñ){2,}|(?:娑|鎴|妯|瀵煎叆|鐗堟湰){2,}/g;

const countMatches = (text: string, pattern: RegExp) => {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
};

const scoreDecodedText = (text: string) => {
  if (!text) return 0;
  const replacementCount = countMatches(text, /�/g);
  const suspiciousClusterCount = countMatches(text, SUSPICIOUS_GARBLED_REGEX);
  return replacementCount * 10 + suspiciousClusterCount * 3;
};

const detectSuspiciousGarbled = (text: string) => scoreDecodedText(text) >= 3;

const decodeWithEncoding = (bytes: Uint8Array, encoding: ImportEncoding) => {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return null;
  }
};

export function decodeImportText(input: Uint8Array | string): DecodedImportText {
  if (typeof input === 'string') {
    return {
      text: input,
      encoding: 'unknown',
      warnings: [],
      suspiciousGarbled: detectSuspiciousGarbled(input),
    };
  }

  const utf8Text = decodeWithEncoding(input, 'utf-8') || '';
  const gb18030Text = decodeWithEncoding(input, 'gb18030');
  const utf8Score = scoreDecodedText(utf8Text);
  const gb18030Score =
    gb18030Text === null ? Number.POSITIVE_INFINITY : scoreDecodedText(gb18030Text);

  if (gb18030Text !== null && gb18030Score + 1 < utf8Score) {
    return {
      text: gb18030Text,
      encoding: 'gb18030',
      warnings: ['检测到 UTF-8 可读性较差，已自动回退为 GB18030 解码。'],
      suspiciousGarbled: detectSuspiciousGarbled(gb18030Text),
    };
  }

  return {
    text: utf8Text,
    encoding: 'utf-8',
    warnings: [],
    suspiciousGarbled: detectSuspiciousGarbled(utf8Text),
  };
}
