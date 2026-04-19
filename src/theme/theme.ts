import { createTheme } from '@mui/material/styles';
import { colorPalette } from './palette';
import { typographyConfig } from './typography';

const themeOptions = {
  palette: {
    primary: {
      main: colorPalette.primary,
      light: colorPalette.primary_container,
      dark: colorPalette.primary,
      contrastText: colorPalette.on_primary,
    },
    secondary: {
      main: colorPalette.surface_container_high,
      light: colorPalette.surface_container,
      dark: colorPalette.surface_container_highest,
      contrastText: colorPalette.primary,
    },
    tertiary: {
      main: colorPalette.tertiary,
      light: '#8d4513',
      dark: colorPalette.tertiary,
      contrastText: colorPalette.on_primary,
    },
    error: {
      main: colorPalette.error,
      light: '#d32f2f',
      dark: '#b3261e',
    },
    warning: {
      main: colorPalette.warning,
      light: '#fbc02d',
      dark: '#f57f17',
    },
    success: {
      main: colorPalette.success,
      light: '#43a047',
      dark: colorPalette.success,
    },
    background: {
      default: colorPalette.surface,
      paper: colorPalette.surface_container_lowest,
    },
    text: {
      primary: colorPalette.on_surface,
      secondary: colorPalette.on_surface_variant,
    },
    divider: `${colorPalette.outline_variant}33`, // 20% opacity fallback
  },

  typography: typographyConfig,

  shape: {
    borderRadius: 6, // 0.375rem default for md
  },

  spacing: 8, // 8px base unit for the grid system

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
    // Button Component
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.05em',
          padding: '1rem 2rem',
          borderRadius: '0.375rem',
        },
        contained: {
          background: `linear-gradient(135deg, ${colorPalette.primary} 0%, ${colorPalette.primary_container} 100%)`,
          color: colorPalette.on_primary,
          boxShadow: 'none',
          '&:hover': {
            background: `linear-gradient(135deg, ${colorPalette.primary} 0%, ${colorPalette.primary} 100%)`,
            boxShadow: 'none',
          },
        },
        outlined: {
          border: 'none',
          backgroundColor: colorPalette.surface_container_high,
          color: colorPalette.primary,
          '&:hover': {
            backgroundColor: colorPalette.surface_container,
            border: 'none',
          },
        },
        text: {
          color: colorPalette.primary,
          '&:hover': {
            backgroundColor: `${colorPalette.primary}08`,
          },
        },
      },
    },

    // Text Field Component
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: colorPalette.surface_container,
            borderRadius: '0.375rem',
            '& fieldset': {
              border: 'none',
            },
            '&:hover fieldset': {
              border: 'none',
            },
            '&.Mui-focused fieldset': {
              border: `2px solid ${colorPalette.primary}`,
            },
          },
          '& .MuiInputLabel-root': {
            position: 'relative',
            transform: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: colorPalette.on_surface,
            marginBottom: '0.5rem',
            '&.Mui-focused': {
              color: colorPalette.primary,
            },
          },
        },
      },
    },

    // Card Component
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: colorPalette.surface_container_lowest,
          border: 'none',
          boxShadow: 'none',
          borderRadius: '0.375rem',
          transition: 'background-color 0.2s ease',
          '&:hover': {
            backgroundColor: colorPalette.surface_container_low,
          },
        },
      },
    },

    // Paper Component (base layering)
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: colorPalette.surface,
          border: 'none',
        },
        elevation0: {
          boxShadow: 'none',
        },
        elevation1: {
          boxShadow: `0px 20px 40px ${colorPalette.scrim}0f`, // 6% opacity
        },
        elevation2: {
          boxShadow: `0px 20px 40px ${colorPalette.scrim}14`, // 8% opacity
        },
        elevation3: {
          boxShadow: `0px 20px 40px ${colorPalette.scrim}1a`, // 10% opacity
        },
      },
    },

    // Chip Component
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: colorPalette.surface_container,
          border: 'none',
          height: 'auto',
          padding: '0.25rem 0.75rem',
          borderRadius: '9999px', // full
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
        },
      },
    },

    // List Component (no dividers)
    MuiList: {
      styleOverrides: {
        root: {
          padding: 0,
        },
      },
    },

    MuiListItem: {
      styleOverrides: {
        root: {
          padding: '0.5rem 0',
          '&:hover': {
            backgroundColor: colorPalette.surface_container_low,
          },
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: {
          backgroundColor: `${colorPalette.outline_variant}33`, // 20% opacity
          borderColor: `${colorPalette.outline_variant}33`,
        },
      },
    },

    // Table Component
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: colorPalette.surface_container_lowest,
        },
      },
    },

    MuiTableBody: {
      styleOverrides: {
        root: {
          '& tr:hover': {
            backgroundColor: colorPalette.surface_container_low,
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${colorPalette.outline_variant}33`, // 20% opacity
          fontVariantNumeric: 'tabular-nums',
        },
      },
    },

    // Dialog/Modal (Glassmorphism)
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: colorPalette.surface_container_lowest,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${colorPalette.outline_variant}33`,
          boxShadow: `0px 20px 40px ${colorPalette.scrim}0f`,
        },
      },
    },

    // AppBar
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: colorPalette.surface,
          color: colorPalette.on_surface,
          boxShadow: `0px 1px 0px ${colorPalette.outline_variant}33`,
        },
      },
    },

    // Tooltip
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colorPalette.on_surface,
          color: colorPalette.surface,
          fontSize: '0.75rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.375rem',
        },
      },
    },
  },
};

export const theme = createTheme(themeOptions);
