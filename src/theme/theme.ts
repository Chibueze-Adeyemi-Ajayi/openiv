import { createTheme } from '@mui/material/styles';
import { colorPalette, darkColorPalette } from './palette';
import { typographyConfig } from './typography';

function buildThemeOptions(p: typeof colorPalette, mode: 'light' | 'dark') {
  return {
    palette: {
      mode,
      primary: {
        main: p.primary,
        light: p.primary_container,
        dark: p.primary,
        contrastText: p.on_primary,
      },
      secondary: {
        main: p.surface_container_high,
        light: p.surface_container,
        dark: p.surface_container_highest,
        contrastText: p.primary,
      },
      tertiary: {
        main: p.tertiary,
        light: '#8d4513',
        dark: p.tertiary,
        contrastText: p.on_primary,
      },
      error: {
        main: p.error,
        light: '#d32f2f',
        dark: '#b3261e',
      },
      warning: {
        main: p.warning,
        light: '#fbc02d',
        dark: '#f57f17',
      },
      success: {
        main: p.success,
        light: '#43a047',
        dark: p.success,
      },
      background: {
        default: p.surface,
        paper: p.surface_container_low,
      },
      text: {
        primary: p.on_surface,
        secondary: p.on_surface_variant,
      },
      divider: `${p.outline_variant}66`,
    },

    typography: typographyConfig,

    shape: {
      borderRadius: 6,
    },

    spacing: 8,

    breakpoints: {
      values: {
        xs: 0,
        sm: 640,
        md: 1024,
        lg: 1280,
        xl: 1536,
      },
    },

    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none' as const,
            fontWeight: 600,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            padding: '1rem 2rem',
            borderRadius: '0.375rem',
          },
          contained: {
            background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primary_container} 100%)`,
            color: p.on_primary,
            boxShadow: 'none',
            '&:hover': {
              background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primary} 100%)`,
              boxShadow: 'none',
            },
          },
          outlined: {
            border: 'none',
            backgroundColor: p.surface_container_high,
            color: p.primary,
            '&:hover': {
              backgroundColor: p.surface_container,
              border: 'none',
            },
          },
          text: {
            color: p.primary,
            '&:hover': {
              backgroundColor: `${p.primary}08`,
            },
          },
        },
      },

      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              backgroundColor: p.surface_container,
              borderRadius: '0.375rem',
              '& fieldset': { border: 'none' },
              '&:hover fieldset': { border: 'none' },
              '&.Mui-focused fieldset': { border: `2px solid ${p.primary}` },
            },
            '& .MuiInputLabel-root': {
              position: 'relative' as const,
              transform: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
              color: p.on_surface,
              marginBottom: '0.5rem',
              '&.Mui-focused': { color: p.primary },
            },
          },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: p.surface_container_low,
            border: 'none',
            boxShadow: 'none',
            borderRadius: '0.375rem',
            transition: 'background-color 0.2s ease',
            '&:hover': { backgroundColor: p.surface_container },
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: p.surface_container_low,
            border: 'none',
          },
          elevation0: { boxShadow: 'none' },
          elevation1: { boxShadow: `0px 20px 40px ${p.scrim}0f` },
          elevation2: { boxShadow: `0px 20px 40px ${p.scrim}14` },
          elevation3: { boxShadow: `0px 20px 40px ${p.scrim}1a` },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            backgroundColor: p.surface_container,
            border: 'none',
            height: 'auto',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
          },
        },
      },

      MuiList: {
        styleOverrides: {
          root: { padding: 0 },
        },
      },

      MuiListItem: {
        styleOverrides: {
          root: {
            padding: '0.5rem 0',
            '&:hover': { backgroundColor: p.surface_container_low },
          },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: {
            backgroundColor: `${p.outline_variant}66`,
            borderColor: `${p.outline_variant}66`,
          },
        },
      },

      MuiTableHead: {
        styleOverrides: {
          root: { backgroundColor: p.surface_container_low },
        },
      },

      MuiTableBody: {
        styleOverrides: {
          root: {
            '& tr:hover': { backgroundColor: p.surface_container_low },
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${p.outline_variant}66`,
            fontVariantNumeric: 'tabular-nums' as const,
          },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: p.surface_container_low,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${p.outline_variant}66`,
            boxShadow: `0px 20px 40px ${p.scrim}0f`,
          },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: p.surface,
            color: p.on_surface,
            boxShadow: `0px 1px 0px ${p.outline_variant}66`,
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: p.on_surface,
            color: p.surface,
            fontSize: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
          },
        },
      },

      MuiPopover: {
        styleOverrides: {
          paper: {
            backgroundColor: p.surface_container_low,
            border: `1px solid ${p.outline_variant}66`,
          },
        },
      },
    },
  };
}

export function createAppTheme(mode: 'light' | 'dark') {
  const p = mode === 'dark' ? darkColorPalette : colorPalette;
  return createTheme(buildThemeOptions(p, mode) as Parameters<typeof createTheme>[0]);
}

// Default light theme (used in non-dashboard pages, auth pages, etc.)
export const theme = createAppTheme('light');
