# pwcAI 模板 JSON 编写与导入指南

这份文档用于让人类或其他 AI 快速生成可导入 pwcAI 的模板 JSON，从而减少在模板编辑器中手动搭建变量、步骤和 AI 配置的工作。

## 使用方式

1. 把本文件提供给负责设计工作流的 AI。
2. 描述你希望完成的任务、需要的变量和步骤。
3. 要求 AI 最终只输出一个 JSON 代码块，不要输出注释或解释。
4. 在 pwcAI 的“全部模板”或“未分组模板”页面点击“导入模板 JSON”。
5. 导入后打开模板编辑器，检查变量、步骤引用和模型变量绑定。

模板列表中的“导出 JSON”可以导出现有模板。导出的文件也可以交给 AI 修改后重新导入。

## pwcAI 当前工作方式

pwcAI 是本地优先的提示词流程工作台：

- 模板定义输入变量、模型变量、提取预设和有顺序的步骤。
- 项目从模板创建，并保存每个项目自己的变量值和步骤输出。
- 步骤内容可以引用模板变量和前面步骤的输出。
- 步骤可以由用户手动复制执行，也可以绑定模板模型变量进行 AI 文本生成。
- AI 生成结果可以写入当前步骤输出，或写入某个非只读模板变量。
- 一键生成按模板步骤顺序运行 AI 步骤。
- 模板 JSON 不包含 API Key 或全局模型配置。导入后可能需要在模板编辑器中重新绑定可用的模型预设。

## 推荐交换格式

推荐使用以下外层结构：

```json
{
  "format": "pwcai-template",
  "version": "1.0",
  "template": {
    "name": "模板名称",
    "inputs": [],
    "steps": []
  }
}
```

导入器也兼容：

- 直接导入单个模板对象。
- 导入模板对象数组。
- 导入 `{ "templates": [...] }`。

导入时至少要求：

- 模板具有非空 `name`。
- 模板具有 `inputs` 数组。
- 模板具有至少一个步骤。
- 每个步骤具有字符串类型的 `content`。

## ID 规则

所有 ID 都使用简单、稳定、可读的英文标识，例如：

```text
input_topic
input_article
model_main
step_outline
step_draft
```

要求：

- 同一模板内，每个变量 ID 唯一。
- 同一模板内，每个步骤 ID 唯一。
- 同一模板内，每个模型变量 ID 唯一。
- `projectNameRule.inputId` 必须指向某个非只读输入变量 ID。
- `execution.modelRefId` 必须指向某个模板模型变量 ID。
- `execution.outputInputId` 必须指向某个非只读输入变量 ID。
- 提取预设引用的变量和模型变量 ID 必须存在。

模板自身的 `id` 可以省略。导入器会自动生成 ID；如果导入的模板 ID 与已有模板冲突，也会生成新的模板 ID。

## 模板字段

### Template

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `name` | 是 | 模板显示名称。 |
| `inputs` | 是 | 输入变量数组，可以为空。 |
| `steps` | 是 | 有顺序的步骤数组，至少一个。 |
| `modelRefs` | 否 | 模板模型变量数组。 |
| `extractionPresets` | 否 | 变量提取预设数组。 |
| `projectNameRule` | 否 | 使用某个变量生成项目名称。 |
| `hideProjects` | 否 | 是否在全部项目总览中隐藏该模板的项目。 |

不要在 AI 生成的模板里写 `groupId`、`createdAt` 或 `lastModifiedAt`。导入器会处理这些字段。

### TemplateInput

```json
{
  "id": "input_topic",
  "label": "主题",
  "defaultValue": "",
  "isConst": false,
  "extractionDescription": "需要提取的内容说明",
  "extractionDisabled": false
}
```

- `id`：推荐必填，供步骤和配置引用。
- `label`：用户看到的变量名称。
- `defaultValue`：创建项目时自动填入的默认值。
- `isConst`：为 `true` 时，该变量在项目中只读，不能作为 AI 输出目标。
- `extractionDescription`：变量提取时提供给 AI 的字段说明。
- `extractionDisabled`：为 `true` 时，不参与变量提取。

### TemplateStep

```json
{
  "id": "step_outline",
  "name": "生成大纲",
  "description": "根据主题生成文章大纲",
  "content": "请为主题 <主题> 生成文章大纲。",
  "showInPromptOverview": true,
  "execution": {
    "enabled": true,
    "modelRefId": "model_main",
    "outputTarget": "stepOutput",
    "skipBatchWhenOutputExists": true,
    "temperature": 0.7,
    "maxTokens": 2000,
    "systemPrompt": "你是专业内容策划。"
  }
}
```

- `content`：步骤提示词正文。
- `showInPromptOverview`：是否显示在项目右侧拼接全览中，默认 `true`。
- 没有 `execution.modelRefId` 的步骤视为手动步骤。
- `outputTarget` 为 `stepOutput` 时写入当前步骤输出。
- `outputTarget` 为 `templateInput` 时，还必须提供 `outputInputId`。
- `skipBatchWhenOutputExists` 为 `true` 时，一键生成会保留已有目标输出，只补充空缺步骤。
- 单独点击某个步骤生成时，不受 `skipBatchWhenOutputExists` 影响。

