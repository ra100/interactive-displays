---
status: pending
priority: p3
issue_id: "008"
tags: [code-review, refactoring, constants, dry]
dependencies: []
---

# P3: Extract Duplicate Grid Constants

## Problem Statement

`CELL_SIZE = 60` and `GAP = 4` are duplicated across 9+ files. This creates maintenance burden and risk of inconsistency.

## Findings

**Duplicate locations:**
- `/packages/app/src/components/VideoElement.tsx:21`
- `/packages/app/src/components/Elbow.tsx:17-19`
- `/packages/app/src/components/Button.tsx:18-20`
- `/packages/app/src/components/Bar.tsx:15`
- `/packages/app/src/components/Text.tsx:15`
- `/packages/app/src/components/Frame.tsx:15`
- `/packages/app/src/builder/Canvas.tsx:17`
- `/packages/app/src/display/DisplayScreen.tsx:9`
- `/packages/app/src/builder/BuilderPage.tsx:140` (magic number 64)

## Proposed Solution

Create shared constants file:

```typescript
// packages/app/src/constants/grid.ts
export const CELL_SIZE = 60;
export const GAP = 4;
export const CELL_WITH_GAP = CELL_SIZE + GAP;
export const GRID_COLUMNS = 12;
```

## Acceptance Criteria

- [ ] Create `/packages/app/src/constants/grid.ts`
- [ ] Update all component imports
- [ ] Remove duplicate definitions
- [ ] Verify no magic numbers remain

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from pattern analysis | Centralize constants for maintainability |
