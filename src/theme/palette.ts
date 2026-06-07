export const darkColorPalette = {
  // Primary — kept same for brand consistency
  primary: '#4d8ff5',
  primary_container: '#1e40af',

  // Accent
  accent: '#d9f99d',
  accent_dark: '#bef264',

  // Surfaces — true black / near-black
  surface: '#080808',
  surface_dim: '#040404',
  surface_bright: '#111114',
  surface_container_lowest: '#0d0d0d',
  surface_container_low: '#111114',
  surface_container: '#181818',
  surface_container_high: '#1e1e1e',
  surface_container_highest: '#242424',

  // On-Surface Text Colors — pure white for readability
  on_surface: '#ffffff',
  on_surface_variant: '#b0b0b8',

  // On-Primary Colors
  on_primary: '#ffffff',
  on_primary_container: '#ffffff',

  // Error/Success States
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',

  // Outline/Borders
  outline: '#3a3a3e',
  outline_variant: '#2c2c30',

  // Additional Semantic Colors
  scrim: '#000000',
  inverse_surface: '#e8e8ed',
  inverse_on_surface: '#1c1c1f',
  inverse_primary: '#00288e',

  // Tertiary
  tertiary: '#a78bfa',
}

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
