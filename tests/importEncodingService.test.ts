import { describe, expect, it } from 'vitest';

import { decodeImportText } from '../services/importEncodingService';

describe('importEncodingService', () => {
  it('prefers utf-8 when decoding quality is normal', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ hello: 'world' }));
    const decoded = decodeImportText(bytes);
    expect(decoded.encoding).toBe('utf-8');
    expect(decoded.text).toContain('"hello"');
  });

  it('falls back to GB18030 when UTF-8 result is suspicious', () => {
    const bytes = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]);
    const decoded = decodeImportText(bytes);
    expect(decoded.encoding).toBe('gb18030');
    expect(decoded.warnings[0]).toContain('GB18030');
  });

  it('marks suspicious garbled string input', () => {
    const decoded = decodeImportText('����');
    expect(decoded.encoding).toBe('unknown');
    expect(decoded.suspiciousGarbled).toBe(true);
  });
});
