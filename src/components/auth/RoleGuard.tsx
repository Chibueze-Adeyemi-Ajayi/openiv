import { Navigate } from 'react-router-dom'
import { useRbac } from '@/contexts/RbacContext'
import { useProfile } from '@/contexts/ProfileContext'
import { Box, CircularProgress } from '@mui/material'
import type { Permission } from '@/rbac/permissions'

interface RoleGuardProps {
  permission: Permission
  children: React.ReactNode
  fallback?: string
}

export default function RoleGuard({ permission, children, fallback = '/dashboard' }: RoleGuardProps) {
  const { profile } = useProfile()
  const { can } = useRbac()

  if (profile === null) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!can(permission)) {
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}
