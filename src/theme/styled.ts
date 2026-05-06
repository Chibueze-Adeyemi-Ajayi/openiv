import { styled } from '@mui/material/styles';
import { colorPalette } from './palette';

// Example styled components following the design system

// Container with surface layering
export const SurfaceContainer = styled('div')(({ theme }) => ({
  backgroundColor: colorPalette.surface_container,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  transition: `background-color ${theme.transitions.duration.standard}ms`,
}));

// Card-like container with elevated surface
export const ElevatedCard = styled('div')(({ theme }) => ({
  backgroundColor: colorPalette.surface_container_lowest,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  boxShadow: `0px 20px 40px ${colorPalette.scrim}0f`,
  transition: `box-shadow ${theme.transitions.duration.standard}ms`,

  '&:hover': {
    boxShadow: `0px 20px 40px ${colorPalette.scrim}14`,
  },
}));

// Glassmorphism overlay
export const GlassmorphicOverlay = styled('div')(({ theme }) => ({
  backgroundColor: `${colorPalette.surface_container_lowest}cc`, // 80% opacity
  backdropFilter: 'blur(20px)',
  border: `1px solid ${colorPalette.outline_variant}33`, // 20% opacity
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
}));

// Flex layout with generous spacing
export const FlexLayout = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
});

// Grid layout aligned to 4px/8px
export const GridLayout = styled('div')({
  display: 'grid',
  gridAutoFlow: 'row',
  gap: '1rem',
  gridAutoRows: 'auto',
});

// Subtle boundary using surface color shift
export const SoftBoundary = styled('div')(({ theme }) => ({
  backgroundColor: colorPalette.surface_container_low,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
}));

// Focus-visible ring for keyboard navigation
export const FocusableElement = styled('div')(({ theme }) => ({
  '&:focus-visible': {
    outline: `2px solid ${colorPalette.primary}`,
    outlineOffset: '2px',
  },
}));

// Pill/chip container
export const PillContainer = styled('div')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colorPalette.surface_container,
  padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
  borderRadius: '9999px',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}));

// Attention dot (tertiary color)
export const AttentionDot = styled('div')({
  width: '0.5rem',
  height: '0.5rem',
  borderRadius: '50%',
  backgroundColor: colorPalette.tertiary,
  display: 'inline-block',
  marginRight: '0.5rem',
});