### TemplateModelRef

```json
{
  "id": "model_main",
  "label": "主生成模型"
}
```

模板模型变量只描述模板内的模型用途。AI 生成模板时建议省略 `modelPresetId`，导入后由用户在模板编辑器中绑定本机可用的全局模型预设。

### ProjectNameRule

```json
{
  "inputId": "input_topic",
  "prefix": "项目:"
}
```

项目名称会显示为 `prefix + 变量值`。用户在项目运行页修改项目名称时，实际会覆盖绑定变量的值，不会修改模板规则。

### VariableExtractionPreset

```json
{
  "id": "extract_basic",
  "name": "提取基础信息",
  "sourceInputId": "input_source_text",
  "targetInputIds": ["input_topic", "input_audience"],
  "modelRefId": "model_main",
  "instruction": "从原文中提取可直接使用的信息。"
}
```

`sourceInputId` 不能同时出现在 `targetInputIds` 中。

## 步骤引用语法

### 引用输入变量

推荐使用变量名称：

```text
<主题>
<目标用户>
```

也支持按变量数组位置引用：

```text
<0>
<1>
```

名称引用可读性更好，AI 编写新模板时应优先使用名称引用。

### 引用步骤输出

推荐使用步骤名称：

```text
[[生成大纲]]
```

也支持按步骤位置引用：

```text
[[1]]
[[2]]
```

步骤只能可靠引用当前步骤之前的输出。不要设计循环引用。

注意：如果某个步骤把结果写入模板变量，后续步骤应通过 `<变量名称>` 引用该结果，而不是 `[[步骤名称]]`。

## 完整示例

```json
{
  "format": "pwcai-template",
  "version": "1.0",
  "template": {
    "name": "文章策划与写作",
    "projectNameRule": {
      "inputId": "input_topic",
      "prefix": "文章:"
    },
    "inputs": [
      {
        "id": "input_topic",
        "label": "主题",
        "defaultValue": ""
      },
      {
        "id": "input_audience",
        "label": "目标用户",
        "defaultValue": "普通读者"
      },
      {
        "id": "input_outline",
        "label": "文章大纲",
        "defaultValue": ""
      }
    ],
    "modelRefs": [
      {
        "id": "model_main",
        "label": "主生成模型"
      }
    ],
    "steps": [
      {
        "id": "step_outline",
        "name": "生成大纲",
        "description": "根据主题和目标用户生成文章大纲",
        "content": "请为主题“<主题>”生成面向“<目标用户>”的文章大纲。",
        "showInPromptOverview": true,
        "execution": {
          "enabled": true,
          "modelRefId": "model_main",
          "outputTarget": "templateInput",
          "outputInputId": "input_outline",
          "skipBatchWhenOutputExists": true,
          "temperature": 0.7,
          "maxTokens": 2000
        }
      },
      {
        "id": "step_draft",
        "name": "生成正文",
        "description": "根据文章大纲生成正文",
        "content": "请根据以下大纲写作文章正文：\n\n<文章大纲>",
        "showInPromptOverview": true,
        "execution": {
          "enabled": true,
          "modelRefId": "model_main",
          "outputTarget": "stepOutput",
          "skipBatchWhenOutputExists": true,
          "temperature": 0.8,
          "maxTokens": 4000
        }
      }
    ]
  }
}
```

## 可直接交给其他 AI 的任务说明

```text
请根据我的需求设计一个 pwcAI 模板，并严格遵循《pwcAI 模板 JSON 编写与导入指南》。

要求：
1. 先分析需要哪些输入变量和有顺序的步骤。
2. 优先使用可读的英文 ID，保证所有 ID 在模板内唯一。
3. 步骤正文优先使用 <变量名称> 和 [[步骤名称]] 引用。
4. 需要 AI 自动生成的步骤必须绑定模板内 modelRefs。
5. 需要保存给后续步骤使用的结果，优先写入明确的模板变量。
6. 对适合查漏补缺的一键生成步骤，设置 skipBatchWhenOutputExists 为 true。
7. 不要填写 groupId、createdAt、lastModifiedAt、modelPresetId 或任何 API Key。
8. 最终只输出一个合法 JSON 代码块，不要输出 JSON 注释、解释文字或 Markdown 表格。

我的模板需求：
[在这里描述需求]
```

## 导入后的检查清单

导入模板后建议检查：

1. 模型变量是否已绑定本机可用的全局模型预设。
2. 步骤中的变量名称和步骤名称引用是否存在。
3. 写入变量的 AI 步骤是否指向正确的非只读变量。
4. 一键生成保留已有输出是否符合预期。
5. 项目名称规则是否绑定正确变量。
6. 创建一个测试项目，确认步骤顺序和输出流转正确。
