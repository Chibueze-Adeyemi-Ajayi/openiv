# 🎨 Design Reference Card

## The Architectural Ledger - Quick Visual Reference

---

## 🎨 Color Palette

### Primary Colors
```
Primary Blue         #00288e
Primary Container    #1e40af
Tertiary Accent      #611e00
```

### Surface Layering (Lightest to Darkest)
```
├─ surface_container_lowest  #ffffff  ← Most elevated (floating)
├─ surface_container_low     #f5f2fc
├─ surface_container         #efe9f9
├─ surface_container_high    #e9e3f3
├─ surface_container_highest #e3dded
└─ surface                   #fbf8ff  ← Base layer

Dim Surface                   #ebe9f3
Bright Surface                #ffffff
```

### Text Colors
```
on_surface          #1a1b22  ← Primary text (dark)
on_surface_variant  #48464f  ← Secondary text
on_primary          #ffffff  ← Text on primary
```

### Semantic Colors
```
Error               #b3261e
Success             #1b5e20
Warning             #f57f17
```

### Supporting Colors
```
Outline             #79747e
Outline Variant     #cac7d0  (use 20% opacity for subtle borders)
Scrim               #000000  (shadow base)
Inverse Surface     #313037
Inverse On Surface  #f4eff4
Inverse Primary     #b3d9ff
```

---

## 📝 Typography Scale

### Font Family
**Jost** — Geometric, Bauhaus-inspired, sans-serif

### Typography Scales

| Name | Size | Weight | Letter Spacing | Use Case |
|------|------|--------|---|---|
| **Display Large** | 3.5rem | 600 | -0.02em | Page titles |
| **Headline Large** | 2rem | 500 | -0.01em | Section headings |
| **Title Large** | 1.375rem | 500 | 0em | Card titles |
| **Body Large** | 1rem | 400 | 0em | Body text |
| **Label Medium** | 0.75rem | 600 | +0.05em | Tags, buttons (ALL CAPS) |

---

## 🎯 Surface Hierarchy

### Visual Depth Through Layering

```
┌─────────────────────────────────────────┐
│  Floating Overlay                       │  ← surface_container_lowest #ffffff
│  (Dialog, Tooltip, Dropdown)            │
│  ─────────────────────────────────────  │
│                                         │
│  Card on Container                      │  ← surface_container_low #f5f2fc
│  ─────────────────────────────────────  │
│                                         │
│  Standard Container                     │  ← surface_container #efe9f9
│  ─────────────────────────────────────  │
│                                         │
│  Base Layer                             │  ← surface #fbf8ff
│  ─────────────────────────────────────  │
└─────────────────────────────────────────┘
```

**Rule:** Inner containers always move toward lighter (higher) surfaces.

---

## 🎨 Component Styling Reference

### Buttons

```
┌─────────────────────────┐
│ PRIMARY (Gradient)      │
│ Gradient: #00288e → #1e40af at 135°
│ Text: #ffffff (on_primary)
│ Padding: 1rem vertical, 2rem horizontal
└─────────────────────────┘

┌─────────────────────────┐
│ SECONDARY (Tonal)       │
│ BG: #e9e3f3 (surface_container_high)
│ Text: #00288e (primary)
└─────────────────────────┘

┌─────────────────────────┐
│ TERTIARY (Text)         │
│ No background
│ Text: #00288e (primary)
│ Underline on hover only (2px)
└─────────────────────────┘
```

### Input Fields

```
┌─────────────────────────┐
│ DEFAULT STATE           │
│ BG: #efe9f9 (surface_container)
│ Border: None
│ Label: ABOVE, All Caps, 0.75rem, 600
└─────────────────────────┘

┌─────────────────────────┐
│ FOCUSED STATE           │
│ BG: #efe9f9
│ Border: 2px bottom #00288e
│ Label: All Caps, Primary color
└─────────────────────────┘
```

### Cards

```
┌─────────────────────────┐
│ ELEVATED CARD           │
│ BG: #ffffff
│ Shadow: 0px 20px 40px rgba(26,27,34, 0.1)
│ Radius: 6px
│ Transition on hover
└─────────────────────────┘

┌─────────────────────────┐
│ HOVER STATE             │
│ BG: #f5f2fc (surface_container_low)
│ Shadow: Slightly stronger
└─────────────────────────┘
```

---

## 📏 Spacing Scale

```
xs   = 0.25rem = 4px      (smallest, very tight)
sm   = 0.5rem  = 8px      (small, snug)
md   = 1rem    = 16px     (medium, standard)
lg   = 1.5rem  = 24px     (large, spacious)
xl   = 2rem    = 32px     (extra large)
xxl  = 3rem    = 48px     (double extra large)
```

**Grid Alignment:** All spacing aligns to 4px or 8px grid

---

## 🔲 Border Radius

```
sm   = 4px    (small corners)
md   = 6px    (default, most common)
lg   = 12px   (large corners)
full = 9999px (perfect circles & pills)
```

---

## 🌫️ Shadow Reference

All shadows use diffused, subtle opacity (never sharp black).

```
sm = 0px 2px 8px rgba(0,0,0, 0.05)     [5% opacity]
md = 0px 4px 12px rgba(0,0,0, 0.08)    [8% opacity]
lg = 0px 20px 40px rgba(0,0,0, 0.10)   [10% opacity]
xl = 0px 25px 50px rgba(0,0,0, 0.12)   [12% opacity]
```

