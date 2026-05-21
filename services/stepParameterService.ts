import {
  StepParameter,
  StepParameterSource,
  StepParameterType,
  TemplateStep,
} from '../types';

export const STEP_PARAMETER_REFERENCE_PATTERN = /\[\[([\s\S]*?)\]\]/g;
const PARAMETER_NAME_PATTERN = /^[^\s.[\]]+$/;
const INVALID_PARAMETER_ACCESS_PATTERN = /^(.+)\[.*\]|^.+\..+$/;

export interface StepParameterReference {
  raw: string;
  name: string;
  type: StepParameterType;
  fieldKey?: string;
  rowIndex?: number;
  valid: boolean;
  reason?: string;
}

export const normalizeStepParameterSource = (
  source: StepParameterSource | undefined,
  fallbackKey: string
): StepParameterSource => {
  if (!source) return { type: 'same_name', key: fallbackKey };
  if (source.type === 'literal') return source;
  if (source.type === 'project_input') {
    return source.inputId.trim() && source.key.trim()
      ? { type: 'project_input', inputId: source.inputId.trim(), key: source.key.trim() }
      : { type: 'same_name', key: fallbackKey };
  }
  if (source.type === 'step_return') {
    return source.stepId.trim() && source.key.trim()
      ? { type: 'step_return', stepId: source.stepId.trim(), key: source.key.trim() }
      : { type: 'same_name', key: fallbackKey };
  }
  const key = source.key.trim();
  return key ? { ...source, key } : { type: 'same_name', key: fallbackKey };
};

export const normalizeStepParameter = (
  parameter: Partial<StepParameter>,
  fallbackIndex = 0,
  stepId = 'step'
): StepParameter | undefined => {
  const name = parameter.name?.trim();
  if (!name) return undefined;
  return {
    id: parameter.id?.trim() || `param_${stepId}_${fallbackIndex}_${name}`,
    name,
    type: parameter.type === 'table' ? 'table' : 'text',
    defaultValue:
      parameter.defaultValue !== undefined
        ? parameter.defaultValue
        : parameter.source?.type === 'literal'
          ? parameter.source.value
          : undefined,
    required: parameter.required !== false,
    source: normalizeStepParameterSource(parameter.source, name),
  };
};

export const extractStepParameterReferences = (content: string): StepParameterReference[] => {
  if (!content) return [];
  const references: StepParameterReference[] = [];
  const seen = new Set<string>();

  Array.from(content.matchAll(STEP_PARAMETER_REFERENCE_PATTERN)).forEach((match) => {
    const raw = String(match[1] || '').trim();
    if (!raw) {
      const key = '__empty__';
      if (!seen.has(key)) {
        seen.add(key);
        references.push({
          raw,
          name: '',
          type: 'text',
          valid: false,
          reason: 'empty_reference',
        });
      }
      return;
    }

    if (!PARAMETER_NAME_PATTERN.test(raw) || INVALID_PARAMETER_ACCESS_PATTERN.test(raw)) {
      const key = `invalid:${raw}`;
      if (!seen.has(key)) {
        seen.add(key);
        references.push({
          raw,
          name: raw.split(/[.[\]]/)[0]?.trim() || raw,
          type: 'text',
          valid: false,
          reason: 'parameter_name_only',
        });
      }
      return;
    }

    const key = `text:${raw}`;
    if (!seen.has(key)) {
      seen.add(key);
      references.push({
        raw,
        name: raw,
        type: 'text',
        valid: true,
      });
    }
  });

  return references;
};

export const syncStepParametersFromContent = (step: TemplateStep): StepParameter[] => {
  const existing = new Map(
    (step.parameters || [])
      .map((parameter, index) => normalizeStepParameter(parameter, index, step.id))
      .filter((parameter): parameter is StepParameter => Boolean(parameter))
      .map((parameter) => [parameter.name, parameter])
  );
  const nextParameters = new Map<string, StepParameter>();

  extractStepParameterReferences(step.content || '')
    .filter((reference) => reference.valid && reference.name)
    .forEach((reference, index) => {
      const current = existing.get(reference.name);
      if (current) {
        nextParameters.set(reference.name, {
          ...current,
          type: current.type === 'table' || reference.type === 'table' ? 'table' : 'text',
        });
      } else {
        nextParameters.set(reference.name, {
          id: `param_${step.id}_${index}_${reference.name}`,
          name: reference.name,
          type: reference.type,
          required: true,
        });
      }
    });

  return Array.from(nextParameters.values());
};
