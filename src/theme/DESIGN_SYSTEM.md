# The Architectural Ledger - Design System

## Overview

This design system implements "The Architectural Ledger" — a geometric, editorial-inspired interface that prioritizes clarity, precision, and premium visual hierarchy through tonal layering rather than borders and decorative elements.

## Design Principles

1. **No-Border Philosophy**: Boundaries are defined through background color shifts and tonal transitions, never 1px solid borders.
2. **Surface Layering**: UI is constructed as stacked sheets — use surface containers to create depth.
3. **Geometric Clarity**: Jost font provides a clean, Bauhaus-inspired typographic voice.
4. **Editorial Spacing**: Generous white space defines the layout, not dividers.
5. **Glassmorphism for Overlays**: Floating elements use semi-transparent surfaces with backdrop blur.

## Color Palette

### Primary
- **primary**: `#00288e` — Authoritative core blue
- **primary_container**: `#1e40af` — Lighter blue for emphasis

### Tertiary
- **tertiary**: `#611e00` — Subtle accent for badges, dots

### Surfaces (Layering System)
- **surface**: `#fbf8ff` — Base layer
- **surface_container_low**: `#f5f2fc` — Subtle container
- **surface_container**: `#efe9f9` — Standard container
- **surface_container_high**: `#e9e3f3` — Elevated container
- **surface_container_highest**: `#e3dded` — Top-level container
- **surface_container_lowest**: `#ffffff` — Floating overlay

### Text Colors
- **on_surface**: `#1a1b22` — Primary text (use instead of pure black)
- **on_surface_variant**: `#48464f` — Secondary text

### States
- **error**: `#b3261e`
- **success**: `#1b5e20`
- **warning**: `#f57f17`

## Typography

All text uses **Jost** — a geometric, sans-serif typeface.

| Scale | Size | Weight | Usage |
|-------|------|--------|-------|
| Display LG | 3.5rem | 600 | Page titles |
| Headline LG | 2rem | 500 | Section headings |
| Title LG | 1.375rem | 500 | Card/component titles |
| Body LG | 1rem | 400 | Body text |
| Label MD | 0.75rem | 600 | Tags, buttons (ALL CAPS) |

## Surface Hierarchy

Create visual depth by layering containers:

```
Base Layer (surface) ← #fbf8ff
  ↓
Nested Container (surface_container) ← #efe9f9
  ↓
Elevated Content (surface_container_low) ← #f5f2fc
  ↓
Floating Overlay (surface_container_lowest) ← #ffffff
```

**Rule**: Inner containers should move toward higher-tier surfaces (toward white).

## Components

### Buttons

**Primary** (Gradient)
- Background: Linear gradient from `primary` to `primary_container` at 135°
- Text: `on_primary` (white)
- Padding: 1rem vertical, 2rem horizontal

**Secondary** (Tonal)
- Background: `surface_container_high`
- Text: `primary`

**Tertiary** (Text-only)
- No background
- Text: `primary`
- 2px underline on hover only

### Input Fields

- Background: `surface_container`
- Border: None in default state
- Focus: 2px bottom-border in `primary`
- Label: Above field, ALL CAPS, 0.75rem, 600 weight

### Cards

- Background: `surface_container_lowest` or `surface_container_low`
- Border: None
- Shadow: Ambient only (0px 20px 40px with 10% opacity)
- Radius: 0.375rem

### Lists

- **Dividers**: Forbidden
- **Spacing**: 8px between items
- **Hover**: `surface_container_low` background
- No standard separators

### Tables

- Header: `surface_container_lowest`
- Zebra striping: Forbidden
- Hover: `surface_container_low`
- Numbers: Use tabular-nums font feature

### Dialogs/Modals (Glassmorphism)

- Background: Semi-transparent `surface_container_lowest` (80% opacity)
- Backdrop filter: blur(20px)
- Shadow: Ambient subtle shadow
- Border: 1px outline_variant at 20% opacity

## Utilities & Helpers

### Spacing Scale
- `xs`: 0.25rem (4px)
- `sm`: 0.5rem (8px)
- `md`: 1rem (16px)
- `lg`: 1.5rem (24px)
- `xl`: 2rem (32px)

### Border Radius
- `sm`: 0.25rem (4px)
- `md`: 0.375rem (6px) — default
- `lg`: 0.75rem (12px)
- `full`: 9999px (pills)

### Shadows
All shadows use diffused, subtle opacity for an ink-on-paper feel:
- `sm`: 5% opacity
- `md`: 8% opacity
- `lg`: 10% opacity
- `xl`: 12% opacity

### Transitions
- `fast`: 150ms
- `standard`: 300ms
- `slow`: 500ms

## Do's and Don'ts

### Do ✓
- Use active white space to separate sections
- Align everything to 4px/8px grid
- Use tertiary color (#611e00) for subtle accents
- Apply Jost consistently across all text
- Layer surfaces to create depth

### Don't ✗
- Never use 1px solid borders for sectioning
- Never use pure black (#000000) for text
- Never mix font families
- Never use drop shadows on standard cards
- Never use standard blue for links (use primary_container)

## Using the Theme

### Import theme in components

```tsx
import { useTheme } from '@/theme'

function MyComponent() {
  const theme = useTheme()
  return <div style={{ color: theme.palette.primary.main }}>Hello</div>
}
```

### Import utilities

```tsx
import { colorPalette, glassmorphism, shadows } from '@/theme'
```

### Use MUI components with theme

All MUI components automatically respect the theme configuration.
