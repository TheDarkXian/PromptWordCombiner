import { describe, expect, it } from 'vitest';

import {
  extractStepParameterReferences,
  syncStepParametersFromContent,
} from '../services/stepParameterService';
import type { TemplateStep } from '../types';

describe('stepParameterService', () => {
  it('extracts parameter names only', () => {
    const refs = extractStepParameterReferences(
      'Use [[name]] and [[characters[0].job]] and [[characters[1].name]]'
    );

    expect(refs).toContainEqual(expect.objectContaining({ name: 'name', type: 'text', valid: true }));
    expect(refs.filter((ref) => ref.name === 'characters')).toEqual([
      expect.objectContaining({ valid: false, reason: 'parameter_name_only' }),
      expect.objectContaining({ valid: false, reason: 'parameter_name_only' }),
    ]);
  });

  it('marks invalid and empty references', () => {
    const refs = extractStepParameterReferences('[[]] [[roles.name]] [[roles[].name]]');

    expect(refs).toEqual([
      expect.objectContaining({ valid: false, reason: 'empty_reference' }),
      expect.objectContaining({ raw: 'roles.name', valid: false, reason: 'parameter_name_only' }),
      expect.objectContaining({ raw: 'roles[].name', valid: false, reason: 'parameter_name_only' }),
    ]);
  });

  it('syncs parameters from function body while preserving existing metadata', () => {
    const step: TemplateStep = {
      id: 'step-1',
      name: 'Step',
      content: '[[topic]] [[characters[0].name]]',
      parameters: [
        {
          id: 'param-topic',
          name: 'topic',
          type: 'text',
          required: false,
          defaultValue: 'fixed',
        },
      ],
    };

    const result = syncStepParametersFromContent(step);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'param-topic',
        name: 'topic',
        required: false,
        defaultValue: 'fixed',
      }),
    ]);
  });

  it('removes parameters that are no longer referenced by the function body', () => {
    const step: TemplateStep = {
      id: 'step-1',
      name: 'Step',
      content: '[[topic]]',
      parameters: [
        {
          id: 'param-topic',
          name: 'topic',
          type: 'text',
          required: true,
        },
        {
          id: 'param-stale',
          name: 'stale',
          type: 'text',
          required: true,
        },
      ],
    };

    const result = syncStepParametersFromContent(step);

    expect(result.map((parameter) => parameter.name)).toEqual(['topic']);
  });
});
