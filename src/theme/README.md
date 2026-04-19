# Theme Configuration

This directory contains the complete design system implementation for "The Architectural Ledger."

## File Structure

```
theme/
├── palette.ts          # Color palette definitions
├── typography.ts       # Typography configuration
├── utilities.ts        # Design system utilities (glassmorphism, shadows, etc.)
├── useTheme.ts         # Theme hooks and provider exports
├── theme.ts            # Main theme object with component overrides
├── global.css          # Global styles and font imports
├── index.ts            # Re-exports for clean imports
├── DESIGN_SYSTEM.md    # Design system principles and guidelines
└── README.md           # This file
```

## Quick Start

### Using the Theme in Components

**With Hooks:**
```tsx
import { useTheme } from '@/theme'

function MyComponent() {
  const theme = useTheme()
  
  return (
    <div style={{ color: theme.palette.primary.main }}>
      Hello World
    </div>
  )
}
```

**With styled-components (Emotion):**
```tsx
import { styled } from '@mui/material/styles'

const StyledDiv = styled('div')(({ theme }) => ({
  color: theme.palette.primary.main,
  padding: theme.spacing(2),
}))
```

### Using Color Palette

```tsx
import { colorPalette } from '@/theme'

// Direct color access
const bgColor = colorPalette.surface_container_low
const textColor = colorPalette.on_surface

// Use in styles
const style = {
  backgroundColor: colorPalette.surface,
  color: colorPalette.on_surface,
}
```

### Using Design Utilities

```tsx
import { glassmorphism, shadows, spacing, borderRadius } from '@/theme'

// Glassmorphism effect for overlays
const modalStyle = {
  ...glassmorphism,
  padding: spacing.lg,
}

// Shadows for elevation
const cardStyle = {
  boxShadow: shadows.lg,
  borderRadius: borderRadius.md,
}
```

## Color System

### Primary Colors
- `primary`: #00288e (authoritative blue)
- `primary_container`: #1e40af (lighter blue)

### Surface Hierarchy
Use for layering and depth:
- `surface`: Base layer
- `surface_container_low`: Subtle container
- `surface_container`: Standard container
- `surface_container_high`: Elevated container
- `surface_container_highest`: Top-level container
- `surface_container_lowest`: Floating overlay

### Text Colors
- `on_surface`: Primary text (dark)
- `on_surface_variant`: Secondary text (medium)

## Typography

All text uses **Jost** (geometric, Bauhaus-inspired).

### Scales Available
- `h1`: Display Large (3.5rem, weight 600)
- `h2`: Headline Large (2rem, weight 500)
- `h3`: Title Large (1.375rem, weight 500)
- `body1`: Body Large (1rem, weight 400)
- `body2`: Body Medium (0.875rem, weight 400)
- `button`: Label Medium (0.75rem, weight 600, ALL CAPS)
- `overline`: Overline (0.75rem, weight 600, ALL CAPS)
- `caption`: Caption (0.75rem, weight 400)

## Spacing

Based on 8px grid:
- `xs`: 0.25rem (4px)
- `sm`: 0.5rem (8px)
- `md`: 1rem (16px)
- `lg`: 1.5rem (24px)
- `xl`: 2rem (32px)
- `xxl`: 3rem (48px)

## Border Radius

- `sm`: 0.25rem (4px)
- `md`: 0.375rem (6px) — DEFAULT
- `lg`: 0.75rem (12px)
- `full`: 9999px (pills/circles)

## Shadows

Diffused, subtle (not sharp black):
- `sm`: 5% opacity
- `md`: 8% opacity
- `lg`: 10% opacity
- `xl`: 12% opacity

## Transitions

Smooth motion:
- `fast`: 150ms
- `standard`: 300ms
- `slow`: 500ms

## Component Overrides

MUI components are pre-configured with theme colors and styles:

### Buttons
- **contained**: Gradient primary
- **outlined**: Tonal secondary
- **text**: No background, primary text

### Text Fields
- No visible borders (surface_container background)
- 2px bottom-border on focus (primary color)
- Label positioned above field (ALL CAPS)

### Cards
- Floating layout with subtle shadow
- Hover state uses surface_container_low

### Lists
- 8px item spacing (no dividers)
- Hover state highlights items

### Tables
- Header uses surface_container_lowest
- Hover state for row selection
- Tabular-nums for numeric data

### Dialogs
- Glassmorphism effect
- Backdrop blur (20px)
- Semi-transparent background

## No-Border Philosophy

This design system **forbids standard 1px borders**. Instead:
- Use background color shifts (surface containers)
- Create boundaries through tonal transitions
- For accessibility-required borders, use `outline_variant` at 20% opacity

## Accessibility Features

- All text colors meet WCAG AA contrast requirements
- Focus states are visible (2px outline)
- Button padding is generous (1rem vertical)
- Labels are properly associated with inputs
- Semantic HTML is maintained

## Customization

To modify the theme:

1. **Colors**: Edit `palette.ts`
2. **Typography**: Edit `typography.ts`
3. **Component styles**: Edit `theme.ts` (components section)
4. **Utilities**: Add to `utilities.ts`

All changes will automatically propagate to the entire app.

## Additional Resources

- **Design Principles**: See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- **MUI Documentation**: https://mui.com/material-ui/getting-started/
- **Emotion Documentation**: https://emotion.sh/docs/introduction
