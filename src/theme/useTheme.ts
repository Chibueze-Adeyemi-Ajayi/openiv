import { useTheme as muiUseTheme, ThemeProvider } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

export const useTheme = muiUseTheme as () => Theme;

export { ThemeProvider };
