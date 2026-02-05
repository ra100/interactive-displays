---
status: pending
priority: p3
issue_id: "016"
tags: [cleanup, code-review, react]
dependencies: []
---

# Use useRef for Socket Instance

## Problem Statement

Socket stored in useState but only used in callbacks. A ref would be simpler and avoid stale closure issues.

## Findings

**Location:** `packages/app/src/context/DisplayContext.tsx:46-49`

```typescript
const [socket, setSocket] = useState<Socket<...> | null>(null);
```

## Proposed Solutions

```typescript
const socketRef = useRef<Socket<...> | null>(null);

useEffect(() => {
  socketRef.current = io(SERVER_URL);
  // ...
  return () => { socketRef.current?.close(); };
}, []);

const setGlobalState = useCallback((state: GlobalState) => {
  socketRef.current?.emit("stateChange", state);
}, []); // No dependency on socket
```

**Effort:** Small (10 min)

## Acceptance Criteria

- [ ] Socket uses useRef instead of useState
- [ ] Callbacks have empty dependency arrays
- [ ] Socket.io still works

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during TypeScript review |
