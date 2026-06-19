# pwcAI Beta

pwcAI Beta 是一个本地优先的提示词流程工作台，用模板组织可复用的输入变量、提示词步骤、模型绑定和变量提取流程，再从模板创建具体项目持续填写、执行和沉淀结果。

当前版本：`0.3.7`

## 核心能力

- 使用模板定义输入变量、有序提示词步骤、模型变量和提取预设。
- 在项目中预览渲染后的提示词，复制执行结果，并在后续步骤中引用变量或前序输出。
- 支持可选的 AI 文本生成，将结果写入步骤输出或模板变量。
- 支持本地规则与 AI 补全结合的结构化变量提取，确认后再写入项目。
- 支持模板 JSON 单独导入导出，便于让其他 AI 生成或维护工作流模板。
- 支持项目和模板的全量 JSON 备份、恢复与合并。
- 数据默认保存在本机：浏览器开发环境使用 `localStorage`，Tauri 桌面端使用 Tauri Store。

## 技术栈

- React 19 + TypeScript
- Vite 6
- Tauri 2 + Rust

## 本地开发

### 前置要求

- Node.js 与 npm
- 开发桌面版本时，需要 Rust stable 和 Tauri 的 Windows 构建依赖

安装依赖：

```powershell
npm install
```

启动浏览器开发环境：

```powershell
npm run dev
```

默认地址为 `http://localhost:3004`。

启动 Tauri 桌面开发环境：

```powershell
npx tauri dev
```

## 构建

构建前端生产资源：

```powershell
npm run build
```

构建 Windows 桌面应用和 MSI 安装包：

```powershell
npx tauri build
```

默认产物位置：

- 可执行文件：`src-tauri/target/release/pwcai-beta.exe`
- MSI：`src-tauri/target/release/bundle/msi/`

## 文档

- [项目结构与开发地图](docs/PROJECT_STRUCTURE.md)
- [模板 JSON 编写与导入指南](docs/TEMPLATE_JSON_GUIDE.md)
- [变量提取工具功能设定](docs/VARIABLE_EXTRACTION_SPEC.md)

## 数据说明

pwcAI Beta 是本地优先应用。模板 JSON 仅用于交换单个或多个模板，不包含 API Key；全量备份用于迁移项目、模板和设置。升级或批量调整数据前，建议先从应用内导出完整备份。
