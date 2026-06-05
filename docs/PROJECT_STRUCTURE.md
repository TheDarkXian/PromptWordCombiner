# pwcBeta 项目结构说明

这份文档是 pwcBeta 的项目地图。以后想改 UI、数据结构、导入导出、Tauri 打包配置时，先看这里。

## 这个项目是什么

pwcBeta 是一个本地优先、全手动的提示词流程工作台。

当前产品逻辑是：

- **模板**定义一套可复用的输入变量和流程步骤。
- **项目**是从某个模板创建出来的一个具体案例，比如一个小游戏主题。
- 用户手动填写变量，预览渲染后的提示词，复制提示词去外部工具使用。
- 用户也可以把某一步的手动结果粘回项目，供后续步骤用 `[[1]]` 之类的引用继续拼接。
- 数据保存在本地：浏览器环境用 `localStorage`，Tauri 桌面端用 Tauri Store。
- 支持 JSON 全量备份、恢复和合并。

目前阶段先保持全手动，不做 AI 自动执行。

## 顶层文件说明

| 路径 | 作用 |
| --- | --- |
| `App.tsx` | 主应用状态、持久化加载/保存、项目/模板创建、导入导出、整体布局。 |
| `index.tsx` | React 入口。 |
| `index.html` | HTML 外壳、网页标题、import map。 |
| `types.ts` | 核心数据类型：项目、模板、输入变量、步骤、备份兼容字段。 |
| `constants.ts` | 默认演示模板。 |
| `package.json` | npm 脚本和前端依赖。 |
| `vite.config.ts` | Vite 配置，开发端口是 `3004`，也从 Tauri 配置读取版本号。 |
| `metadata.json` | 项目元数据。 |
| `src-tauri/` | Tauri 桌面端配置、窗口信息、MSI 打包、Rust 入口。 |
| `components/` | React UI 组件。 |
| `services/` | 非 UI 服务，比如本地存储、备份数据兼容。 |
| `docs/` | 项目文档。以后新文档都放这里。 |

## 核心术语

### 模板 Template

类型定义在 `types.ts` 的 `Template`。

模板是一套可复用的工作流结构，包含：

- `id`：模板 id。
- `name`：模板显示名称。
- `inputs`：全局输入变量。
- `steps`：有顺序的提示词步骤。
- `hideProjects`：是否在文件库中隐藏这个模板下的项目。

常见修改位置：

- 模板编辑界面：`components/TemplateEditor.tsx`
- 文件库右侧模板卡片：`components/FileLibrary.tsx`
- 默认演示模板：`constants.ts`

### 模板输入变量 TemplateInput

类型定义在 `types.ts` 的 `TemplateInput`。

这是模板里的全局变量槽。用户在左侧栏填写这些变量。

提示词里可以这样引用：

- `<0>`、`<1>`：按变量顺序引用。
- `<变量名>`：按变量名称引用。

常见修改位置：

- 左侧变量填写：`components/Sidebar.tsx`
- 模板变量编辑：`components/TemplateEditor.tsx`
- 提示词渲染：`components/ProjectRunner.tsx`
- 烘焙导出渲染：`App.tsx`

### 模板步骤 TemplateStep

类型定义在 `types.ts` 的 `TemplateStep`。

这是模板工作流中的一个步骤，每个步骤通常是一段提示词模板。

提示词里可以这样引用步骤输出：

- `[[1]]`、`[[2]]`：按步骤序号引用前面步骤的输出。
- `[[步骤名]]`：按步骤名称引用输出。

常见修改位置：

- 模板步骤编辑：`components/TemplateEditor.tsx`
- 项目步骤卡片：`components/ProjectRunner.tsx`
- 左侧步骤导航：`components/Sidebar.tsx`

### 项目 Project

类型定义在 `types.ts` 的 `Project`。

项目是从模板创建出来的一个具体案例，比如 `Echo Run`、`Candy Flick` 这种具体小游戏主题。

重要字段：

- `templateId`：这个项目使用哪个模板。
- `inputValues`：用户填写好的变量值。
- `customInputs`：项目自己的本地变量。
- `stepOutputs`：用户手动粘贴的步骤输出/备注。
- `stepOverrides`：某个项目对模板步骤提示词的局部修改。
- `variables`、`variableTables`、`stepOutputMeta`、`stepStructuredOutputs`、`stepRunLogs`：v2.1 备份兼容字段，需要保留。

常见修改位置：

- 项目创建、打开、删除：`App.tsx`、`components/FileLibrary.tsx`
- 项目标题和步骤卡片：`components/ProjectRunner.tsx`
- 变量填写：`components/Sidebar.tsx`
- 备份兼容：`services/dataCompatibility.ts`

## 组件地图

| 组件 | 作用 |
| --- | --- |
| `TopNav.tsx` | 顶部栏：应用标题、设置按钮、项目标签页。 |
| `Sidebar.tsx` | 左侧栏：全局变量、本地变量、步骤导航、烘焙导出。 |
| `FileLibrary.tsx` | 文件库主页：项目卡片、模板卡片、分组、排序、备份、恢复、合并入口。 |
| `ProjectRunner.tsx` | 打开项目后的主工作区：步骤卡片和右侧拼接结果总览。 |
| `PromptEditor.tsx` | 单个步骤的提示词预览/复制/源码编辑/局部修改/同步模板。 |
| `TemplateEditor.tsx` | 全屏模板编辑器：编辑输入变量和步骤。 |
| `MergeModal.tsx` | 数据合并工作台。 |
| `ExportModal.tsx` | 全量备份预览、复制、下载。 |
| `CreateProjectModal.tsx` | 创建项目时输入项目名的弹窗。 |
| `SettingsModal.tsx` | UI 缩放和字体大小设置。 |
| `ConfirmationModal.tsx` | 确认/提示弹窗。 |
| `DataPreviewOverlay.tsx` | 只读 JSON/数据详情预览。 |
| `FloatingToast.tsx` | 复制成功之类的小提示。 |
| `Icons.tsx` | 本地图标组件。 |

