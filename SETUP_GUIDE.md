# Design System Setup Guide

## ✅ What Has Been Configured

### 1. Dependencies Installed
- ✅ `@mui/material` (v7.0.0)
- ✅ `@emotion/react` & `@emotion/styled`
- ✅ `@mui/system`

### 2. Theme Configuration
- ✅ **Color Palette** (`src/theme/palette.ts`) — All "Architectural Ledger" colors
- ✅ **Typography** (`src/theme/typography.ts`) — Jost font, all scales
- ✅ **Theme Object** (`src/theme/theme.ts`) — MUI theme with component overrides
- ✅ **Global Styles** (`src/theme/global.css`) — Font imports, base resets

### 3. Design System Utilities
- ✅ **Color Palette** — Direct color access
- ✅ **Glassmorphism** — Overlay effects with blur
- ✅ **Shadows** — Subtle, diffused elevation shadows
- ✅ **Surface Layers** — Tonal layering helpers
- ✅ **Spacing Scale** — 4px/8px grid alignment
- ✅ **Border Radius** — Consistent rounding
- ✅ **Transitions** — Smooth motion timing

### 4. Styled Components
- ✅ Example components in `src/theme/styled.ts`
- ✅ Pre-built layouts (Flex, Grid, Surface containers)
- ✅ Glassmorphic overlays
- ✅ Focus-visible elements for accessibility

### 5. Documentation
- ✅ **DESIGN_SYSTEM.md** — Principles, colors, typography, components
- ✅ **README.md** — Theme structure and usage guide
- ✅ **This file** — Setup verification and next steps

### 6. App Integration
- ✅ `main.tsx` updated with ThemeProvider
- ✅ CssBaseline applied for base styles
- ✅ Global CSS loaded (Jost font)

### 7. Configuration Files
- ✅ `vite.config.ts` — Path aliases (@)
- ✅ `tsconfig.app.json` — TypeScript path configuration

## 📦 Installation Instructions

Install dependencies:
```bash
npm install
```

## 🚀 Next Steps

### 1. Verify Setup
```bash
npm run dev
```
The app should launch with no errors. Check the browser console.

### 2. Create Your First Component

```tsx
import { useTheme } from '@/theme'
import { Button, Box, Typography } from '@mui/material'

export function HelloWorld() {
  const theme = useTheme()

  return (
    <Box sx={{ p: theme.spacing(3) }}>
      <Typography variant="h2">Welcome to The Architectural Ledger</Typography>
      <Button variant="contained">Get Started</Button>
    </Box>
  )
}
```

### 3. Using Styled Components

```tsx
import { ElevatedCard, FlexLayout } from '@/theme'

export function CardExample() {
  return (
    <ElevatedCard>
      <FlexLayout>
        <h1>Styled with Design System</h1>
        <p>This uses glassmorphic surfaces and proper spacing.</p>
      </FlexLayout>
    </ElevatedCard>
  )
}
```

### 4. Custom Styling with Theme

```tsx
import { styled } from '@mui/material/styles'
import { colorPalette } from '@/theme'

const CustomElement = styled('div')(({ theme }) => ({
  backgroundColor: colorPalette.surface_container,
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.primary.main,
}))
```

## 🎨 Key Design Principles (Remember!)

1. **No Borders** — Use surface color shifts instead of 1px borders
2. **Layering** — Stack surfaces from base (light) to top (white)
3. **Jost Everywhere** — Single font family for geometric clarity
4. **Generous Space** — Increase margins rather than adding dividers
5. **Subtle Shadows** — Only on floating elements (modals, dropdowns)
6. **All Caps for Labels** — Tags and button labels use uppercase

## 📂 Project Structure

```
src/
├── theme/
│   ├── palette.ts           # Colors
│   ├── typography.ts        # Font config
│   ├── utilities.ts         # Helpers
│   ├── styled.ts            # Example components
│   ├── useTheme.ts          # Hooks
│   ├── theme.ts             # Main config
│   ├── global.css           # Global styles
│   ├── DESIGN_SYSTEM.md     # Guidelines
│   ├── README.md            # Usage guide
│   └── index.ts             # Exports
├── App.tsx
├── main.tsx
└── index.css
```

## ✨ Pre-configured MUI Components

The following MUI components are automatically styled:
- ✅ Button (Primary, Secondary, Tertiary)
- ✅ TextField
- ✅ Card
- ✅ Paper
- ✅ Chip
- ✅ List & ListItem
- ✅ Table & TableCell
- ✅ Dialog
- ✅ AppBar
- ✅ Tooltip

All automatically respect the Architectural Ledger design system.

## 🔧 Customization

### Modify Colors
Edit `src/theme/palette.ts` and the theme will update automatically.

### Modify Typography
Edit `src/theme/typography.ts` to adjust font scales.

### Add New Utilities
Add to `src/theme/utilities.ts` for design system helpers.

### Override Component Styles
Edit the `components` section in `src/theme/theme.ts`.

## 📖 Reference Guides

- [Material-UI Docs](https://mui.com/)
- [Emotion Docs](https://emotion.sh/)
- [Design System Principles](./src/theme/DESIGN_SYSTEM.md)
- [Theme Usage Guide](./src/theme/README.md)

## ✅ Checklist Before Building Components

- [ ] Review DESIGN_SYSTEM.md
- [ ] Understand the "No-Border Philosophy"
- [ ] Know the surface hierarchy
- [ ] Familiarize yourself with spacing scale
- [ ] Check example components in `styled.ts`
- [ ] Test responsive behavior at breakpoints

## 🎯 Quick Reference

### Import Theme
```tsx
import { useTheme } from '@/theme'
```

### Import Colors
```tsx
import { colorPalette } from '@/theme'
```

### Import Utilities
```tsx
import { glassmorphism, shadows, spacing } from '@/theme'
```

### Import Styled Components
```tsx
import { ElevatedCard, FlexLayout, GlassmorphicOverlay } from '@/theme'
```

## Need Help?

Refer to:
1. **src/theme/DESIGN_SYSTEM.md** — Design principles
2. **src/theme/README.md** — Usage examples
3. **MUI Docs** — Component API
4. **src/theme/styled.ts** — Example implementations

---

**You're all set!** Start building with the Architectural Ledger design system.
