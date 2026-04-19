import { colorPalette } from './palette';

// Glassmorphism effect
export const glassmorphism = {
  backgroundColor: `${colorPalette.surface_container_lowest}cc`, // 80% opacity
  backdropFilter: 'blur(20px)',
  border: `1px solid ${colorPalette.outline_variant}33`, // 20% opacity
};

// Elevation shadows - diffused, subtle
export const shadows = {
  sm: `0px 2px 8px ${colorPalette.scrim}09`, // 5% opacity
  md: `0px 4px 12px ${colorPalette.scrim}0d`, // 8% opacity
  lg: `0px 20px 40px ${colorPalette.scrim}0f`, // 10% opacity
  xl: `0px 25px 50px ${colorPalette.scrim}14`, // 12% opacity
};

// Surface layering helpers
export const surfaceLayers = {
  base: colorPalette.surface,
  containerLow: colorPalette.surface_container_low,
  container: colorPalette.surface_container,
  containerHigh: colorPalette.surface_container_high,
  containerHighest: colorPalette.surface_container_highest,
  containerLowest: colorPalette.surface_container_lowest,
};

// Semantic spacing
export const spacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  xxl: '3rem', // 48px
};

// Border radius scale
export const borderRadius = {
  sm: '0.25rem', // 4px
  md: '0.375rem', // 6px
  lg: '0.75rem', // 12px
  full: '9999px',
};

// No-border philosophy: use this for subtle boundaries
export const subtleBoundary = {
  backgroundColor: colorPalette.surface_container_low,
};

// Focus state (for keyboard navigation)
export const focusState = {
  outline: `2px solid ${colorPalette.primary}`,
  outlineOffset: '2px',
};

// Transition utilities
export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  standard: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
};
