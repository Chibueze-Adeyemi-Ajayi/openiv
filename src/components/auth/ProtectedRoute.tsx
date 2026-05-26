import { Navigate, useLocation } from 'react-router-dom'
import { getSessionState, hydrate, clearOnboardingState, type SessionState } from '@/onboarding/state'
import { useEffect, useState } from 'react'
import { getBaseUrl } from '@/api/client'
import { Box, CircularProgress } from '@mui/material'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredState?: SessionState
}

type Status = 'pending' | 'allowed' | 'denied'

export default function ProtectedRoute({ children, requiredState = 'authenticated' }: ProtectedRouteProps) {
  const [status, setStatus]     = useState<Status>('pending')
  const [denyTarget, setDenyTarget] = useState('/auth/login')
  const location = useLocation()

  useEffect(() => {
    const check = async () => {
      await hydrate()
      const state = getSessionState()

      if (!state) {
        setDenyTarget('/auth/login')
        setStatus('denied')
        return
      }

      if (state !== requiredState) {
        switch (state) {
          case 'pending_email_verification': setDenyTarget('/auth/verify-email'); break
          case 'pending_totp_setup':         setDenyTarget('/auth/setup-2fa');    break
          case 'pending_totp_challenge':     setDenyTarget('/auth/verify-otp');   break
          case 'authenticated':              setDenyTarget('/dashboard');         break
          default:                           setDenyTarget('/auth/login');
        }
        setStatus('denied')
        return
      }

      // For authenticated routes, verify the server session is still alive before
      // rendering the dashboard — prevents a flash of protected content when the
      // local state is stale after a server-side session expiry.
      if (requiredState === 'authenticated') {
        try {
          const res = await fetch(`${getBaseUrl()}/api/v1/auth/session`, { credentials: 'include' })
          if (!res.ok) {
            clearOnboardingState()
            setDenyTarget('/auth/login?expired=1')
            setStatus('denied')
            return
          }
        } catch {
          // Network error — let through; API calls will handle it
        }
      }

      setStatus('allowed')
    }
    check()
  }, [requiredState])

  if (status === 'pending') {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (status === 'denied') {
    return <Navigate to={denyTarget} state={{ from: location }} replace />
  }

  return <>{children}</>
}
