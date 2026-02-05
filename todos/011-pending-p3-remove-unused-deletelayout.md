---
status: pending
priority: p3
issue_id: "011"
tags: [cleanup, code-review, yagni]
dependencies: []
---

# Remove Unused deleteLayout Function

## Problem Statement

`deleteLayout` function is exported but never imported or used anywhere. YAGNI violation.

## Findings

**Location:** `packages/server/src/layouts.ts:63-70`

```typescript
export async function deleteLayout(id: string): Promise<boolean> {
  try {
    await unlink(layoutPath(id));
    return true;
  } catch {
    return false;
  }
}
```

## Proposed Solutions

Delete the function. Add back when delete UI is implemented.

**Effort:** Small (2 min)
**LOC saved:** 9

## Acceptance Criteria

- [ ] Function removed
- [ ] No TypeScript errors
- [ ] Knip passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during simplicity review |