## 服务地图

| 服务 | 作用 |
| --- | --- |
| `services/ioService.ts` | 本地持久化；在 Tauri Store 和浏览器 localStorage 之间切换；处理文件导入导出。 |
| `services/dataCompatibility.ts` | 规范化备份数据，保留 v2.1 项目字段，统一导出版本。 |
| `services/aiTextService.ts` | 调用文本模型接口。当前按 OpenAI-compatible chat completions 协议执行。 |
| `services/aiAvailabilityService.ts` | 判断某个步骤是否具备 AI 文本生成条件，并给出缺失原因。 |

## Tauri 桌面端地图

| 路径 | 作用 |
| --- | --- |
| `src-tauri/tauri.conf.json` | 产品名、应用 id、窗口标题、开发地址、打包目标。 |
| `src-tauri/Cargo.toml` | Rust 包名、库名、Tauri 插件依赖。 |
| `src-tauri/src/main.rs` | 原生应用入口。 |
| `src-tauri/src/lib.rs` | Tauri Builder 和插件初始化。 |
| `src-tauri/capabilities/default.json` | Tauri 权限：store、fs、dialog、core 等。 |

## 常见需求改哪里

| 想改什么 | 先看哪里 |
| --- | --- |
| 改应用标题/品牌名 | `components/TopNav.tsx`、`index.html`、`metadata.json`、`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` |
| 改窗口标题或 MSI 安装包名字 | `src-tauri/tauri.conf.json` |
| 改备份文件格式或版本 | `services/dataCompatibility.ts`、`App.tsx`、`components/ExportModal.tsx` |
| 改全量恢复逻辑 | `components/FileLibrary.tsx`、`services/dataCompatibility.ts` |
| 改合并导入逻辑 | `components/MergeModal.tsx`、`services/dataCompatibility.ts` |
| 改文件库项目卡片 | `components/FileLibrary.tsx` |
| 改打开项目后的流程界面 | `components/ProjectRunner.tsx` |
| 改提示词预览、复制、编辑 | `components/PromptEditor.tsx` |
| 改 AI 文本生成按钮和写入逻辑 | `components/ProjectRunner.tsx`、`services/aiTextService.ts`、`services/aiAvailabilityService.ts` |
| 改模型提供商/模型预设设置 | `components/SettingsModal.tsx`、`types.ts` |
| 改模板模型变量或步骤 AI 绑定 | `components/TemplateEditor.tsx`、`types.ts` |
| 改左侧变量区 | `components/Sidebar.tsx` |
| 改模板编辑器 | `components/TemplateEditor.tsx` |
| 改数据模型 | `types.ts`，然后同步检查 `services/dataCompatibility.ts` |
| 改本地存储 key | `services/ioService.ts` |
| 改开发端口 | `vite.config.ts` 和 `src-tauri/tauri.conf.json` 的 `build.devUrl` |

## 当前手动工作流

1. 用户打开文件库。
2. 用户选择模板并创建项目。
3. 用户在左侧栏填写全局变量。
4. `ProjectRunner` 把变量和步骤输出拼进提示词预览里。
5. 用户手动复制提示词；成熟模板可以折叠步骤后直接用步骤标题栏的“复制提示词”按钮复制。
6. 用户可以把外部工具生成的结果粘回 `stepOutputs`。
7. 后续步骤可以用 `[[1]]` 或 `[[步骤名]]` 引用前面结果。
8. 用户可以导出烘焙文本，或者导出全量 JSON 备份。

## AI 文本生成结构

当前只接入文本生成，不接入图片生成。

模型配置分三层：

1. **提供商 ProviderConfig**：全局设置，保存 API Key、Base URL、提供商类型和启用状态。
2. **模型预设 ModelPreset**：全局设置，保存一个可读模型名称和具体 `modelName`，并绑定到某个提供商。
3. **模型变量 TemplateModelRef**：模板内配置，步骤绑定模型变量，模型变量再绑定模型预设。

运行时解析顺序：

`步骤 execution.modelRefId` -> `模板 modelRefs` -> `全局 modelPresets` -> `全局 providerConfigs`

设计原则：

- 多个步骤共用同一个模型变量时，只需要在模板左侧修改一次模型变量绑定。
- 未启用 AI 的步骤仍然是手动步骤，只显示复制提示词。
- 启用 AI 的步骤在项目运行页显示“生成文本”。
- AI 生成结果默认写入 `project.stepOutputs[step.id]`，也可以在步骤 AI 配置里选择写入某个模板变量，对应更新 `project.inputValues[inputId]`。
- 输出来源和模型信息写入 `project.stepOutputMeta[step.id]`。
- 最近运行记录写入 `project.stepRunLogs[step.id]`。
- 备份导出会包含提供商和模型预设，但默认清空 API Key。

## 构建命令

在项目根目录运行：

```powershell
npm install
npm run build
npx tauri dev
npx tauri build
```

已知提示：

- Vite 可能会提示 `/index.css doesn't exist at build time`，目前不影响构建完成。

## 文档规则

以后项目文档都放在 `docs/`。

建议命名：

- `PROJECT_STRUCTURE.md`：项目结构、术语、修改入口。
- `DATA_MODEL.md`：以后数据模型复杂了可以单独写。
- `PACKAGING.md`：以后打包/交付流程复杂了可以单独写。
- `CHANGELOG_NOTES.md`：如果需要人工维护发布说明，可以放这里。
