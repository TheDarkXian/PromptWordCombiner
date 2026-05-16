import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ProducerRunPreflightModal } from '../components/project-runner/ProducerRunPreflightModal';
import type { ProducerPreflightItem } from '../types';

const makeItem = (overrides: Partial<ProducerPreflightItem> & Pick<ProducerPreflightItem, 'stepId'>): ProducerPreflightItem => ({
  stepId: overrides.stepId,
  stepName: overrides.stepName || overrides.stepId,
  outputVariableKey: overrides.outputVariableKey || `${overrides.stepId}_out`,
  status: overrides.status || 'ready',
  reason: overrides.reason,
  willOverwrite: overrides.willOverwrite,
});

describe('ProducerRunPreflightModal', () => {
  it('renders null when modal is closed', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProducerRunPreflightModal, {
        isOpen: false,
        language: 'en-US',
        items: [],
        scope: 'changed_only',
        onScopeChange: vi.fn(),
        selectedOverwriteStepIds: [],
        onToggleOverwrite: vi.fn(),
        onSelectAllOverwrite: vi.fn(),
        onSelectNoOverwrite: vi.fn(),
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      })
    );

    expect(html).toBe('');
  });

  it('shows status sections and enables confirm when there are executable items', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProducerRunPreflightModal, {
        isOpen: true,
        language: 'en-US',
        items: [
          makeItem({ stepId: 'ready-1', status: 'ready', outputVariableKey: 'ready_var' }),
          makeItem({
            stepId: 'exist-1',
            status: 'existing_result',
            outputVariableKey: 'exist_var',
            reason: 'Existing result',
          }),
          makeItem({
            stepId: 'blocked-1',
            status: 'blocked',
            reason: 'Circular dependency detected between producer nodes.',
          }),
          makeItem({
            stepId: 'skipped-1',
            status: 'skipped',
            reason: 'No upstream variable change detected.',
          }),
        ],
        scope: 'changed_only',
        onScopeChange: vi.fn(),
        selectedOverwriteStepIds: ['exist-1'],
        onToggleOverwrite: vi.fn(),
        onSelectAllOverwrite: vi.fn(),
        onSelectNoOverwrite: vi.fn(),
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      })
    );

    expect(html).toContain('ready-1');
    expect(html).toContain('exist-1');
    expect(html).toContain('blocked-1');
    expect(html).toContain('skipped-1');
    expect(html).toContain('{{ready_var}}');
    expect(html).toContain('{{exist_var}}');
    expect(html).toMatch(/<button[^>]*>Start update<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Start update<\/button>/);
  });

  it('disables confirm when there is no ready or selected overwrite item', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProducerRunPreflightModal, {
        isOpen: true,
        language: 'en-US',
        items: [
          makeItem({
            stepId: 'skipped-1',
            status: 'skipped',
            reason: 'No upstream variable change detected.',
          }),
        ],
        scope: 'empty_only',
        onScopeChange: vi.fn(),
        selectedOverwriteStepIds: [],
        onToggleOverwrite: vi.fn(),
        onSelectAllOverwrite: vi.fn(),
        onSelectNoOverwrite: vi.fn(),
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      })
    );

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Start update<\/button>/);
  });
});
