---
status: pending
priority: p2
issue_id: "010"
tags: [reliability, code-review, server]
dependencies: []
---

# Unhandled Promise on Server Start

## Problem Statement

`start()` returns a Promise that is not caught. If startup fails, the error is silently swallowed.

**Why it matters:** Silent startup failures make debugging impossible.

## Findings

**Location:** `packages/server/src/index.ts:118`

```typescript
start();  // No .catch() - errors vanish
```

## Proposed Solutions

### Option A: Add Error Handler

```typescript
start().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
```

**Effort:** Small (2 min)
**Risk:** None

## Acceptance Criteria

- [ ] Startup errors logged to console
- [ ] Process exits with code 1 on failure
- [ ] Error message is descriptive

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during TypeScript review |
