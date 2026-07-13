/**
 * Design System Constants
 * Immutable values used throughout the application
 */

// Grid System (4px base unit = 8 half-units)
export const GRID_BASE = 4; // pixels
export const GRID_UNIT = 8; // pixels (1 spacing unit)

// Breakpoints (mobile-first)
export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 1024,
  lg: 1280,
  xl: 1536,
} as const;

// Z-Index Scale
export const Z_INDEX = {
  hide: -1,
  base: 0,
  dropdown: 1200,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  notification: 1080,
} as const;

// Border Radius Values (in pixels)
export const BORDER_RADIUS = {
  xs: 4,
  sm: 4,
  md: 6, // default
  lg: 12,
  full: 9999,
} as const;

// Spacing Values (in rem)
export const SPACING_VALUES = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  xxl: '3rem', // 48px
} as const;

// Transition Durations (milliseconds)
export const TRANSITION_DURATION = {
  fastest: 100,
  fast: 150,
  standard: 300,
  slow: 500,
  slowest: 700,
} as const;

// Transition Easing
export const EASING = {
  linear: 'linear',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
} as const;

// Opacity Values
export const OPACITY = {
  disabled: 0.38,
  hover: 0.08,
  focus: 0.12,
  activated: 0.16,
  pressed: 0.16,
  full: 1,
  glass: 0.8, // Glassmorphism background
  outline: 0.2, // Subtle outline fallback
} as const;

// Font Sizes (in rem)
export const FONT_SIZE = {
  xs: '0.625rem', // 10px
  sm: '0.75rem', // 12px
  base: '1rem', // 16px
  lg: '1.125rem', // 18px
  xl: '1.25rem', // 20px
  '2xl': '1.5rem', // 24px
  '3xl': '1.875rem', // 30px
  '4xl': '2.25rem', // 36px
  '5xl': '3rem', // 48px
  '6xl': '3.75rem', // 60px
} as const;

// Font Weights
export const FONT_WEIGHT = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

// Line Heights
export const LINE_HEIGHT = {
  tight: 1.2,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

// Letter Spacing (in em)
export const LETTER_SPACING = {
  tighter: '-0.02em',
  tight: '-0.01em',
  normal: '0em',
  wide: '0.01em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

// Blur Amounts
export const BLUR = {
  sm: 'blur(4px)',
  md: 'blur(12px)',
  lg: 'blur(20px)',
  xl: 'blur(40px)',
} as const;

// Shadow Opacity Levels
export const SHADOW_OPACITY = {
  xs: 0.05, // 5%
  sm: 0.09, // 9%
  md: 0.12, // 12%
  lg: 0.15, // 15%
  xl: 0.18, // 18%
} as const;

// Aspect Ratios
export const ASPECT_RATIO = {
  square: '1 / 1',
  video: '16 / 9',
  '4/3': '4 / 3',
  '3/2': '3 / 2',
  'golden': '1.618 / 1',
} as const;

// Touch Target Sizes (minimum 48px = Material Design spec)
export const TOUCH_TARGET = {
  min: '3rem', // 48px
  button: '2.75rem', // 44px (compact)
  icon: '2.5rem', // 40px (icon-only button)
} as const;

// Animation Presets
export const ANIMATION = {
  none: 'none',
  fade: 'fade',
  slide: 'slide',
  scale: 'scale',
  rotate: 'rotate',
} as const;

// Max Widths
export const MAX_WIDTH = {
  xs: '20rem', // 320px
  sm: '24rem', // 384px
  md: '28rem', // 448px
  lg: '32rem', // 512px
  xl: '36rem', // 576px
  '2xl': '42rem', // 672px
  '3xl': '48rem', // 768px
  '4xl': '56rem', // 896px
  '5xl': '64rem', // 1024px
  '6xl': '72rem', // 1152px
  '7xl': '80rem', // 1280px
  full: '100%',
  screen: '100vw',
} as const;

// Container Sizes
export const CONTAINER_SIZE = {
  xs: { width: '100%', maxWidth: '36rem' }, // 576px
  sm: { width: '100%', maxWidth: '48rem' }, // 768px
  md: { width: '100%', maxWidth: '64rem' }, // 1024px
  lg: { width: '100%', maxWidth: '80rem' }, // 1280px
  xl: { width: '100%', maxWidth: '96rem' }, // 1536px
} as const;

// Responsive padding
export const RESPONSIVE_PADDING = {
  xs: { padding: '0.5rem' }, // 8px
  sm: { padding: '1rem' }, // 16px
  md: { padding: '1.5rem' }, // 24px
  lg: { padding: '2rem' }, // 32px
  xl: { padding: '3rem' }, // 48px
} as const;
