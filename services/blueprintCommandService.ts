import { Template } from '../types';

export type BlueprintCommandType =
  | 'move_nodes'
  | 'connect_pin'
  | 'disconnect_pin'
  | 'create_step'
  | 'delete_step'
  | 'update_step'
  | 'move_comment'
  | 'resize_comment'
  | 'auto_layout';

export interface BlueprintCommand {
  type: BlueprintCommandType;
  before: Template;
  after: Template;
  createdAt: number;
}

export interface BlueprintCommandHistory {
  undoStack: BlueprintCommand[];
  redoStack: BlueprintCommand[];
  limit: number;
}

export const createBlueprintCommandHistory = (limit = 100): BlueprintCommandHistory => ({
  undoStack: [],
  redoStack: [],
  limit,
});

export const pushBlueprintCommand = (
  history: BlueprintCommandHistory,
  command: BlueprintCommand
): BlueprintCommandHistory => {
  const undoStack = [...history.undoStack, command];
  if (undoStack.length > history.limit) undoStack.shift();
  return {
    ...history,
    undoStack,
    redoStack: [],
  };
};

export const undoBlueprintCommand = (
  history: BlueprintCommandHistory
): { history: BlueprintCommandHistory; template?: Template } => {
  if (history.undoStack.length === 0) return { history };
  const undoStack = [...history.undoStack];
  const cmd = undoStack.pop() as BlueprintCommand;
  return {
    template: cmd.before,
    history: {
      ...history,
      undoStack,
      redoStack: [...history.redoStack, cmd],
    },
  };
};

export const redoBlueprintCommand = (
  history: BlueprintCommandHistory
): { history: BlueprintCommandHistory; template?: Template } => {
  if (history.redoStack.length === 0) return { history };
  const redoStack = [...history.redoStack];
  const cmd = redoStack.pop() as BlueprintCommand;
  return {
    template: cmd.after,
    history: {
      ...history,
      undoStack: [...history.undoStack, cmd],
      redoStack,
    },
  };
};

