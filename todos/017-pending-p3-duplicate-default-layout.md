---
status: pending
priority: p3
issue_id: "017"
tags: [cleanup, code-review]
dependencies: []
---

# Remove Duplicate Default Layout Definition

## Problem Statement

Default layout defined in two places: JSON file and `ensureDefaultLayout()` function. Creates maintenance overhead.

## Findings

**Locations:**
- `packages/server/data/layouts/default.json` (committed)
- `packages/server/src/layouts.ts:73-93` (code)

## Proposed Solutions

### Option A: Keep JSON, Remove Code (Recommended)
Since JSON is now committed, `ensureDefaultLayout()` is redundant. Remove the function.

### Option B: Keep Code, Remove JSON
Remove committed JSON, let code create it on first run.

**Effort:** Small (5 min)

## Acceptance Criteria

- [ ] Only one source of truth for default layout
- [ ] Server still works on fresh clone

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during simplicity review |
