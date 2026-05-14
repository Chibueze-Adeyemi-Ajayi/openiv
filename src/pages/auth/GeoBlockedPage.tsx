/**
 * GeoBlockedPage
 *
 * Shown when a user's TOTP verification succeeds but their location is outside
 * the institution's geo-fence polygon. They can request admin approval in real-time.
 *
 * Flow:
 *   1. VerifyTOTPPage receives state=geo_blocked + requestId + watchToken + expiresAt
 *   2. These are persisted in sessionStorage and user is navigated here
 *   3. This page opens an SSE watch stream to /api/v1/geo-access/requests/:id/watch
 *   4. Admin reviews and approves/rejects via their dashboard
 *   5. On approval:  SSE fires → authApi.session() → AUTHENTICATED → navigate /dashboard
 *   6. On rejection: SSE fires → show rejection message → navigate /auth/login
 */
import { Box, Typography, CircularProgress, Button, Stack } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { colorPalette } from '@/theme'
import GpsNotFixedIcon     from '@mui/icons-material/GpsNotFixed'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelOutlinedIcon  from '@mui/icons-material/CancelOutlined'
import AccessTimeIcon      from '@mui/icons-material/AccessTime'

const SESSION_KEY_REQ   = 'geo_block_request_id'
const SESSION_KEY_TOKEN = 'geo_block_watch_token'
const SESSION_KEY_EXP   = 'geo_block_expires_at'

type WatchState = 'waiting' | 'approved' | 'rejected' | 'expired' | 'error'

export function storeGeoBlock(requestId: number, watchToken: string, expiresAt: string) {
  sessionStorage.setItem(SESSION_KEY_REQ,   String(requestId))
  sessionStorage.setItem(SESSION_KEY_TOKEN, watchToken)
  sessionStorage.setItem(SESSION_KEY_EXP,   expiresAt)
}

function clearGeoBlock() {
  sessionStorage.removeItem(SESSION_KEY_REQ)
  sessionStorage.removeItem(SESSION_KEY_TOKEN)
  sessionStorage.removeItem(SESSION_KEY_EXP)
}

function useTtl(expiresAt: string | null): number {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const rem = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setSecs(rem)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return secs
}

