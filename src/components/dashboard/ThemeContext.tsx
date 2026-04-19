import { createContext, useContext, useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark'

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to light. Dark mode infrastructure stays in place but is not exposed yet.
  const [mode, setMode] = useState<ThemeMode>('light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
    document.documentElement.style.colorScheme = mode
    window.localStorage.setItem('openiv-theme', mode)
  }, [mode])

  return (
    <ThemeContext.Provider value={{ mode, toggle: () => setMode((m) => (m === 'light' ? 'dark' : 'light')), setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useThemeMode = () => useContext(ThemeContext)
