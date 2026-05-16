import { describe, expect, it } from 'vitest';

import {
  extractJsonObjectText,
  hasStructuredFieldValues,
  parseStructuredOutputResponse,
} from '../services/structuredOutputService';
import type { StructuredOutputFieldDefinition } from '../types';

const fields: StructuredOutputFieldDefinition[] = [
  { key: 'subject_description', label: '主体描述' },
  { key: 'style_keywords', label: '风格词' },
  { key: 'negative_prompt', label: '负面词' },
];

describe('structuredOutputService', () => {
  it('extracts JSON from fenced code blocks', () => {
    const response = [
      'Here is the parsed result:',
      '```json',
      '{',
      '  "subject_description": "雨夜街头的黑衣女性",',
      '  "style_keywords": "赛博朋克, 蓝紫霓虹"',
      '}',
      '```',
    ].join('\n');

    expect(extractJsonObjectText(response)).toContain('"subject_description"');
  });

  it('parses and normalizes only configured string fields', () => {
    const parsed = parseStructuredOutputResponse({
      responseText: JSON.stringify({
        subject_description: '雨夜街头的黑衣女性',
        style_keywords: ['赛博朋克', '蓝紫霓虹'],
        negative_prompt: '',
        ignored_field: 'should not survive',
      }),
      fields,
    });

    expect(parsed).toEqual({
      subject_description: '雨夜街头的黑衣女性',
      style_keywords: '赛博朋克,蓝紫霓虹',
      negative_prompt: '',
    });
  });

  it('returns true when any configured field already has a non-empty value', () => {
    expect(
      hasStructuredFieldValues({
        values: {
          subject_description: '',
          style_keywords: '赛博朋克',
        },
        fields,
      })
    ).toBe(true);

    expect(
      hasStructuredFieldValues({
        values: {
          subject_description: '   ',
          style_keywords: '',
        },
        fields,
      })
    ).toBe(false);
  });
});
