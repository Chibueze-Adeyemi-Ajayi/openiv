import { Navigate } from 'react-router-dom'
import { getSessionState, hydrate } from '@/onboarding/state'
import { useEffect, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'

interface PublicRouteProps {
  children: React.ReactNode
}

export default function PublicRoute({ children }: PublicRouteProps) {
  const [hydrated, setHydrated] = useState(false)

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

  return <>{children}</>
}
