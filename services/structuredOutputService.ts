import {
  StructuredOutputFieldDefinition,
  TemplateStep,
} from '../types';

interface StructuredParsePrompt {
  systemPrompt: string;
  userPrompt: string;
}

const JSON_FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;

const toSingleLine = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeUnknownValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUnknownValue(item)).join(',');
  }
  if (value && typeof value === 'object') {
    return toSingleLine(JSON.stringify(value));
  }
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
};

export const buildStructuredParsePrompt = ({
  step,
  rawOutput,
}: {
  step: TemplateStep;
  rawOutput: string;
}): StructuredParsePrompt => {
  const fields = (step.structuredOutputFields || []).filter(
    (field) => field.key.trim() && field.label.trim()
  );

  const fieldSpec = fields
    .map((field) => {
      const description = field.description?.trim();
      return description
        ? `- ${field.key}: ${field.label} (${description})`
        : `- ${field.key}: ${field.label}`;
    })
    .join('\n');

  return {
    systemPrompt:
      'You extract structured fields from a generated text result. Return only a JSON object. Use exactly the provided field keys. Every value must be a string. If a field cannot be found, return an empty string for that key. Do not add extra keys, comments, or markdown outside the JSON object.',
    userPrompt: `Step: ${step.name || 'Untitled step'}

Structured fields:
${fieldSpec}

Generated result:
${rawOutput}

Return only one JSON object whose keys exactly match the field keys above.`,
  };
};

export const hasStructuredFieldValues = ({
  values,
  fields,
}: {
  values: Record<string, string> | undefined;
  fields: StructuredOutputFieldDefinition[];
}) =>
  fields.some((field) => String(values?.[field.key] || '').trim().length > 0);

export const extractJsonObjectText = (value: string): string => {
  const trimmed = value.trim();
  const fenced = trimmed.match(JSON_FENCE_PATTERN);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
};

export const parseStructuredOutputResponse = ({
  responseText,
  fields,
}: {
  responseText: string;
  fields: StructuredOutputFieldDefinition[];
}): Record<string, string> => {
  const jsonText = extractJsonObjectText(responseText);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Structured parse returned invalid JSON: ${error.message}`
        : 'Structured parse returned invalid JSON.'
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Structured parse did not return a JSON object.');
  }

  const result: Record<string, string> = {};

  fields.forEach((field) => {
    const rawValue = (parsed as Record<string, unknown>)[field.key];
    if (typeof rawValue === 'string') {
      result[field.key] = rawValue.trim();
      return;
    }
    if (rawValue === undefined || rawValue === null) {
      result[field.key] = '';
      return;
    }
    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      result[field.key] = String(rawValue);
      return;
    }
    result[field.key] = normalizeUnknownValue(rawValue);
  });

  return result;
};
