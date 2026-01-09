
export interface Project {
  id: string;
  templateId: string;
  name: string;
  createdAt: number;
  lastModifiedAt: number;
  lastOpenedAt?: number;
  inputValues: Record<string, string>;
  customInputs: TemplateInput[];
  stepOutputs: Record<string, string>;
  stepOverrides: Record<string, StepOverride>;
}

export interface StepOverride {
  content?: string;
}

export interface Template {
  id: string;
  name: string;
  inputs: TemplateInput[];
  steps: TemplateStep[];
}

export interface TemplateInput {
  id: string;
  label: string;
  defaultValue?: string;
}

export interface TemplateStep {
  id: string;
  name: string;
  description?: string;
  content: string;
}
