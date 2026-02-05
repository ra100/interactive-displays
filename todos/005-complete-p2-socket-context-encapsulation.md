---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, architecture, react-context, socket-io]
dependencies: []
---

# P2: Encapsulate Socket in DisplayContext

## Problem Statement

The raw socket instance is exposed through DisplayContext, breaking encapsulation and violating the Dependency Inversion Principle. Components now depend on Socket.io implementation details rather than abstract actions.

Previously, the context exposed action methods (`setGlobalState`, `saveLayout`, `identify`). Now it leaks the raw socket, inviting ad-hoc event handling across components.

## Findings

**Location:** `/packages/app/src/context/DisplayContext.tsx`

```typescript
interface DisplayContextValue {
  // ... existing actions (good)
  socket: AppSocket | null;  // <-- Leaking implementation detail
}
```

**Issues:**
- VideoElement directly manipulates socket events
- Other components may follow this pattern
- Testing becomes harder (must mock socket)
- Socket reference timing issues (captured at memoization)

## Proposed Solutions

### Option A: Add Video Action Methods (Recommended)

**Pros:** Clean abstraction, testable, consistent
**Cons:** More code in context
**Effort:** Medium (1-2 hours)
**Risk:** Low

```typescript
interface DisplayContextValue {
  // ... existing actions
  sendVideoCommand: (command: VideoCommand) => void;
  subscribeToVideoCommands: (handler: (cmd: VideoCommand) => void) => () => void;
}

// In provider:
const sendVideoCommand = useCallback((command: VideoCommand) => {
  socketRef.current?.emit("videoCommand", command);
}, []);

const subscribeToVideoCommands = useCallback(
  (handler: (cmd: VideoCommand) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on("videoCommand", handler);
    return () => socket.off("videoCommand", handler);
  },
  []
);
```

### Option B: Keep Socket But Fix Timing

**Pros:** Less code change
**Cons:** Still breaks encapsulation
**Effort:** Small
**Risk:** Medium

## Recommended Action

Option A - Encapsulate socket with action methods.

## Acceptance Criteria

- [ ] Remove `socket` from context value
- [ ] Add `sendVideoCommand` action
- [ ] Add `subscribeToVideoCommands` for listening
- [ ] Update VideoElement to use new methods
- [ ] Tests don't need to mock socket

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from architecture review | Context should expose actions, not implementations |
