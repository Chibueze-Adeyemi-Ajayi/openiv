import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Case } from '@/api/cases'

export interface CaseSnap {
  id: string
  title: string
  priority: string
  status: string
  riskScore: number
}

interface ActiveCaseContextValue {
  caseId: string | null
  caseSnap: CaseSnap | null
  isWorkspaceOpen: boolean
  isMinimized: boolean
  openCase: (c: Case) => void
  openCaseById: (id: string) => void
  minimizeCase: () => void
  expandCase: () => void
  closeCase: () => void
  updateSnap: (snap: Partial<CaseSnap>) => void
}

const ActiveCaseContext = createContext<ActiveCaseContextValue>({
  caseId: null,
  caseSnap: null,
  isWorkspaceOpen: false,
  isMinimized: false,
  openCase: () => {},
  openCaseById: () => {},
  minimizeCase: () => {},
  expandCase: () => {},
  closeCase: () => {},
  updateSnap: () => {},
})

export function ActiveCaseProvider({ children }: { children: ReactNode }) {
  const [caseId,          setCaseId]          = useState<string | null>(null)
  const [caseSnap,        setCaseSnap]        = useState<CaseSnap | null>(null)
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
  const [isMinimized,     setIsMinimized]     = useState(false)

  const openCase = useCallback((c: Case) => {
    setCaseId(c.id)
    setCaseSnap({ id: c.id, title: c.title, priority: c.priority, status: c.status, riskScore: c.riskScore })
    setIsWorkspaceOpen(true)
    setIsMinimized(false)
  }, [])

  const openCaseById = useCallback((id: string) => {
    setCaseId(id)
    setCaseSnap(null)
    setIsWorkspaceOpen(true)
    setIsMinimized(false)
  }, [])

  const minimizeCase = useCallback(() => {
    setIsWorkspaceOpen(false)
    setIsMinimized(true)
  }, [])

  const expandCase = useCallback(() => {
    setIsWorkspaceOpen(true)
    setIsMinimized(false)
  }, [])

  const closeCase = useCallback(() => {
    setIsWorkspaceOpen(false)
    setIsMinimized(false)
    setCaseId(null)
    setCaseSnap(null)
    window.dispatchEvent(new CustomEvent('case:closed'))
  }, [])

  const updateSnap = useCallback((snap: Partial<CaseSnap>) => {
    setCaseSnap(prev => prev ? { ...prev, ...snap } : prev)
  }, [])

  return (
    <ActiveCaseContext.Provider value={{
      caseId, caseSnap, isWorkspaceOpen, isMinimized,
      openCase, openCaseById, minimizeCase, expandCase, closeCase, updateSnap,
    }}>
      {children}
    </ActiveCaseContext.Provider>
  )
}

export const useActiveCase = () => useContext(ActiveCaseContext)