export default function GeoBlockedPage() {
  const navigate = useNavigate()
  const esRef    = useRef<EventSource | null>(null)

  const requestId  = sessionStorage.getItem(SESSION_KEY_REQ)
  const watchToken = sessionStorage.getItem(SESSION_KEY_TOKEN)
  const expiresAt  = sessionStorage.getItem(SESSION_KEY_EXP)

  const [watchState, setWatchState] = useState<WatchState>('waiting')
  const ttl = useTtl(expiresAt)

  useEffect(() => {
    if (!requestId || !watchToken) {
      navigate('/auth/login', { replace: true })
      return
    }

    const url = `/api/v1/geo-access/requests/${requestId}/watch?watchToken=${encodeURIComponent(watchToken)}`
    const es  = new EventSource(url)
    esRef.current = es

    es.onmessage = async (e) => {
      try {
        const data = JSON.parse(e.data) as { status: 'approved' | 'rejected' }
        if (data.status === 'approved') {
          setWatchState('approved')
          clearGeoBlock()
          // Session is now AUTHENTICATED — verify then navigate
          setTimeout(async () => {
            try {
              const info = await authApi.session()
              if (info.state === 'authenticated') navigate('/dashboard', { replace: true })
            } catch {
              navigate('/auth/login', { replace: true })
            }
          }, 1200)
        } else {
          setWatchState('rejected')
          clearGeoBlock()
          setTimeout(() => navigate('/auth/login', { replace: true }), 3500)
        }
      } catch { /* ignore */ }
      es.close()
    }

    es.onerror = () => {
      es.close()
      if (watchState === 'waiting') setWatchState('error')
    }

    return () => { es.close(); esRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Expire when TTL hits 0
  useEffect(() => {
    if (ttl === 0 && expiresAt && watchState === 'waiting') {
      setWatchState('expired')
      esRef.current?.close()
      clearGeoBlock()
    }
  }, [ttl, expiresAt, watchState])

  const fmtTtl = (s: number) => {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${String(r).padStart(2, '0')}`
  }

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: '#f8fafc', p: 3,
    }}>
      <Box sx={{
        bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 4, maxWidth: 440, width: '100%',
        textAlign: 'center',
      }}>

        {watchState === 'waiting' && (
          <>
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%', bgcolor: '#fff7ed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mx: 'auto', mb: 2.5,
            }}>
              <GpsNotFixedIcon sx={{ fontSize: '2rem', color: '#f59e0b' }} />
            </Box>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 1 }}>
              Unauthorized Location
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#475569', mb: 3, lineHeight: 1.6 }}>
              Your current location is outside your institution's authorized access zone. Your administrator has been notified and can grant temporary access.
            </Typography>

            <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', p: 2, mb: 3 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
                <CircularProgress size={16} thickness={4} sx={{ color: colorPalette.primary }} />
                <Typography sx={{ fontSize: '0.8125rem', color: '#475569', fontFamily: 'Jost' }}>
                  Waiting for admin approval…
                </Typography>
              </Stack>
              {expiresAt && ttl > 0 && (
                <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" sx={{ mt: 1 }}>
                  <AccessTimeIcon sx={{ fontSize: '0.75rem', color: '#94a3b8' }} />
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                    Request expires in {fmtTtl(ttl)}
                  </Typography>
                </Stack>
              )}
            </Box>

            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.6 }}>
              Your admin will see an in-app notification with your location and device details. If approved, you will be automatically signed in.
            </Typography>
          </>
        )}

        {watchState === 'approved' && (
          <>
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%', bgcolor: '#f0fdf4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mx: 'auto', mb: 2.5,
            }}>
              <CheckCircleOutlineIcon sx={{ fontSize: '2rem', color: '#10b981' }} />
            </Box>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 1 }}>
              Access Granted
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6 }}>
              Your administrator approved your access request. Signing you in now…
            </Typography>
            <CircularProgress size={20} sx={{ mt: 2.5, color: '#10b981' }} />
          </>
        )}

        {watchState === 'rejected' && (
          <>
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%', bgcolor: '#fef2f2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mx: 'auto', mb: 2.5,
            }}>
              <CancelOutlinedIcon sx={{ fontSize: '2rem', color: '#dc2626' }} />
            </Box>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 1 }}>
              Access Denied
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#475569', mb: 3, lineHeight: 1.6 }}>
              Your administrator declined this access request. Please contact your organization administrator if you believe this is incorrect.
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>Returning to sign-in…</Typography>
          </>
        )}

        {(watchState === 'expired' || watchState === 'error') && (
          <>
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%', bgcolor: '#f8fafc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mx: 'auto', mb: 2.5,
            }}>
              <AccessTimeIcon sx={{ fontSize: '2rem', color: '#64748b' }} />
            </Box>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 1 }}>
              {watchState === 'expired' ? 'Request Expired' : 'Connection Lost'}
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#475569', mb: 3, lineHeight: 1.6 }}>
              {watchState === 'expired'
                ? 'This access request has expired. Please sign in again to generate a new request.'
                : 'The connection to the approval service was lost. Please try again.'}
            </Typography>
            <Button
              fullWidth
              onClick={() => navigate('/auth/login', { replace: true })}
              sx={{
                bgcolor: colorPalette.primary, color: '#fff', borderRadius: 0,
                textTransform: 'none', fontFamily: 'Jost', fontWeight: 600,
                fontSize: '0.875rem', py: 1.25, boxShadow: 'none',
                '&:hover': { bgcolor: '#1e293b' },
              }}
            >
              Back to Sign In
            </Button>
          </>
        )}
      </Box>
    </Box>
  )
}
