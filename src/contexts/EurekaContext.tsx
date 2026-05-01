import { createContext, useContext, useEffect, useState } from 'react'
import { eurekaApi } from '@/api/eureka'

interface EurekaContextValue {
  eurekaEnabled: boolean
  setEurekaEnabled: (enabled: boolean) => void
  isLoading: boolean
  eurekaBuddyOpen: boolean
  setEurekaBuddyOpen: (open: boolean) => void
}

const EurekaContext = createContext<EurekaContextValue>({
  eurekaEnabled: true,
  setEurekaEnabled: () => {},
  isLoading: false,
  eurekaBuddyOpen: false,
  setEurekaBuddyOpen: () => {},
})

export function EurekaProvider({ children }: { children: React.ReactNode }) {
  const [eurekaEnabled, setEurekaEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem('eureka_companion_enabled')
    return stored === null ? true : stored === 'true'
  })
  const [isLoading, setIsLoading] = useState(true)
  const [eurekaBuddyOpen, setEurekaBuddyOpen] = useState(false)

  useEffect(() => {
    eurekaApi.getSetting()
      .then(data => {
        setEurekaEnabledState(data.eurekaCompanionEnabled)
        localStorage.setItem('eureka_companion_enabled', String(data.eurekaCompanionEnabled))
      })
      .catch(() => {
        // keep localStorage value on error
      })
      .finally(() => setIsLoading(false))
  }, [])

  const setEurekaEnabled = (enabled: boolean) => {
    setEurekaEnabledState(enabled)
    localStorage.setItem('eureka_companion_enabled', String(enabled))

    // We update the backend asynchronously. If it fails, we keep the UI state
    // as requested by the user to avoid 'snapping back' which feels broken.
    eurekaApi.updateSetting(enabled).catch(err => {
      console.error('[Eureka] Failed to sync setting to backend:', err)
    })
  }

  return (
    <EurekaContext.Provider value={{ eurekaEnabled, setEurekaEnabled, isLoading, eurekaBuddyOpen, setEurekaBuddyOpen }}>
      {children}
    </EurekaContext.Provider>
  )
}

export const useEureka = () => useContext(EurekaContext)
