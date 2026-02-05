---
status: pending
priority: p2
issue_id: "003"
tags: [architecture, code-review, typescript]
dependencies: []
---

# Cross-Package Import via Relative Path

## Problem Statement

The app package imports types from server using fragile relative paths: `import from "../../../server/src/types.js"`. This creates tight coupling that will break if directory structure changes.

**Why it matters:** Violates package boundaries, breaks isolated builds, creates maintenance burden.

## Findings

**Location:** `packages/app/src/context/DisplayContext.tsx:10-15`

```typescript
import type {
  GlobalState,
  Layout,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../../../server/src/types.js";
```

Also in: `packages/app/src/display/DisplayScreen.tsx:4`

## Proposed Solutions

### Option A: Create Shared Package (Recommended)

```
packages/
  shared/
    src/types.ts
    package.json  # "@interactive-displays/shared"
```

Both server and app import from `@interactive-displays/shared`.

**Pros:** Clean architecture, proper package boundaries
**Cons:** More files to maintain
**Effort:** Medium (30 min)
**Risk:** Low

### Option B: Export Types from Server Package

Add `exports` field to server's package.json:
```json
{
  "exports": {
    "./types": "./src/types.ts"
  }
}
```

Import as: `import type { ... } from "@interactive-displays/server/types"`

**Pros:** No new package
**Cons:** Server becomes a dependency of app
**Effort:** Small (15 min)
**Risk:** Low

## Acceptance Criteria

- [ ] No relative path imports crossing package boundaries
- [ ] Types importable via package name
- [ ] Both server and app compile successfully
- [ ] IDE autocomplete works

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during architecture review |
