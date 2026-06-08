import React, { useEffect, useMemo, useRef } from 'react';
import { ModelPreset, Project, ProviderConfig, Template, VariableExtractionResult } from '../types';
import { resolveModelPresetAvailability } from '../services/aiAvailabilityService';
import { mergeExtractionResults, runAiExtraction, runRuleExtraction } from '../services/variableExtractionService';
import { Button } from './Button';
import { useNotifications } from './NotificationCenter';

export interface VariableExtractionDraft {
  sourceText: string;
  selectedInputIds: string[];
  selectedModelRefId: string;
  results: VariableExtractionResult[];
  checkedInputIds: string[];
  message: string;
  isExtracting: boolean;
}

interface VariableExtractionToolProps {
  project: Project;
  template: Template;
  modelPresets: ModelPreset[];
  providerConfigs: ProviderConfig[];
  onApplyValues: (projectId: string, values: Record<string, string>) => void;
  draft: VariableExtractionDraft;
  onDraftChange: (projectId: string, updater: VariableExtractionDraft | ((draft: VariableExtractionDraft) => VariableExtractionDraft)) => void;
}

export const VariableExtractionTool: React.FC<VariableExtractionToolProps> = ({
  project,
  template,
  modelPresets,
  providerConfigs,
  onApplyValues,
  draft,
  onDraftChange,
}) => {
  const extractionControllerRef = useRef<AbortController | null>(null);
  const { publish } = useNotifications();
  const extractableInputs = useMemo(() => template.inputs.filter(input => !input.isConst && !input.extractionDisabled), [template.inputs]);
  const availableModelRefs = useMemo(() => (template.modelRefs || []).map(modelRef => ({
    modelRef,
    availability: resolveModelPresetAvailability(modelRef.modelPresetId, modelPresets, providerConfigs),
  })), [template.modelRefs, modelPresets, providerConfigs]);

  const {
    sourceText,
    selectedInputIds,
    selectedModelRefId,
    results,
    checkedInputIds,
    message,
    isExtracting,
  } = draft;

  const updateDraft = (updates: Partial<VariableExtractionDraft>) => {
    onDraftChange(project.id, current => ({ ...current, ...updates }));
  };

  useEffect(() => {
    const extractableIds = new Set(extractableInputs.map(input => input.id));
    const nextSelectedInputIds = selectedInputIds.filter(id => extractableIds.has(id));
    const nextResults = results.filter(result => extractableIds.has(result.inputId));
    const nextCheckedInputIds = checkedInputIds.filter(id => extractableIds.has(id));
    if (
      nextSelectedInputIds.length !== selectedInputIds.length
      || nextResults.length !== results.length
      || nextCheckedInputIds.length !== checkedInputIds.length
    ) {
      updateDraft({
        selectedInputIds: nextSelectedInputIds,
        results: nextResults,
        checkedInputIds: nextCheckedInputIds,
      });
    }
  }, [extractableInputs]);

  const selectedModelRef = availableModelRefs.find(item => item.modelRef.id === selectedModelRefId);
  const selectedModelAvailability = selectedModelRef?.availability;

  const toggleTarget = (inputId: string) => {
    updateDraft({
      selectedInputIds: selectedInputIds.includes(inputId)
        ? selectedInputIds.filter(id => id !== inputId)
        : [...selectedInputIds, inputId],
    });
  };

  const runExtraction = async () => {
    if (isExtracting) {
      extractionControllerRef.current?.abort();
      updateDraft({ message: '正在停止提取...' });
      publish({ level: 'info', title: '停止变量提取', message: '正在停止变量提取。', projectId: project.id, projectName: project.name });
      return;
    }
    const targets = extractableInputs.filter(input => selectedInputIds.includes(input.id));
    if (!sourceText.trim()) {
      updateDraft({ message: '请先输入需要提取的原始文本。' });
      return;
    }
    if (targets.length === 0) {
      updateDraft({ message: '请至少选择一个目标变量。' });
      return;
    }

    const requestProjectId = project.id;
    const controller = new AbortController();
    extractionControllerRef.current = controller;
    onDraftChange(requestProjectId, current => ({ ...current, isExtracting: true, message: '' }));
    const ruleResults = runRuleExtraction(sourceText, targets);
    let merged = ruleResults;
    const unresolvedTargets = targets.filter(input => ruleResults.some(result => result.inputId === input.id && result.status !== 'ready'));

    if (unresolvedTargets.length > 0 && selectedModelAvailability?.isAvailable && selectedModelAvailability.modelPreset && selectedModelAvailability.providerConfig) {
      try {
        const aiResults = await runAiExtraction({
          sourceText,
          targets: unresolvedTargets,
          modelPreset: selectedModelAvailability.modelPreset,
          providerConfig: selectedModelAvailability.providerConfig,
          signal: controller.signal,
        });
        merged = mergeExtractionResults(ruleResults, aiResults);
      } catch (error) {
        if (controller.signal.aborted) {
          onDraftChange(requestProjectId, current => ({ ...current, isExtracting: false, message: '已停止提取。' }));
          publish({ level: 'info', title: '变量提取已停止', message: '当前变量提取请求已停止。', projectId: requestProjectId, projectName: project.name });
          extractionControllerRef.current = null;
          return;
        }
        onDraftChange(requestProjectId, current => ({
          ...current,
          message: `AI 补全失败，已保留规则结果：${error instanceof Error ? error.message : '未知错误'}`,
        }));
        publish({ level: 'error', title: '变量提取失败', message: error instanceof Error ? error.message : '未知错误', projectId: requestProjectId, projectName: project.name });
      }
    } else if (unresolvedTargets.length > 0) {
      onDraftChange(requestProjectId, current => ({
        ...current,
        message: '已完成规则提取；当前没有可用模型，未提取字段未进行 AI 补全。',
      }));
      publish({ level: 'warning', title: '仅完成规则提取', message: '当前没有可用模型，未提取字段未进行 AI 补全。', projectId: requestProjectId, projectName: project.name });
    }

    onDraftChange(requestProjectId, current => ({
      ...current,
      results: merged,
      checkedInputIds: merged
        .filter(result => result.status === 'ready' && result.value && !(project.inputValues[result.inputId] || '').trim())
        .map(result => result.inputId),
      isExtracting: false,
    }));
    extractionControllerRef.current = null;
    publish({
      level: merged.some(result => result.status !== 'ready') ? 'warning' : 'success',
      title: '变量提取完成',
      message: `成功提取 ${merged.filter(result => result.status === 'ready').length} 个变量，未解决 ${merged.filter(result => result.status !== 'ready').length} 个。`,
      projectId: requestProjectId,
      projectName: project.name,
    });
  };

  const updateResult = (inputId: string, value: string) => {
    updateDraft({
      results: results.map(result => result.inputId === inputId
        ? { ...result, value, status: value.trim() ? 'ready' : 'unresolved' }
        : result),
    });
  };

  const applyResults = () => {
    const values = Object.fromEntries(results
      .filter(result => checkedInputIds.includes(result.inputId) && result.status === 'ready' && result.value?.trim())
      .map(result => [result.inputId, result.value!.trim()]));
    if (Object.keys(values).length === 0) {
      updateDraft({ message: '没有勾选可写入的提取结果。' });
      return;
    }
    onApplyValues(project.id, values);
    updateDraft({ checkedInputIds: [], message: `已写入 ${Object.keys(values).length} 个变量。` });
    publish({ level: 'success', title: '变量写入完成', message: `已写入 ${Object.keys(values).length} 个变量。`, projectId: project.id, projectName: project.name });
  };

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4 no-scrollbar">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-200">原始文本</h3>
          <button
            onClick={() => updateDraft({ sourceText: '', results: [], checkedInputIds: [], message: '' })}
            className="text-[10px] text-slate-600 hover:text-slate-300"
          >
            清空
          </button>
        </div>
        <textarea
          value={sourceText}
          onChange={(event) => updateDraft({ sourceText: event.target.value })}
          className="w-full min-h-[150px] resize-y rounded border border-slate-700 bg-slate-950 p-2 text-xs leading-relaxed text-slate-300 outline-none focus:border-cyan-500"
          placeholder="粘贴需要提取信息的文本..."
          spellCheck={false}
        />
      </div>

      <div className="border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-200">目标变量</h3>
          <div className="flex gap-2 text-[10px]">
            <button onClick={() => updateDraft({ selectedInputIds: extractableInputs.map(input => input.id) })} className="text-cyan-500 hover:text-cyan-300">全选</button>
            <button onClick={() => updateDraft({ selectedInputIds: [] })} className="text-slate-600 hover:text-slate-300">清空</button>
          </div>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {extractableInputs.map(input => {
            const hasValue = Boolean((project.inputValues[input.id] || '').trim());
            return (
              <label key={input.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-800/70 cursor-pointer">
                <input type="checkbox" checked={selectedInputIds.includes(input.id)} onChange={() => toggleTarget(input.id)} className="accent-cyan-500" />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{input.label}</span>
                {hasValue && <span className="shrink-0 text-[9px] text-amber-500">已有内容</span>}
              </label>
            );
          })}
          {extractableInputs.length === 0 && <p className="text-[10px] text-slate-600">当前模板没有可参与提取的变量。</p>}
        </div>
      </div>

      <div className="border-t border-slate-800 pt-3 space-y-2">
        <select
          value={selectedModelRefId}
          onChange={(event) => updateDraft({ selectedModelRefId: event.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-500"
        >
          <option value="">仅使用规则提取</option>
          {availableModelRefs.map(({ modelRef, availability }) => (
            <option key={modelRef.id} value={modelRef.id} disabled={!availability.isAvailable}>
              {modelRef.label}{availability.isAvailable ? '' : `（${availability.label}）`}
            </option>
          ))}
        </select>
        <p className={`text-[10px] leading-relaxed ${selectedModelAvailability?.isAvailable ? 'text-slate-600' : 'text-amber-600'}`}>
          {selectedModelRefId
            ? selectedModelAvailability?.message
            : '先匹配明确字段；未提取字段不会发送给 AI。'}
        </p>
        <Button onClick={runExtraction} className={`w-full ${isExtracting ? 'bg-red-600 hover:bg-red-500' : 'bg-cyan-600 hover:bg-cyan-500'}`}>
          {isExtracting ? '停止提取' : '提取变量'}
        </Button>
      </div>

      {message && <div className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] leading-relaxed text-slate-400">{message}</div>}

      {results.length > 0 && (
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <h3 className="text-xs font-bold text-slate-200">提取结果</h3>
          {results.map(result => {
            const input = extractableInputs.find(item => item.id === result.inputId);
            if (!input) return null;
            const currentValue = project.inputValues[input.id] || '';
            const canWrite = result.status === 'ready' && Boolean(result.value?.trim());
            return (
              <div key={result.inputId} className={`rounded border p-2 space-y-1.5 ${result.status === 'ready' ? 'border-slate-700 bg-slate-950' : 'border-amber-900/60 bg-amber-950/10'}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checkedInputIds.includes(input.id)}
                    disabled={!canWrite}
                    onChange={() => updateDraft({
                      checkedInputIds: checkedInputIds.includes(input.id)
                        ? checkedInputIds.filter(id => id !== input.id)
                        : [...checkedInputIds, input.id],
                    })}
                    className="accent-cyan-500"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-300">{input.label}</span>
                  <span className={`text-[9px] ${result.source === 'ai' ? 'text-blue-400' : result.source === 'rule' ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {result.source === 'ai' ? 'AI' : result.source === 'rule' ? '规则' : '未提取'}
                  </span>
                </div>
                {currentValue && <p className="truncate text-[9px] text-amber-600" title={currentValue}>当前：{currentValue}</p>}
                <textarea
                  value={result.value || ''}
                  onChange={(event) => updateResult(input.id, event.target.value)}
                  className="w-full min-h-[52px] resize-y rounded border border-slate-800 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-300 outline-none focus:border-cyan-500"
                  placeholder="未提取"
                />
                {result.message && <p className="text-[9px] leading-relaxed text-amber-600">{result.message}</p>}
              </div>
            );
          })}
          <Button variant="success" onClick={applyResults} className="w-full">确认写入</Button>
        </div>
      )}
    </div>
  );
};
