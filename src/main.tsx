import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'
import { ThemeProvider as AppThemeProvider } from './components/dashboard/ThemeContext'
import { SandboxProvider } from './contexts/SandboxContext'
import './theme/global.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppThemeProvider>
        <SandboxProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
          </ThemeProvider>
        </SandboxProvider>
      </AppThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
