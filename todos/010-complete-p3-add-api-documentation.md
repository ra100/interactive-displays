---
status: pending
priority: p3
issue_id: "010"
tags: [code-review, documentation, api, agent-native]
dependencies: []
---

# P3: Add Socket Event API Documentation

## Problem Statement

There is no documentation for the socket events available in the system. Agents and integrations cannot discover available commands without reading source code ("context starvation").

## Findings

**From agent-native review:**
- Socket events are well-typed in code but not documented
- New `videoCommand` and `videoState` events undocumented
- No examples of how to integrate programmatically

## Proposed Solution

Create `docs/API.md`:

```markdown
# LCARS Interactive Display API

## Socket Events

### Client → Server

#### stateChange
Change global display state.
```json
{ "state": "normal" | "alert" | "active" | "damaged" }
```

#### videoCommand
Control video playback.
```json
{
  "elementId": "video-1",
  "command": "play" | "pause" | "seek" | "load",
  "time": 30.5,  // for seek
  "src": "https://..."  // for load
}
```

### Server → Client

#### state
Broadcast state change.

#### videoCommand
Broadcast video command to all displays.

## Examples
[...]
```

## Acceptance Criteria

- [ ] Document all socket events
- [ ] Include request/response examples
- [ ] Document TypeScript types available
- [ ] Add integration examples

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from agent-native review | APIs need documentation for discoverability |
