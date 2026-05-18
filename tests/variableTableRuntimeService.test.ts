import { describe, expect, it } from 'vitest';

import {
  buildVariableTableColumnsForStep,
  parseVariableTableRowsFromResponse,
} from '../services/variableTableService.runtime';
import type { TemplateStep } from '../types';

const step: TemplateStep = {
  id: 'step-1',
  name: 'Characters',
  content: '',
  structuredOutputFields: [
    { key: 'character_name', label: '角色名称' },
    { key: 'character_job', label: '角色职业' },
    { key: 'character_background', label: '角色背景' },
  ],
};

const columns = buildVariableTableColumnsForStep(step);

describe('variableTableService.runtime', () => {
  it('parses variable table rows from an object with rows', () => {
    const rows = parseVariableTableRowsFromResponse({
      responseText: JSON.stringify({
        rows: [
          {
            character_name: '林夕',
            character_job: '星港修理师',
            ignored: 'drop me',
          },
        ],
      }),
      columns,
    });

    expect(rows).toEqual([
      {
        character_name: '林夕',
        character_job: '星港修理师',
        character_background: '',
      },
    ]);
  });

  it('parses direct arrays and normalizes scalar cell values', () => {
    const rows = parseVariableTableRowsFromResponse({
      responseText: JSON.stringify([
        {
          character_name: '沈雾',
          character_job: 7,
          character_background: null,
        },
      ]),
      columns,
    });

    expect(rows).toEqual([
      {
        character_name: '沈雾',
        character_job: '7',
        character_background: '',
      },
    ]);
  });

  it('rejects non-row JSON shapes', () => {
    expect(() =>
      parseVariableTableRowsFromResponse({
        responseText: JSON.stringify({ character_name: '孤行者' }),
        columns,
      })
    ).toThrow('rows');
  });
});
