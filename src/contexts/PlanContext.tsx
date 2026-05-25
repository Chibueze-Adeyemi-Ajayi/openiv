import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export interface PlanLimitEvent {
  feature: string
  currentPlan: string
  requiredPlan: string
  detail?: string
}

interface PlanContextValue {
  upgradeModal: PlanLimitEvent | null
  triggerUpgrade: (evt: PlanLimitEvent) => void
  closeUpgrade: () => void
}

const PlanCtx = createContext<PlanContextValue>({
  upgradeModal: null,
  triggerUpgrade: () => {},
  closeUpgrade:   () => {},
})

export function PlanProvider({ children }: { children: ReactNode }) {
  const [upgradeModal, setUpgradeModal] = useState<PlanLimitEvent | null>(null)
  const navigate = useNavigate()

  // Listen for 402 plan:limit events dispatched by apiRequest
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<PlanLimitEvent>).detail
      if (d?.feature) setUpgradeModal(d)
    }
    window.addEventListener('plan:limit', handler)
    return () => window.removeEventListener('plan:limit', handler)
  }, [])

  const triggerUpgrade = useCallback((evt: PlanLimitEvent) => {
    setUpgradeModal(evt)
  }, [])

  const closeUpgrade = useCallback(() => setUpgradeModal(null), [])

  return (
    <PlanCtx.Provider value={{ upgradeModal, triggerUpgrade, closeUpgrade }}>
      {children}
    </PlanCtx.Provider>
  )
}

export function usePlanModal() {
  return useContext(PlanCtx)
}
