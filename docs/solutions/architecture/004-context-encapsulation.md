---
title: "Context Encapsulation: Actions Not Implementations"
category: architecture
tags: [react, context, encapsulation, dependency-inversion, testing]
module: app
symptom: "Components depend on socket implementation, testing requires socket mocks"
root_cause: "Context exposes raw socket instead of abstract actions"
severity: medium
date_resolved: 2026-02-05
---

# Context Encapsulation: Actions Not Implementations

## Problem

When React contexts expose implementation details (like raw Socket.io instances), it creates:
1. Tight coupling between components and transport layer
2. Difficult testing (must mock entire socket)
3. Timing issues (socket reference captured at memoization)
4. Components making ad-hoc socket calls

```typescript
// BAD - Leaking socket implementation
interface DisplayContextValue {
  globalState: GlobalState;
  layout: Layout | null;
  socket: AppSocket | null;  // <-- Implementation detail leaked
}

// Components now depend on socket internals
function VideoElement() {
  const { socket } = useDisplay();

  useEffect(() => {
    socket?.on("videoCommand", handleCommand);  // Direct socket manipulation
    return () => socket?.off("videoCommand", handleCommand);
  }, [socket]);

  // Testing requires mocking entire socket
}
```

## Solution

### 1. Replace implementation with actions

```typescript
interface DisplayContextValue {
  globalState: GlobalState;
  layout: Layout | null;
  isConnected: boolean;
  // Actions, not implementations
  setGlobalState: (state: GlobalState) => void;
  saveLayout: (layout: Layout) => void;
  identify: (screenId: string) => void;
  sendVideoCommand: (command: VideoCommand) => void;
  sendVideoState: (state: VideoStateUpdate) => void;
  subscribeToVideoCommands: (handler: (command: VideoCommand) => void) => () => void;
}
```

### 2. Implement actions in provider using ref

```typescript
function DisplayProvider({ children }: DisplayProviderProps) {
  const socketRef = useRef<AppSocket | null>(null);

  const sendVideoCommand = useCallback((command: VideoCommand) => {
    socketRef.current?.emit("videoCommand", command);
  }, []);

  const subscribeToVideoCommands = useCallback(
    (handler: (command: VideoCommand) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on("videoCommand", handler);
      return () => socket.off("videoCommand", handler);
    },
    []
  );

  // ... other actions
}
```

### 3. Update components to use actions

```typescript
function VideoElement({ id }) {
  const { subscribeToVideoCommands, sendVideoState } = useDisplay();

  useEffect(() => {
    function handleCommand(data: VideoCommand) {
      if (data.elementId !== id) return;
      // ... process command
    }

    const unsubscribe = subscribeToVideoCommands(handleCommand);
    return () => unsubscribe();
  }, [subscribeToVideoCommands, id]);
}
```

### 4. Simplified testing

```typescript
// Mock is trivial - just functions
vi.mock("../context/DisplayContext", () => ({
  useDisplay: () => ({
    subscribeToVideoCommands: () => () => {},
    sendVideoState: () => {},
  }),
}));
```

## Key Insight

- Contexts should expose **what** you can do, not **how** it's done
- Actions are stable function references, implementations can change
- Testing becomes trivial - just mock the action functions
- Subscribe patterns return unsubscribe functions for cleanup
- Use refs for mutable values that shouldn't trigger re-renders

## Before/After Comparison

### Before (Leaky)
```typescript
// Context exposes socket
{ socket: AppSocket | null }

// Component uses socket directly
useEffect(() => {
  socket?.on("event", handler);
  return () => socket?.off("event", handler);
}, [socket]);

// Test must mock socket with on/off/emit
```

### After (Encapsulated)
```typescript
// Context exposes actions
{ subscribeToEvents: (handler) => () => void }

// Component uses action
useEffect(() => {
  const unsubscribe = subscribeToEvents(handler);
  return unsubscribe;
}, [subscribeToEvents]);

// Test mocks simple function
{ subscribeToEvents: () => () => {} }
```

## References

- Original todo: 005-p2-socket-context-encapsulation
