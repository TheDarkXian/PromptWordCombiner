---
name: project-docs-management
description: Maintain repository documentation under a local docs directory with consistent metadata headers, stable titles, created_at and updated_at timestamps, document indexing, and lightweight project-specific documentation hygiene. Use when creating, moving, updating, or organizing product reports, plans, specs, decisions, or project notes in this repository.
---

# Project Docs Management

Store formal project documents under `docs/`.

Use this metadata header in every formal document:

```yaml
---
title: 文档标题
author: 作者
created_at: YYYY-MM-DD HH:mm:ss +08:00
updated_at: YYYY-MM-DD HH:mm:ss +08:00
type: report | plan | spec | decision | note | index
status: draft | active | archived
---
```

Apply these rules:

- Keep `created_at` unchanged after first creation.
- Update `updated_at` whenever document content changes materially.
- Use a stable, readable `title`.
- Prefer Chinese filenames when the project primarily uses Chinese.
- Keep documents in `docs/` unless the user asks for another location.
- Add new long-lived documents to [docs/README.md](./../../docs/README.md) so there is a visible index.

Use these document types:

- `report`: investigation, audit, survey
- `plan`: roadmap, milestone plan, iteration plan
- `spec`: technical design, schema, interface definition
- `decision`: important tradeoff or architecture decision
- `note`: temporary but useful working note
- `index`: catalog or navigation document

When converting an ad hoc note into a formal project document:

1. Move it into `docs/`.
2. Add the metadata header.
3. Normalize the title and filename.
4. Add or update the entry in `docs/README.md`.

When updating an existing document:

1. Preserve `created_at`.
2. Change `updated_at`.
3. Avoid rewriting history unless the user asks for a full replacement.
4. Keep links stable when practical.
