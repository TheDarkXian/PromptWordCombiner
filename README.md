# PromptWordSplicer

PromptWordSplicer is a local desktop tool built with React, Vite, and Tauri 2 for managing prompt templates, project variables, and multi-step execution flows.

The product name is **PromptWordSplicer**. The Chinese display name `提示词拼接器` is used for the app window title and user-facing Chinese UI.

## Current Capabilities

- Template, project, variable, and multi-step prompt workflow management
- Project-level variable interpolation and step output reuse
- Text model execution through OpenAI, DeepSeek, Anthropic, and OpenAI-compatible providers
- Provider API connectivity checks from the settings UI
- Structured output parsing into fields, variables, and table-like data
- Producer-node preflight checks, semi-automated batch runs, and run logs
- CSV and JSON export for batch run results
- Local persistence, backup export, import compatibility checks, and merge workflows

## Prerequisites

Install the following before running the project locally:

- Node.js 22 or the current compatible LTS release
- Rust toolchain via `rustup`
- Tauri CLI 2

Verify the toolchain:

```bash
node -v
cargo -V
npx tauri -V
```

## Dependency Policy

- This repository uses `npm`
- `package-lock.json` is committed and must stay in sync with dependency changes
- `src-tauri` contains first-class application source and must not drift locally outside version control

## Install

```bash
npm install
```

If PowerShell blocks `npm.ps1`, use:

```bash
cmd /c npm install
```

## Development

Run the web app:

```bash
npm run dev
```

Run the Tauri desktop app:

```bash
npm run tauri:dev
```

## Build

Frontend build:

```bash
npm run build
```

Desktop build:

```bash
npm run tauri:build
```

## Quality Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run verify
```

`verify` runs `typecheck`, `lint`, `test`, and `build` in sequence.

## Pre-release Verification

Before sharing a local build, run:

```bash
npm run verify
npm run tauri:build -- --debug
```

The Tauri debug build should produce a local MSI under `src-tauri/target/debug/bundle/msi/`.

In restricted sandbox environments, Vite or Vitest may fail with `spawn EPERM` while starting the esbuild child process. In that case, rerun the same command in a normal local shell or with the required permission; this is an environment permission issue, not a source failure.

## Repository Notes

- `src-tauri/Cargo.toml`, `src-tauri/build.rs`, and `src-tauri/src/*.rs` are tracked source files
- `src-tauri/target/` and `src-tauri/gen/schemas/` are generated artifacts and stay ignored
- When scripts, dependencies, or build behavior change, update this README in the same change

## Code Structure

- `App.tsx`: top-level composition, modal wiring, and project/template coordination
- `hooks/`: app-level orchestration for persistence, batch run progress, and shared state actions
- `components/template-editor/`: TemplateEditor subpanels and step card UI
- `components/project-runner/`: ProjectRunner shell, preview, step card, and run log panels
- `components/settings-modal/` and `components/sidebar/`: decomposed modal/sidebar UI blocks
- `services/`: application-facing logic for execution prep, import/export transforms, interpolation, and I/O
- `domain/`: UI-agnostic normalization and mutation helpers

## Troubleshooting

### `npm` fails in PowerShell

Use `cmd /c npm <command>`, or adjust the local PowerShell execution policy.

### `npx tauri -V` fails

Install the Tauri CLI first, then rerun `npm run tauri:dev` or `npm run tauri:build`.
