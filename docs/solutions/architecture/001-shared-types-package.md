---
title: "Shared Types Package in Monorepo"
category: architecture
tags: [monorepo, typescript, pnpm, workspace, types]
module: shared
symptom: "Cross-package imports via fragile relative paths"
root_cause: "No dedicated package for shared types"
severity: medium
date_resolved: 2026-02-05
---

# Shared Types Package in Monorepo

## Problem

App package imported types from server using fragile relative paths:

```typescript
// BAD - breaks if directory structure changes
import type { GlobalState } from "../../../server/src/types.js";
```

This violates package boundaries and breaks isolated builds.

## Solution

Create a dedicated shared package:

```
packages/
  shared/
    package.json
    src/types.ts
    tsconfig.json
```

**package.json:**
```json
{
  "name": "@interactive-displays/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/types.ts",
  "types": "./src/types.ts",
  "exports": {
    ".": "./src/types.ts"
  }
}
```

**Add as workspace dependency:**
```json
// packages/app/package.json
{
  "dependencies": {
    "@interactive-displays/shared": "workspace:*"
  }
}
```

**Import via package name:**
```typescript
// Clean import
import type { GlobalState } from "@interactive-displays/shared";
```

## Key Insight

In a monorepo, shared code should live in its own package with a proper `package.json`. Use `workspace:*` protocol for internal dependencies. This enables:
- Proper package boundaries
- Isolated builds
- IDE autocomplete
- Future extraction to npm if needed

## References

- [pnpm Workspaces](https://pnpm.io/workspaces)
- Original todo: 003-p2-shared-types-package
