import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi } from '@/api/auth'

interface SandboxContextValue {
  sandboxEnabled: boolean
  setSandboxEnabled: (enabled: boolean) => void
  sandboxUrl: string
  setSandboxUrl: (url: string) => void
  isDevOrAdmin: boolean
  isLoading: boolean
}

const SandboxContext = createContext<SandboxContextValue | undefined>(undefined)

const SANDBOX_ENABLED_KEY = 'openiv_sandbox_enabled'
const SANDBOX_URL_KEY = 'openiv_sandbox_url'

export function SandboxProvider({ children }: { children: ReactNode }) {
  const [sandboxEnabled, setSandboxEnabledState] = useState<boolean>(() => {
    return localStorage.getItem(SANDBOX_ENABLED_KEY) === 'true'
  })
  const [sandboxUrl, setSandboxUrlState] = useState<string>(() => {
    return (
      localStorage.getItem(SANDBOX_URL_KEY) ||
      (import.meta.env.VITE_SANDBOX_BASE_URL as string | undefined) ||
      'http://localhost:8081'
    )
  })
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // On localhost isDevOrAdmin is always true via hostname check — skip the round-trip.
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      setIsLoading(false)
      return
    }
    authApi.session()
      .then(res => { setRole(res.role || null) })
      .catch(() => { setRole(null) })  // 401 is expected on public pages — not an error
      .finally(() => { setIsLoading(false) })
  }, [])

  const setSandboxEnabled = (enabled: boolean) => {
    setSandboxEnabledState(enabled)
    localStorage.setItem(SANDBOX_ENABLED_KEY, String(enabled))
  }

  const setSandboxUrl = (url: string) => {
    setSandboxUrlState(url)
    localStorage.setItem(SANDBOX_URL_KEY, url)
  }

  const r = (role || '').toUpperCase()
  // Extremely permissive check for any role containing 'ADMIN' or 'DEV'
  // Also enable on localhost for development convenience
  const isDevOrAdmin = 
    r.includes('ADMIN') || 
    r.includes('DEV') || 
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'

  return (
    <SandboxContext.Provider
      value={{
        sandboxEnabled,
        setSandboxEnabled,
        sandboxUrl,
        setSandboxUrl,
        isDevOrAdmin,
        isLoading
      }}
    >
      {children}
    </SandboxContext.Provider>
  )
}

export function useSandbox() {
  const context = useContext(SandboxContext)
  if (context === undefined) {
    throw new Error('useSandbox must be used within a SandboxProvider')
  }
  return context
}
