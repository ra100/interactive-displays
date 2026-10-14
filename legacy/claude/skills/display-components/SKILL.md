---
name: display-components
description: Visual element library development. Use when creating or modifying Elbow, Bar, Frame, Button, or Text components in packages/app/src/components/. Components are theme-agnostic.
metadata:
  project: interactive-displays
  role: component-developer
---

# Display Component Development

## Components (5 Total)

| Component | Purpose |
|-----------|---------|
| Elbow | Curved corner connecting bars |
| Bar | Horizontal/vertical bar with rounded ends |
| Frame | Rectangular border around content |
| Button | Touchable element, 60px min target |
| Text | Static text display |

## Theme System

Components receive colors from CSS custom properties, making them theme-agnostic:

```css
:root {
  /* Theme-provided colors */
  --theme-primary: #ff9900;
  --theme-secondary: #ffcc99;
  --theme-accent: #cc99cc;

  /* State colors */
  --state-normal: var(--theme-secondary);
  --state-alert: #ff0000;
  --state-active: #99ff99;
  --state-damaged: #666666;

  /* Dimensions */
  --element-radius: 30px;
}
```

## State Response Pattern

All components respond to global state:

```typescript
import { useDisplay } from '../context/DisplayContext';

function Bar({ color, orientation }: BarProps) {
  const { globalState } = useDisplay();
  return (
    <div
      className={`element-bar element-bar--${orientation} state--${globalState}`}
      style={{ '--element-color': color } as React.CSSProperties}
    />
  );
}
```

## CSS Patterns

```css
.element {
  background-color: var(--element-color);
  transition: background-color 0.3s ease-out;
}

.state--alert {
  animation: state-pulse 0.5s ease-in-out infinite alternate;
}

@keyframes state-pulse {
  to { opacity: 0.6; }
}

.state--damaged {
  filter: grayscale(80%);
  opacity: 0.7;
}
```

## Component Props

```typescript
interface ElbowProps {
  direction: 'TL' | 'TR' | 'BL' | 'BR';
  color: string;
}

interface BarProps {
  orientation: 'horizontal' | 'vertical';
  color: string;
}

interface FrameProps {
  color: string;
  children?: React.ReactNode;
}

interface ButtonProps {
  label: string;
  color: string;
  onTap?: () => void;
}

interface TextProps {
  content: string;
  color: string;
}
```

## Typography

Theme-provided font family:

```css
.element-text {
  font-family: var(--theme-font, 'Antonio', sans-serif);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

## Quality Checklist

- [ ] All components accept `color` prop
- [ ] All components respond to `globalState`
- [ ] Button minimum 60px touch target
- [ ] Button press feedback < 50ms
- [ ] CSS transitions 0.3s for state changes
- [ ] Alert state has pulse animation
- [ ] Damaged state has grayscale
- [ ] No hardcoded colors (use CSS custom properties)
- [ ] Theme-agnostic class names (no style-specific prefixes)
