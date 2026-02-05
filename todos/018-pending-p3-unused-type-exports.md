---
status: pending
priority: p3
issue_id: "018"
tags: [cleanup, code-review, yagni]
dependencies: []
---

# Remove Unused Type Exports

## Problem Statement

`ElbowDirection` and `BarOrientation` types are defined but only partially used. These are for Phase 2 elements.

## Findings

**Location:** `packages/server/src/types.ts:7-9`

```typescript
export type ElbowDirection = "TL" | "TR" | "BL" | "BR";
export type BarOrientation = "horizontal" | "vertical";
```

## Proposed Solutions

Remove until Phase 2 when these elements are implemented. Or keep for documentation.

**Effort:** Small (2 min)
**LOC saved:** 3

**Note:** These types ARE used in the `LayoutElement` interface as optional properties. They're not strictly unused, but the element types that use them don't exist yet.

## Acceptance Criteria

- [ ] Decision made: keep or remove
- [ ] If removed, add back in Phase 2

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during simplicity review |
