---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, agent-native, ui, video]
dependencies: []
---

# P2: Add Video Playback UI Controls

## Problem Statement

The `videoCommand` socket event allows programmatic video control (play/pause/seek/load), but there is no corresponding UI for human operators. This creates an **action parity violation** - agents can control videos but users cannot easily do the same.

## Findings

**From agent-native review:**
- `videoCommand` socket event is fully functional
- No play/pause button in OperatorPanel or PropertyPanel
- No seek slider or current time display
- Users must use browser dev tools or external scripts

**Current capability map:**
| Action | Agent Tool | User UI |
|--------|-----------|---------|
| Play video | `videoCommand` | NONE |
| Pause video | `videoCommand` | NONE |
| Seek video | `videoCommand` | NONE |
| Load new src | `videoCommand` | Property Panel only (design time) |

## Proposed Solutions

### Option A: Add to PropertyPanel (Recommended)

**Pros:** Contextual - shows when video selected
**Cons:** Only in builder mode
**Effort:** Medium (2-3 hours)
**Risk:** Low

Add to PropertyPanel when video element selected:
- Play/Pause toggle button
- Seek slider
- Current time display
- Volume control (if not muted)

### Option B: Add to OperatorPanel

**Pros:** Always visible, quick access
**Cons:** More complex UI, needs element selector
**Effort:** Medium-Large
**Risk:** Medium

## Recommended Action

Option A - Add video controls to PropertyPanel for selected video elements.

## Acceptance Criteria

- [ ] Play/Pause button for selected video
- [ ] Seek slider with current time
- [ ] Controls send `videoCommand` events
- [ ] Receive `videoState` updates for sync

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from agent-native review | Users need parity with agent capabilities |
