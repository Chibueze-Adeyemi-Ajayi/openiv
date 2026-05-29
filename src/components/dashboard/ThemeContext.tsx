import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { createAppTheme } from '@/theme/theme'

export type ThemeMode = 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  toggle: () => void
  setMode: (m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  toggle: () => {},
  setMode: () => {},
})

function getSavedMode(): ThemeMode {
  // Dark theme temporarily disabled — always light until re-enabled
  return 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getSavedMode)

  const setMode = (m: ThemeMode) => {
    setModeState(m)
    document.documentElement.setAttribute('data-theme', m)
    document.documentElement.style.colorScheme = m
    try { window.localStorage.setItem('openiv-theme', m) } catch { /* ignore */ }
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
    document.documentElement.style.colorScheme = mode
  }, [mode])

  const muiTheme = useMemo(() => createAppTheme(mode), [mode])

  return (
    <ThemeContext.Provider value={{ mode, toggle: () => setMode(mode === 'light' ? 'dark' : 'light'), setMode }}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

export const useThemeMode = () => useContext(ThemeContext)
