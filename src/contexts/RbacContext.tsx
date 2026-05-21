import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useProfile } from '@/contexts/ProfileContext'
import { hasPermission, type Permission } from '@/rbac/permissions'

interface RbacContextValue {
  can: (permission: Permission) => boolean
  role: string | null
}

const RbacContext = createContext<RbacContextValue>({
  can: () => false,
  role: null,
})

export function RbacProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile()
  const role = profile?.role ?? null

  const can = (permission: Permission) => hasPermission(role, permission)

  return <RbacContext.Provider value={{ can, role }}>{children}</RbacContext.Provider>
}

export const useRbac = () => useContext(RbacContext)
