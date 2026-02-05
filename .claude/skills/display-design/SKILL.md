---
name: display-design
description: Visual design system and UX patterns for interactive displays. Use when defining colors, typography, animations, touch targets, or reviewing visual consistency. Supports multiple themes (LCARS is the default).
metadata:
  project: interactive-displays
  role: designer
---

# Display Design System

## Design Principles

1. **Functional aesthetic** - Every shape has purpose
2. **Color as information** - Colors indicate status, not decoration
3. **Touch-first** - 60px minimum targets
4. **Glanceable** - Readable from across the room
5. **Theme-agnostic** - Components work with any visual style

## Theme Architecture

Themes are defined via CSS custom properties:

```css
/* Theme: LCARS (default) */
:root[data-theme="lcars"] {
  --theme-font: 'Antonio', sans-serif;
  --theme-primary: #ff9900;
  --theme-secondary: #ffcc99;
  --theme-accent: #cc99cc;
  --theme-info: #9999ff;
  --theme-radius: 30px;
}

/* Theme: Modern (example alternative) */
:root[data-theme="modern"] {
  --theme-font: 'Inter', sans-serif;
  --theme-primary: #3b82f6;
  --theme-secondary: #60a5fa;
  --theme-accent: #8b5cf6;
  --theme-info: #06b6d4;
  --theme-radius: 8px;
}
```

## State Colors (Theme-Independent)

| State | Color | Animation |
|-------|-------|-----------|
| Normal | `var(--theme-secondary)` | None |
| Alert | `#ff0000` | 0.5s pulse |
| Active | `#99ff99` | None |
| Damaged | `#666666` | Grayscale filter |

## Typography

Defined by theme, with fallbacks:

```css
.element-text {
  font-family: var(--theme-font, system-ui, sans-serif);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

| Style | Size | Weight | Transform |
|-------|------|--------|-----------|
| Label | 1rem | 400 | UPPERCASE |
| Title | 1.5rem | 700 | UPPERCASE |
| Data | 2rem | 700 | None |
| Button | 1.25rem | 700 | UPPERCASE |

## Touch Targets

| Element | Minimum | Recommended |
|---------|---------|-------------|
| Button | 60×60px | 80×60px |
| Operator Button | 80×80px | 150×80px |
| Small control | 44×44px | 60×60px |

## Animation Specs

### State Transition

```css
transition: background-color 0.3s ease-out;
```

### Alert Pulse

```css
@keyframes state-pulse {
  from { opacity: 1; }
  to { opacity: 0.6; }
}
animation: state-pulse 0.5s ease-in-out infinite alternate;
```

### Button Press

- Feedback: < 50ms
- Effect: 20% darker background
- Recovery: 150ms ease-out

## Element Specs

### Elbow

- Corner radius: `var(--theme-radius, 30px)`
- Minimum arm: 40px wide, 60px tall

### Bar

- Border radius: Half of height (pill shape)
- Minimum height: 20px

### Frame

- Border width: 4px
- Border radius: `calc(var(--theme-radius, 30px) / 4)`
- Padding: 12px

### Button

- Minimum: 60×60px
- Border radius: `calc(var(--theme-radius, 30px) / 4)`
- Press state: 20% darker

## Quality Checklist

- [ ] Colors use CSS custom properties
- [ ] Interactive elements ≥ 60px
- [ ] Text styles consistent with theme
- [ ] Theme font loaded and applied
- [ ] State colors clearly distinct
- [ ] Animations smooth (60fps)
- [ ] Touch feedback < 50ms
- [ ] No hardcoded theme-specific values
