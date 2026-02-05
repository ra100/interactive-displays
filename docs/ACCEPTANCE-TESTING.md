# Acceptance Criteria Testing Guide

## Automated Tests (✅ Passed)

Run with: `cd packages/app && pnpm exec tsx src/test-connections.ts`

| Criteria | Result |
|----------|--------|
| Server accepts 15+ WebSocket connections | ✅ 20/20 connected |
| State changes propagate within 100ms | ✅ Max 6ms, Avg 4ms |

---

## Manual Testing Checklist

### Prerequisites
```bash
pnpm dev
```
- Server: http://localhost:3010
- App: http://localhost:5176

---

### 1. Display Elements Render Correctly

**Test:** Open http://localhost:5176/builder

- [ ] Drag each element type to canvas:
  - [ ] Elbow - shows L-shaped corner
  - [ ] Bar - shows rounded rectangle
  - [ ] Frame - shows bordered rectangle
  - [ ] Button - shows clickable button with label
  - [ ] Text - shows text label

- [ ] Each element displays with correct color
- [ ] Grid snapping works (elements align to 60px grid)

---

### 2. Builder Creates Layouts via Drag-Drop

**Test:** In builder mode

- [ ] Drag element from palette → drops on canvas
- [ ] Click element → selection ring appears
- [ ] Edit properties → element updates immediately
- [ ] Drag existing element → moves to new position
- [ ] Delete button → removes element
- [ ] Save layout → no errors in console

---

### 3. Operator Panel Triggers State Changes

**Test:** Open two windows:
- Window 1: http://localhost:5176/?screen=test1
- Window 2: http://localhost:5176/builder

- [ ] Click ALERT button → both windows show alert state
- [ ] Click NORMAL button → both windows return to normal
- [ ] Click ACTIVE button → both windows show active state
- [ ] Click DAMAGED button → both windows show damaged state
- [ ] State indicator in operator panel updates

---

### 4. Layouts Persist as JSON Files

**Test:**

- [ ] Create layout in builder with 3+ elements
- [ ] Click Save
- [ ] Refresh the page
- [ ] Layout still shows saved elements
- [ ] Check `data/layouts/` folder has JSON file

---

### 5. Touch Feedback < 50ms

**Test:** On touchscreen device or Chrome DevTools mobile emulation

- [ ] Tap Button element
- [ ] Visual feedback (color change/highlight) appears immediately
- [ ] No perceptible delay

---

### 6. 60fps Animations

**Test:** Open Chrome DevTools → Performance tab

- [ ] Toggle state to ALERT
- [ ] Record performance during pulse animation
- [ ] Check frame rate stays at 60fps (16.6ms per frame)
- [ ] No dropped frames visible

---

### 7. Auto-Reconnect on Disconnect

**Test:**

1. Open display: http://localhost:5176/?screen=test
2. Verify "CONNECTED" status
3. Stop server: `Ctrl+C` on server terminal
4. Verify "DISCONNECTED" status appears
5. Restart server: `pnpm dev`
6. [ ] Verify "CONNECTED" status returns automatically
7. [ ] Verify layout reloads

---

### 8. 10-Level Undo in Builder

**Test:**

1. Open builder
2. Add 12 elements (one at a time)
3. Click Undo 10 times
4. [ ] 10 elements removed (2 remain)
5. [ ] 11th undo does nothing (limit reached)
6. Click Redo 5 times
7. [ ] 5 elements restored

---

### 9. Browser Compatibility

**Test in each browser:**

| Browser | Display | Builder | State Sync |
|---------|---------|---------|------------|
| Chrome  | [ ]     | [ ]     | [ ]        |
| Firefox | [ ]     | [ ]     | [ ]        |
| Safari  | [ ]     | [ ]     | [ ]        |

---

### 10. No Console Errors

**Test:** Open DevTools Console in each scenario

- [ ] Initial page load - no errors
- [ ] Drag-drop operations - no errors
- [ ] State changes - no errors
- [ ] Save/load - no errors
- [ ] Disconnect/reconnect - no errors (warnings OK)

---

## Test Results Summary

| # | Criteria | Status |
|---|----------|--------|
| 1 | Server accepts 15+ connections | ✅ Auto |
| 2 | State changes < 100ms | ✅ Auto |
| 3 | 5 display elements render | ⬜ |
| 4 | Builder drag-drop works | ⬜ |
| 5 | Operator panel works | ⬜ |
| 6 | Layouts persist | ⬜ |
| 7 | Touch feedback < 50ms | ⬜ |
| 8 | 60fps animations | ⬜ |
| 9 | Auto-reconnect | ⬜ |
| 10 | 10-level undo | ⬜ |
| 11 | Chrome/Firefox/Safari | ⬜ |
| 12 | No console errors | ⬜ |

**Tested by:** _______________
**Date:** _______________
