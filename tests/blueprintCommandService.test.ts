import { describe, expect, it } from 'vitest';

import {
  createBlueprintCommandHistory,
  pushBlueprintCommand,
  redoBlueprintCommand,
  undoBlueprintCommand,
} from '../services/blueprintCommandService';
import type { Template } from '../types';

const baseTemplate: Template = {
  id: 't1',
  name: 'T',
  inputs: [],
  modelRefs: [],
  steps: [],
};

describe('blueprintCommandService', () => {
  it('pushes commands and supports undo/redo', () => {
    const history = createBlueprintCommandHistory(10);
    const after: Template = { ...baseTemplate, name: 'T2' };
    const pushed = pushBlueprintCommand(history, {
      type: 'update_step',
      before: baseTemplate,
      after,
      createdAt: Date.now(),
    });
    expect(pushed.undoStack).toHaveLength(1);
    expect(pushed.redoStack).toHaveLength(0);

    const undone = undoBlueprintCommand(pushed);
    expect(undone.template?.name).toBe('T');
    expect(undone.history.undoStack).toHaveLength(0);
    expect(undone.history.redoStack).toHaveLength(1);

    const redone = redoBlueprintCommand(undone.history);
    expect(redone.template?.name).toBe('T2');
    expect(redone.history.undoStack).toHaveLength(1);
    expect(redone.history.redoStack).toHaveLength(0);
  });
});

