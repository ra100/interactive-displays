---
status: pending
priority: p3
issue_id: "015"
tags: [cleanup, code-review, css]
dependencies: []
---

# Extract Inline Styles to CSS

## Problem Statement

Large inline style objects in DisplayScreen are recreated on every render. Inline `<style>` tag for keyframes is unusual for React.

## Findings

**Location:** `packages/app/src/display/DisplayScreen.tsx:12-26, 56-67, 84-91`

## Proposed Solutions

Move to CSS file or use CSS-in-JS with proper caching.

```css
/* theme.css */
@keyframes pulse {
  from { opacity: 1; }
  to { opacity: 0.6; }
}

.display-container {
  width: 100vw;
  height: 100vh;
  /* ... */
}
```

**Effort:** Medium (20 min)

## Acceptance Criteria

- [ ] Keyframe animation in CSS file
- [ ] Static styles extracted
- [ ] No inline style tag in JSX

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during performance review |
