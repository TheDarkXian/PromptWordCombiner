import { describe, expect, it } from 'vitest';

import { parseStepOutputVariablesFromResponse } from '../services/stepOutputParseService';

describe('stepOutputParseService', () => {
  it('parses mixed text and table outputs from keyed JSON', () => {
    const variables = parseStepOutputVariablesFromResponse({
      responseText: JSON.stringify({
        summary: 'ready',
        characters: [{ name: 'Lin', job: 'Engineer', ignored: true }],
      }),
      stepId: 'step-1',
      outputs: [
        { key: 'summary', label: 'summary', type: 'text' },
        {
          key: 'characters',
          label: 'characters',
          type: 'table',
          tableSchema: {
            columns: [
              { key: 'name', label: 'name' },
              { key: 'job', label: 'job' },
            ],
          },
        },
      ],
      now: 1,
    });

    expect(variables[0]).toMatchObject({ key: 'summary', value: 'ready', type: 'text' });
    expect(variables[1].tableValue?.rows[0].cells).toEqual({
      name: 'Lin',
      job: 'Engineer',
    });
  });

  it('throws on invalid JSON and table shape errors', () => {
    expect(() =>
      parseStepOutputVariablesFromResponse({
        responseText: 'not json',
        stepId: 'step-1',
        outputs: [
          { key: 'summary', label: 'summary', type: 'text' },
          { key: 'characters', label: 'characters', type: 'table', tableSchema: { columns: [] } },
        ],
      })
    ).toThrow(/invalid JSON/);

    expect(() =>
      parseStepOutputVariablesFromResponse({
        responseText: JSON.stringify({ summary: 'ok', characters: {} }),
        stepId: 'step-1',
        outputs: [
          { key: 'summary', label: 'summary', type: 'text' },
          { key: 'characters', label: 'characters', type: 'table', tableSchema: { columns: [] } },
        ],
      })
    ).toThrow(/must be an array/);
  });
});
