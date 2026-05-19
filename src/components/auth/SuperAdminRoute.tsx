import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { hydrate, getSessionState } from '@/onboarding/state'
import { authApi } from '@/api/auth'
import { Box, CircularProgress } from '@mui/material'

const SUPER_ADMIN_EMAIL = 'chibuezeadeyemi@gmail.com'

export default function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    hydrate().then(async () => {
      if (getSessionState() !== 'authenticated') {
        setStatus('denied')
        return
      }
      try {
        const session = await authApi.session()
        setStatus(session.email === SUPER_ADMIN_EMAIL ? 'allowed' : 'denied')
      } catch {
        setStatus('denied')
      }
    })
  }, [])

  if (status === 'loading') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: '#00288e' }} />
      </Box>
    )
  }

  if (status === 'denied') {
    return <Navigate to="/auth/login" replace />
  }

  return <>{children}</>
}
