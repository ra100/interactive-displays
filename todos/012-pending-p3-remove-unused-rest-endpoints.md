---
status: pending
priority: p3
issue_id: "012"
tags: [cleanup, code-review, yagni]
dependencies: []
---

# Remove Unused REST Endpoints

## Problem Statement

REST endpoints duplicate Socket.io functionality. The app only uses Socket.io - no HTTP client exists.

## Findings

**Location:** `packages/server/src/index.ts:88-103`

```typescript
fastify.get("/api/layouts", async () => listLayouts());
fastify.get<{ Params: { id: string } }>("/api/layouts/:id", ...);
fastify.post<{ Body: Layout }>("/api/layouts", ...);
```

## Proposed Solutions

Delete the endpoints. Keep `/health` for monitoring.

**Effort:** Small (5 min)
**LOC saved:** 16

## Acceptance Criteria

- [ ] REST layout endpoints removed
- [ ] Health endpoint kept
- [ ] Socket.io still works
- [ ] Knip passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during simplicity review |
