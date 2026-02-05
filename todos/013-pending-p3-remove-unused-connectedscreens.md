---
status: pending
priority: p3
issue_id: "013"
tags: [cleanup, code-review, yagni]
dependencies: []
---

# Remove Unused connectedScreens from Context

## Problem Statement

`connectedScreens` is exposed in context but never consumed by any component. Feature not yet implemented.

## Findings

**Location:** `packages/app/src/context/DisplayContext.tsx:24, 53, 81-83, 116`

```typescript
connectedScreens: string[];
const [connectedScreens, setConnectedScreens] = useState<string[]>([]);
newSocket.on("connectedScreens", (screens) => {
  setConnectedScreens(screens);
});
```

## Proposed Solutions

Remove until builder phase needs to show connected displays.

**Effort:** Small (5 min)
**LOC saved:** 5

## Acceptance Criteria

- [ ] connectedScreens removed from context
- [ ] Socket event handler removed
- [ ] TypeScript compiles
- [ ] Re-add in Phase 3 when builder shows screen list

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during simplicity review |
