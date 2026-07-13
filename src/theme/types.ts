/**
 * Design System Type Definitions
 * Provides strong typing for theme usage
 */

import type { CSSProperties } from 'react';
import type { Theme } from '@mui/material/styles';

// Color keys available in the palette
export type ColorKey =
  | 'primary'
  | 'primary_container'
  | 'tertiary'
  | 'surface'
  | 'surface_dim'
  | 'surface_bright'
  | 'surface_container_lowest'
  | 'surface_container_low'
  | 'surface_container'
  | 'surface_container_high'
  | 'surface_container_highest'
  | 'on_surface'
  | 'on_surface_variant'
  | 'on_primary'
  | 'on_primary_container'
  | 'error'
  | 'success'
  | 'warning'
  | 'outline'
  | 'outline_variant'
  | 'scrim'
  | 'inverse_surface'
  | 'inverse_on_surface'
  | 'inverse_primary';

// Spacing scale
export type SpacingKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

// Border radius scale
export type BorderRadiusKey = 'xs' | 'sm' | 'md' | 'lg' | 'full';

// Shadow scale
export type ShadowKey = 'sm' | 'md' | 'lg' | 'xl';

// Transition duration
export type TransitionKey = 'fast' | 'standard' | 'slow';

// Surface container levels
export type SurfaceLevel =
  | 'lowest'
  | 'low'
  | 'base'
  | 'high'
  | 'highest';

// Component size variants
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Button variants available
export type ButtonVariant = 'contained' | 'outlined' | 'text';

// Input variants
export type InputVariant = 'outlined' | 'filled' | 'standard';

// Responsive breakpoint keys
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Z-index levels
export type ZIndexLevel =
  | 'hide'
  | 'base'
  | 'dropdown'
  | 'sticky'
  | 'fixed'
  | 'modalBackdrop'
  | 'modal'
  | 'popover'
  | 'tooltip'
  | 'notification';

// Easing functions
export type Easing =
  | 'linear'
  | 'easeInOut'
  | 'easeOut'
  | 'easeIn'
  | 'sharp';

// Surface layer configuration
export interface SurfaceLayer {
  backgroundColor: string;
  borderRadius?: string | number;
  padding?: string | number;
  boxShadow?: string;
}

// Component props that respect theme
export interface ThemedComponentProps {
  color?: ColorKey;
  spacing?: SpacingKey;
  radius?: BorderRadiusKey;
  shadow?: ShadowKey;
  variant?: ButtonVariant | InputVariant;
  size?: ComponentSize;
}

// Glassmorphism effect props
export interface GlassmorphismProps {
  backgroundColor: string;
  backdropFilter: string;
  border: string;
}

// Extended Theme type for better autocomplete
export interface ExtendedTheme extends Theme {
  customShadows: Record<ShadowKey, string>;
  customSpacing: Record<SpacingKey, string>;
}

// CSS-in-JS style object type
export type StyleObject = CSSProperties & {
  [key: string]: any;
};

// Responsive style object
export type ResponsiveStyle = {
  [key in Breakpoint]?: StyleObject;
} & { default?: StyleObject };

// Color palette structure
export interface ColorPalette {
  primary: string;
  primary_container: string;
  tertiary: string;
  surface: string;
  surface_dim: string;
  surface_bright: string;
  surface_container_lowest: string;
  surface_container_low: string;
  surface_container: string;
  surface_container_high: string;
  surface_container_highest: string;
  on_surface: string;
  on_surface_variant: string;
  on_primary: string;
  on_primary_container: string;
  error: string;
  success: string;
  warning: string;
  outline: string;
  outline_variant: string;
  scrim: string;
  inverse_surface: string;
  inverse_on_surface: string;
  inverse_primary: string;
}

// Typography configuration
export interface TypographyConfig {
  displayLarge: {
    fontSize: string;
    fontWeight: number;
    letterSpacing: string;
    lineHeight: number;
  };
  headlineLarge: {
    fontSize: string;
    fontWeight: number;
    letterSpacing: string;
    lineHeight: number;
  };
  titleLarge: {
    fontSize: string;
    fontWeight: number;
    letterSpacing: string;
    lineHeight: number;
  };
  bodyLarge: {
    fontSize: string;
    fontWeight: number;
    letterSpacing: string;
    lineHeight: number;
  };
  labelMedium: {
    fontSize: string;
    fontWeight: number;
    letterSpacing: string;
    lineHeight: number;
    textTransform: string;
  };
}

// Design token values
export interface DesignTokens {
  colors: ColorPalette;
  spacing: Record<SpacingKey, string>;
  borderRadius: Record<BorderRadiusKey, number>;
  shadows: Record<ShadowKey, string>;
  transitions: Record<TransitionKey, string>;
  breakpoints: Record<Breakpoint, number>;
}

// Helper function to ensure type safety with colors
export const assertColorKey = (key: string): ColorKey => {
  const validKeys: ColorKey[] = [
    'primary',
    'primary_container',
    'tertiary',
    'surface',
    'surface_dim',
    'surface_bright',
    'surface_container_lowest',
    'surface_container_low',
    'surface_container',
    'surface_container_high',
    'surface_container_highest',
    'on_surface',
    'on_surface_variant',
    'on_primary',
    'on_primary_container',
    'error',
    'success',
    'warning',
    'outline',
    'outline_variant',
    'scrim',
    'inverse_surface',
    'inverse_on_surface',
    'inverse_primary',
  ];

  if (!validKeys.includes(key as ColorKey)) {
    throw new Error(`Invalid color key: ${key}`);
  }

  return key as ColorKey;
};
