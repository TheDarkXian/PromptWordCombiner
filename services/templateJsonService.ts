import { Template } from '../types';
import { normalizeTemplate } from './dataCompatibility';

export const TEMPLATE_JSON_FORMAT = 'pwcai-template';
export const TEMPLATE_JSON_VERSION = '1.0';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const extractTemplateSources = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return [];
  if (Array.isArray(data.templates)) return data.templates;
  if (isRecord(data.template)) return [data.template];
  if (Array.isArray(data.inputs) && Array.isArray(data.steps)) return [data];
  return [];
};

const validateTemplateSource = (source: unknown, index: number) => {
  if (!isRecord(source)) throw new Error(`第 ${index + 1} 个模板不是 JSON 对象。`);
  if (typeof source.name !== 'string' || !source.name.trim()) throw new Error(`第 ${index + 1} 个模板缺少 name。`);
  if (!Array.isArray(source.inputs)) throw new Error(`模板“${source.name}”缺少 inputs 数组。`);
  if (!Array.isArray(source.steps) || source.steps.length === 0) throw new Error(`模板“${source.name}”至少需要一个步骤。`);
  source.steps.forEach((step, stepIndex) => {
    if (!isRecord(step) || typeof step.content !== 'string') {
      throw new Error(`模板“${source.name}”的第 ${stepIndex + 1} 个步骤缺少 content。`);
    }
  });
};

const findDuplicate = (ids: string[]) => ids.find((id, index) => ids.indexOf(id) !== index);

const validateNormalizedTemplate = (template: Template) => {
  const duplicateInputId = findDuplicate(template.inputs.map(input => input.id));
  if (duplicateInputId) throw new Error(`模板“${template.name}”存在重复变量 ID：${duplicateInputId}`);
  const duplicateStepId = findDuplicate(template.steps.map(step => step.id));
  if (duplicateStepId) throw new Error(`模板“${template.name}”存在重复步骤 ID：${duplicateStepId}`);
  const duplicateModelRefId = findDuplicate((template.modelRefs || []).map(modelRef => modelRef.id));
  if (duplicateModelRefId) throw new Error(`模板“${template.name}”存在重复模型变量 ID：${duplicateModelRefId}`);

  const inputById = new Map(template.inputs.map(input => [input.id, input]));
  const modelRefIds = new Set((template.modelRefs || []).map(modelRef => modelRef.id));
  template.steps.forEach(step => {
    if (step.execution?.modelRefId && !modelRefIds.has(step.execution.modelRefId)) {
      throw new Error(`步骤“${step.name}”引用了不存在的模型变量：${step.execution.modelRefId}`);
    }
    if (step.execution?.outputTarget === 'templateInput') {
      const outputInput = step.execution.outputInputId ? inputById.get(step.execution.outputInputId) : undefined;
      if (!outputInput || outputInput.isConst) {
        throw new Error(`步骤“${step.name}”的输出目标必须是存在的非只读变量。`);
      }
    }
  });
};

export const importTemplatesFromJson = (data: unknown, existingTemplateIds: Set<string>): Template[] => {
  const sources = extractTemplateSources(data);
  if (sources.length === 0) {
    throw new Error('未找到模板。请导入单个模板对象、包含 template 的交换文件，或 templates 数组。');
  }

  const usedIds = new Set(existingTemplateIds);
  return sources.map((source, index) => {
    validateTemplateSource(source, index);
    const normalized = normalizeTemplate(source);
    validateNormalizedTemplate(normalized);
    let id = normalized.id;
    if (!id || usedIds.has(id)) {
      const base = `tmpl_import_${Date.now()}_${index}`;
      id = base;
      let suffix = 1;
      while (usedIds.has(id)) id = `${base}_${suffix++}`;
    }
    usedIds.add(id);
    return {
      ...normalized,
      id,
      groupId: undefined,
      createdAt: Date.now(),
      lastModifiedAt: Date.now(),
    };
  });
};

export const createTemplateJson = (template: Template) => ({
  format: TEMPLATE_JSON_FORMAT,
  version: TEMPLATE_JSON_VERSION,
  template,
});
