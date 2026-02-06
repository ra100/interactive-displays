# Deviation: Sidebar Panel Width Approach

## Date
2026-02-06

## Original Plan
> Both panels use the same width (220px) for visual alignment.
> ```css
> .property-panel { width: 220px; }
> .operator-panel { width: 220px; }
> ```

Reference: `docs/plans/2026-02-06-refactor-builder-sidebar-visual-redesign-plan.md`

## What Changed

Instead of setting explicit 220px widths on each panel, we:
1. Removed explicit width from both panels entirely
2. Set the sidebar container to 240px
3. Let panels fill the container naturally via flexbox

Final implementation:
```css
.builder-sidebar {
  width: 240px;
}

.property-panel {
  /* No width - fills container */
}

.operator-panel {
  /* No width - fills container */
}
```

## Justification

The original approach (explicit 220px on each panel) caused a visual offset because:
1. The sidebar container was 440px (legacy from a different layout)
2. 220px panels didn't fill the 440px container
3. A visible gap appeared between panels and the right edge of the screen

Setting width on the container and removing explicit child widths is the correct flexbox pattern for vertically stacked panels.

## Impact
- [x] No impact on other planned work
- Learning documented: `docs/solutions/architecture/006-flex-layout-width-gotchas.md`
