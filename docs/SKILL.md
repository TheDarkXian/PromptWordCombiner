---
name: pwcbeta-project-guide
description: 在 E:\Project\VS\pwcAI 这个 pwcBeta 仓库工作时使用，尤其是修改 UI、项目/模板数据结构、导入导出、Tauri 打包配置，或需要解释“应该改哪里”时。开始前先读 docs/PROJECT_STRUCTURE.md；新的项目文档统一放到 docs/。
---

# pwcBeta 项目工作约定

在这个仓库工作时遵守这些约定：

1. 做非小型改动前，先读 `docs/PROJECT_STRUCTURE.md`。
2. 把 pwcBeta 当作本地优先、全手动的提示词流程工作台。除非用户明确要求，不要加入 AI 自动执行。
3. 新的项目文档统一放到 `docs/`。
4. 保留 v2.1 备份字段兼容性，除非用户明确批准数据迁移。
5. 优先做小而聚焦的改动，贴合当前 React/Tauri 结构。
6. 回答项目结构、术语、修改入口时，默认使用中文。

关键文件：

- `App.tsx`：应用状态、持久化、导入导出、整体布局。
- `types.ts`：项目和模板的数据结构。
- `services/dataCompatibility.ts`：备份数据规范化和导出版本。
- `services/ioService.ts`：Tauri/localStorage 持久化和文件 IO。
- `components/FileLibrary.tsx`：文件库、项目卡片、模板卡片。
- `components/ProjectRunner.tsx`：打开项目后的流程界面。
- `components/Sidebar.tsx`：变量输入、步骤导航、烘焙导出。
- `components/TemplateEditor.tsx`：模板变量和步骤编辑。
- `src-tauri/tauri.conf.json`：窗口标题、产品名、应用 id、打包配置。

验证：

- 代码改动后运行 `npm run build`。
- 打包信息、窗口标题、Tauri 配置变化后运行 `npx tauri build`。

