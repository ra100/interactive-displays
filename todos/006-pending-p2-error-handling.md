---
status: pending
priority: p2
issue_id: "006"
tags: [reliability, code-review, server]
dependencies: []
---

# Silent Error Swallowing in File Operations

## Problem Statement

File operations catch all errors and return null/empty arrays, hiding real issues like permission errors, disk full, or corrupted JSON.

**Why it matters:** Debugging becomes impossible when errors are silently swallowed.

## Findings

**Location:** `packages/server/src/layouts.ts:20-22, 39-41`

```typescript
} catch {
  return null;  // Hides ALL errors
}
```

## Proposed Solutions

### Option A: Log Errors + Distinguish Types

```typescript
export async function getLayout(id: string): Promise<Layout | null> {
  try {
    const content = await readFile(layoutPath(id), "utf-8");
    return JSON.parse(content) as Layout;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;  // File not found is expected
    }
    console.error(`Failed to read layout ${id}:`, error);
    throw error;  // Re-throw unexpected errors
  }
}
```

**Effort:** Small (15 min)
**Risk:** Low

## Acceptance Criteria

- [ ] File-not-found returns null (expected case)
- [ ] Other errors are logged and thrown
- [ ] JSON parse errors handled explicitly

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during TypeScript review |
