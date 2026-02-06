---
title: Flex Layout Width Gotchas
category: architecture
tags: [css, flexbox, layout, sidebar]
date: 2026-02-06
---

# Flex Layout Width Gotchas

## Problem

When using flexbox with `flex-direction: column`, children with explicit `width` values don't fill the container - they maintain their explicit width, leaving empty space.

## Symptoms

- Sidebar panels don't reach the edge of the screen
- Gap appears between panel content and container boundary
- Panels have different widths causing visual misalignment

## Root Cause

```css
/* Container */
.sidebar {
  display: flex;
  flex-direction: column;
  width: 440px;  /* Container width */
}

/* Children have explicit widths */
.panel-a { width: 220px; }  /* Only uses half! */
.panel-b { width: 200px; }  /* Mismatched! */
```

In a column flex layout, children stack vertically but their width is NOT automatically stretched to fill the container (unlike `flex-direction: row` where `align-items: stretch` is the default for cross-axis).

## Solution

**Option 1: Remove explicit widths (preferred)**
```css
.sidebar {
  width: 240px;
}

.panel-a, .panel-b {
  /* No width - panels fill container */
}
```

**Option 2: Use width: 100%**
```css
.panel-a, .panel-b {
  width: 100%;
}
```

**Option 3: Use align-items: stretch with min-width**
```css
.sidebar {
  align-items: stretch;
}
```

## Key Insight

When stacking panels vertically, define width ONLY on the container. Let children inherit/fill naturally. Explicit child widths fight the flex layout.

## Related

- Canvas.tsx and LayoutRenderer.tsx prop parity (same element should render identically in both)
- Collapsible panel patterns with `flex: 0 0 auto`
