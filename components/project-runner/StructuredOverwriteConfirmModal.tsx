import React from 'react';
import { StructuredOverwriteConfirmRequest, UiLanguage } from '../../types';
import { t } from '../../services/i18n';
import { Button } from '../Button';

interface StructuredOverwriteConfirmModalProps {
  language: UiLanguage;
  request: StructuredOverwriteConfirmRequest | null;
  onConfirmOverwrite: () => void;
  onSkip: () => void;
}

export const StructuredOverwriteConfirmModal: React.FC<
  StructuredOverwriteConfirmModalProps
> = ({ language, request, onConfirmOverwrite, onSkip }) => {
  if (!request) return null;

  const stepLabel = request.stepName || request.stepId;
  const fieldsLabel = request.fieldLabels.join(' / ');
  const title =
    request.mode === 'automation'
      ? t(language, 'step.structuredOverwriteTitleAutomation')
      : t(language, 'step.structuredOverwriteTitle');
  const message =
    request.mode === 'automation'
      ? t(language, 'step.structuredOverwriteMessageAutomation', {
          step: stepLabel,
          fields: fieldsLabel,
        })
      : t(language, 'step.structuredOverwriteMessage', {
          step: stepLabel,
          fields: fieldsLabel,
        });

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-5">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">
            {message}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <Button variant="secondary" onClick={onSkip}>
            {t(language, 'step.structuredSkipParse')}
          </Button>
          <Button onClick={onConfirmOverwrite}>
            {t(language, 'step.structuredOverwriteAndParse')}
          </Button>
        </div>
      </div>
    </div>
  );
};
