---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, race-condition, react, video]
dependencies: []
---

# P1: Fix VideoElement Race Conditions on Unmount

## Problem Statement

The VideoElement command queue continues processing after component unmount, causing operations on detached DOM nodes. The `processQueue` function is async and awaits `video.play()`, but nothing stops it when the component unmounts mid-operation.

## Findings

**Location:** `/packages/app/src/components/VideoElement.tsx`

**Race condition sequence:**
1. User sends "play" command
2. `processQueue()` starts, sets `processingRef.current = true`
3. `await video.play()` begins
4. **Component unmounts** - cleanup runs, `socket.off()` called
5. Promise resolves, code continues executing on detached video element
6. `processingRef.current = false` and potentially another `processQueue()` call

**Additional issues:**
- Command queue persists when `src` becomes empty
- Recursive `processQueue()` can cause stack buildup
- Video events fire during source changes (false "paused" state)

## Proposed Solutions

### Option A: Add Disposed Ref Guard (Recommended)

**Pros:** Simple, effective, minimal changes
**Cons:** None
**Effort:** Small (30 min)
**Risk:** Low

```typescript
const disposedRef = useRef(false);

// In useEffect cleanup:
return () => {
  disposedRef.current = true;
  commandQueueRef.current = [];  // Clear queue
  socket.off("videoCommand", handleCommand);
};

// In processQueue, after each await:
case "play":
  await video.play();
  if (disposedRef.current) return;  // Bail out
  break;
```

### Option B: Use AbortController

**Pros:** More idiomatic for async cancellation
**Cons:** Overkill for this use case
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A - Add disposed ref guard and clear queue on unmount.

## Acceptance Criteria

- [ ] Commands stop processing after unmount
- [ ] Queue cleared on unmount
- [ ] Queue cleared when src becomes empty
- [ ] Use `queueMicrotask` to break recursive call stack
- [ ] No errors logged for disposed components

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from race condition review | Async operations need lifecycle guards |
