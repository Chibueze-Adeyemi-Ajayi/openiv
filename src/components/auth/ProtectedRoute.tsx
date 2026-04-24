import { Navigate, useLocation } from 'react-router-dom'
import { getSessionState, type SessionState } from '@/onboarding/state'
import { useEffect, useState } from 'react'
import { hydrate } from '@/onboarding/state'

import { Box, CircularProgress } from '@mui/material'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredState?: SessionState
}

export default function ProtectedRoute({ children, requiredState = 'authenticated' }: ProtectedRouteProps) {
  const [hydrated, setHydrated] = useState(false)
  const location = useLocation()

  useEffect(() => {
    hydrate().then(() => setHydrated(true))
  }, [])

  if (!hydrated) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  const state = getSessionState()

  if (!state) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  if (state !== requiredState) {
    // Redirect to the correct step based on current state
    switch (state) {
      case 'pending_email_verification':
        return <Navigate to="/auth/verify-email" replace />
      case 'pending_totp_setup':
        return <Navigate to="/auth/setup-2fa" replace />
      case 'pending_totp_challenge':
        return <Navigate to="/auth/verify-otp" replace />
      case 'authenticated':
        // If we're authenticated but the page wanted something else (like setup), go to dashboard
        return <Navigate to="/dashboard" replace />
      default:
        return <Navigate to="/auth/login" replace />
    }
  }

  return <>{children}</>
}
