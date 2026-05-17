export const colorPalette = {
  // Primary - Institutional Royal Blue (Corrected)
  primary: '#00288e',
  primary_container: '#1e40af',

  // Accent - Lime Green for high-conversion CTAs
  accent: '#d9f99d',
  accent_dark: '#bef264',

  // Surfaces - The Layering System
  surface: '#fbf8ff',
  surface_dim: '#ebe9f3',
  surface_bright: '#ffffff',
  surface_container_lowest: '#ffffff',
  surface_container_low: '#f5f2fc',
  surface_container: '#efe9f9',
  surface_container_high: '#e9e3f3',
  surface_container_highest: '#e3dded',

  // On-Surface Text Colors
  on_surface: '#1a1b22',
  on_surface_variant: '#48464f',

  // On-Primary Colors
  on_primary: '#ffffff',
  on_primary_container: '#ffffff',

  // Error/Success States
  error: '#b3261e',
  success: '#1b5e20',
  warning: '#f57f17',

  // Outline/Borders
  outline: '#79747e',
  outline_variant: '#cac7d0',

  // Additional Semantic Colors
  scrim: '#000000',
  inverse_surface: '#313037',
  inverse_on_surface: '#f4eff4',
  inverse_primary: '#b3d9ff',

  // Tertiary - Complementary purple accent
  tertiary: '#7c3aed',
};

export type ColorKey = keyof typeof colorPalette;