**Use:** Shadows only on floating elements (modals, dropdowns, etc.)

---

## ⏱️ Transitions

```
fast     = 150ms  (quick interactions like hover)
standard = 300ms  (normal state changes)
slow     = 500ms  (opening/closing modals)
```

**Easing:** cubic-bezier(0.4, 0, 0.2, 1)

---

## 🔍 No-Border Philosophy

### ❌ FORBIDDEN
```css
/* 1px solid borders for sectioning */
border: 1px solid #cac7d0;  /* Never! */
```

### ✅ APPROVED ALTERNATIVES

**Option 1: Surface Color Shift**
```css
background-color: #efe9f9;  /* surface_container */
/* On #fbf8ff (surface) background, this defines a boundary */
```

**Option 2: Tonal Background**
```css
background-color: #f5f2fc;  /* surface_container_low */
/* Subtle color change = soft boundary */
```

**Option 3: Accessibility Fallback (20% opacity outline)**
```css
border: 1px solid rgba(202, 199, 208, 0.2);  /* outline_variant at 20% */
```

---

## 💫 Glassmorphism Pattern

### Used for: Floating overlays, modals, dropdowns

```css
background-color: rgba(255, 255, 255, 0.8);  /* surface_container_lowest at 80% opacity */
backdrop-filter: blur(20px);
border: 1px solid rgba(202, 199, 208, 0.2);  /* outline_variant at 20% opacity */
border-radius: 6px;
box-shadow: 0px 20px 40px rgba(26, 27, 34, 0.1);
```

---

## 📐 Typical Measurements

### Button
```
Height: 44px minimum
Padding: 16px vertical, 32px horizontal
Min width: 64px
Border radius: 6px (md)
```

### Input Field
```
Height: 56px
Padding: 12px horizontal, 16px vertical (label above)
Border radius: 6px (md)
Focus border: 2px bottom
```

### Card
```
Min height: 100px (content-dependent)
Padding: 16px (md) to 32px (lg)
Border radius: 6px (md)
Gap between items: 8px (sm)
```

### List Item
```
Min height: 48px (touch target)
Padding: 12px horizontal, 8px vertical
Gap between items: 8px (sm)
Hover BG: #f5f2fc (surface_container_low)
```

---

## 🎯 Responsive Breakpoints

```
xs = 0px   (mobile)
sm = 640px (tablet small)
md = 1024px (tablet large)
lg = 1280px (desktop)
xl = 1536px (wide desktop)
```

---

## ♿ Accessibility Requirements

### Contrast Ratios (WCAG AA)
- Text on surface: 4.5:1 minimum
- UI components: 3:1 minimum
- Large text (>24px): 3:1 minimum

### Focus States
```css
outline: 2px solid #00288e;
outline-offset: 2px;
```

### Touch Targets
- Minimum: 48px × 48px
- Recommended: 56px × 56px

---

## 🏷️ Label Styling

### All Labels Use:
```
Font: Jost
Size: 0.75rem (12px)
Weight: 600 (semibold)
Letter Spacing: +0.05em
Text Transform: UPPERCASE
Color: #1a1b22 (on_surface)
Position: Above field (not floating inside)
```

---

## 🎨 Color Usage Examples

### Link Color
```css
color: #1e40af;  /* primary_container, NOT standard blue */
```

### Attention Dot (New, Notification)
```css
background-color: #611e00;  /* tertiary */
```

### Error Text
```css
color: #b3261e;  /* error */
```

### Success State
```css
color: #1b5e20;  /* success */
```

---

## 🔄 Common Combinations

### Primary Action Container
```
Background: Linear gradient #00288e → #1e40af (135°)
Text: #ffffff (on_primary)
Label: 0.75rem, 600, UPPERCASE
```

### Secondary Content Area
```
Background: #efe9f9 (surface_container)
Text: #1a1b22 (on_surface)
Padding: 1rem (md) to 1.5rem (lg)
```

### Floating Overlay
```
Background: rgba(255,255,255, 0.8) (surface_container_lowest + opacity)
Backdrop: blur(20px)
Shadow: lg (10% opacity)
Border: 1px outline_variant at 20%
```

### Data Table Header
```
Background: #ffffff (surface_container_lowest)
Text: #1a1b22 (on_surface), 600 weight
Border: 1px outline_variant at 20% (bottom)
Font: Jost, tabular-nums
```

---

## ✨ Quick Checklist Before Shipping

- [ ] No 1px solid borders for sectioning
- [ ] All text uses Jost font
- [ ] Primary text is #1a1b22, not #000000
- [ ] Links use #1e40af (primary_container)
- [ ] Button padding 1rem × 2rem
- [ ] Labels are ALL CAPS
- [ ] Surface hierarchy respected (light → dark → light)
- [ ] Shadows only on floating elements
- [ ] Hover states defined for interactive elements
- [ ] Focus states visible for keyboard nav
- [ ] Contrast meets WCAG AA
- [ ] Responsive at xs, sm, md, lg, xl breakpoints

---

**Print this card and keep it handy while developing!**

For detailed explanations, see `src/theme/DESIGN_SYSTEM.md`
