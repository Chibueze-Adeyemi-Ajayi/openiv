import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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
    return localStorage.getItem(SANDBOX_URL_KEY) || 'http://localhost:8081'
  })
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    authApi.session()
      .then(res => {
        setRole(res.role || null)
      })
      .catch(() => {
        setRole(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const setSandboxEnabled = (enabled: boolean) => {
    setSandboxEnabledState(enabled)
    localStorage.setItem(SANDBOX_ENABLED_KEY, String(enabled))
  }

  const setSandboxUrl = (url: string) => {
    setSandboxUrlState(url)
    localStorage.setItem(SANDBOX_URL_KEY, url)
  }

  const isDevOrAdmin = role === 'ADMIN' || role === 'DEVELOPER' || role === 'SUPER_ADMIN'

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
