import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ProducerRunProgressModal, type ProducerRunProgressState } from '../components/project-runner/ProducerRunProgressModal';

const baseState: ProducerRunProgressState = {
  isOpen: true,
  isRunning: true,
  total: 3,
  processed: 1,
  currentStepName: 'Step A',
  successCount: 1,
  errorCount: 0,
  skippedCount: 0,
  stopRequested: false,
  results: [
    {
      stepId: 'step-a',
      stepName: 'Step A',
      outputVariableKey: 'var_a',
      status: 'success',
      message: 'Updated {{var_a}}',
      structuredParseStatus: 'not_applicable',
    },
    {
      stepId: 'step-b',
      stepName: 'Step B',
      outputVariableKey: 'var_b',
      status: 'blocked',
      message: 'Circular dependency detected between producer nodes.',
      structuredParseStatus: 'not_applicable',
    },
  ],
};

describe('ProducerRunProgressModal', () => {
  it('renders null when modal is closed', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProducerRunProgressModal, {
        language: 'en-US',
        state: { ...baseState, isOpen: false },
        onStop: vi.fn(),
        onClose: vi.fn(),
        onExport: vi.fn(),
      })
    );

    expect(html).toBe('');
  });

  it('shows running state with current step and stop button', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProducerRunProgressModal, {
        language: 'en-US',
        state: baseState,
        onStop: vi.fn(),
        onClose: vi.fn(),
        onExport: vi.fn(),
      })
    );

    expect(html).toContain('Current node: Step A');
    expect(html).toContain('1 / 3');
    expect(html).toContain('Stop');
    expect(html).toContain('{{var_a}}');
    expect(html).toContain('{{var_b}}');
  });

  it('hides stop button and keeps close enabled after run completed', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProducerRunProgressModal, {
        language: 'en-US',
        state: {
          ...baseState,
          isRunning: false,
          processed: 3,
          successCount: 2,
          skippedCount: 1,
          currentStepName: '',
        },
        onStop: vi.fn(),
        onClose: vi.fn(),
        onExport: vi.fn(),
      })
    );

    expect(html).not.toContain('Stop');
    expect(html).toContain('Close');
    expect(html).toContain('Success 2');
  });

  it('shows stopping state label and disabled stop button when stop requested', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProducerRunProgressModal, {
        language: 'en-US',
        state: { ...baseState, stopRequested: true },
        onStop: vi.fn(),
        onClose: vi.fn(),
        onExport: vi.fn(),
      })
    );

    expect(html).toContain('Stopping…');
    expect(html).toContain('disabled');
  });
});
