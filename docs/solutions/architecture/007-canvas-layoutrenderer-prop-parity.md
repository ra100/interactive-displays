---
title: Canvas and LayoutRenderer Prop Parity
category: architecture
tags: [react, components, builder, display]
date: 2026-02-06
---

# Canvas and LayoutRenderer Prop Parity

## Problem

The same layout elements render differently in Builder (Canvas.tsx) vs Display (LayoutRenderer.tsx) because props aren't passed consistently.

## Symptoms

- Button corner styles work in Display but not in Builder
- Elbow arm widths don't preview correctly in Builder
- "What you see is NOT what you get" - builder preview doesn't match final output

## Root Cause

Canvas.tsx (builder) and LayoutRenderer.tsx (display) have separate switch statements for rendering elements. When one is updated, the other gets forgotten.

```typescript
// Canvas.tsx - MISSING corner props
case "button":
  return <Button {...baseProps} label={element.label ?? "BUTTON"} />;

// LayoutRenderer.tsx - HAS corner props
case "button":
  return (
    <Button
      {...baseProps}
      label={element.label ?? "BUTTON"}
      leftCorner={element.leftCorner ?? "round"}
      rightCorner={element.rightCorner ?? "round"}
    />
  );
```

## Solution

**Always update BOTH files when adding element props.**

Checklist when adding element properties:
- [ ] Add to shared types (`@interactive-displays/shared`)
- [ ] Add to Canvas.tsx element rendering
- [ ] Add to LayoutRenderer.tsx element rendering
- [ ] Add to PropertyPanel.tsx for editing
- [ ] Add to BuilderPage.tsx default values (for new elements)

## Prevention

Consider extracting element rendering to a shared function:

```typescript
// Shared element renderer
export const renderElement = (element: LayoutElement, globalState: GlobalState) => {
  switch (element.type) {
    case "button":
      return (
        <Button
          col={element.col}
          row={element.row}
          // ... all props in one place
        />
      );
  }
};
```

Then both Canvas and LayoutRenderer import and use the same renderer.

## Related

- PropertyPanel handlers consolidation pattern
- Type-safe generic handlers with `<K extends keyof LayoutElement>`
