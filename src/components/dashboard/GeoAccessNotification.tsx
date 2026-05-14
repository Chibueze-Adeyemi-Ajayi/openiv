import { useState } from 'react'
import { Box, Typography, Stack, IconButton, CircularProgress, TextField } from '@mui/material'
import CloseRoundedIcon    from '@mui/icons-material/CloseRounded'
import GpsNotFixedIcon     from '@mui/icons-material/GpsNotFixed'
import CheckOutlinedIcon   from '@mui/icons-material/CheckOutlined'
import BlockOutlinedIcon   from '@mui/icons-material/BlockOutlined'
import { colorPalette } from '@/theme'
import { geoFenceApi } from '@/api/geoFence'
import type { GeoAccessRequestItem } from '@/contexts/DashboardEventsContext'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl:       new URL('leaflet/dist/images/marker-icon.png',    import.meta.url).href,
  shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png',  import.meta.url).href,
})

function fmtTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(iso))
  } catch { return iso }
}

function parseUA(ua: string | null): string {
  if (!ua) return 'Unknown'
  let browser = 'Browser'
  if (/Chrome/.test(ua) && /Edg/.test(ua))             browser = 'Edge'
  else if (/Chrome/.test(ua) && !/OPR/.test(ua))       browser = 'Chrome'
  else if (/Firefox/.test(ua))                          browser = 'Firefox'
  else if (/Safari/.test(ua) && !/Chrome/.test(ua))    browser = 'Safari'
  let os = ''
  if (/Windows NT/.test(ua))          os = 'Windows'
  else if (/Mac OS X/.test(ua))       os = 'macOS'
  else if (/Android/.test(ua))        os = 'Android'
  else if (/iPhone|iPad/.test(ua))    os = 'iOS'
  else if (/Linux/.test(ua))          os = 'Linux'
  return [browser, os].filter(Boolean).join(' · ')
}

interface Props {
  request:   GeoAccessRequestItem
  onDismiss: () => void
}

type Phase = 'view' | 'confirm' | 'done'

export default function GeoAccessNotification({ request, onDismiss }: Props) {
  const [phase,    setPhase]    = useState<Phase>('view')
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  const [pending,  setPending]  = useState<'approved' | 'rejected' | null>(null)
  const [totp,     setTotp]     = useState('')
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState<string | null>(null)

  const hasLocation = request.rawLat != null && request.rawLng != null

  const beginDecision = (d: 'approved' | 'rejected') => {
    setPending(d)
    setTotp('')
    setErr(null)
    setPhase('confirm')
  }

  const submit = async () => {
    if (!pending) return
    if (!totp.trim()) { setErr('Enter your authenticator code.'); return }
    setBusy(true)
    setErr(null)
    try {
      await geoFenceApi.reviewRequest(request.id, pending, totp.trim())
      setDecision(pending)
      setPhase('done')
      setTimeout(onDismiss, 2500)
    } catch {
      setErr('Incorrect code or request already expired.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{
      position: 'fixed', bottom: 24, left: 24, width: 380,
      bgcolor: '#ffffff', border: '1px solid #eef0f4',
      boxShadow: '0 16px 48px rgba(15,23,42,0.16)',
      zIndex: 1500,
      animation: 'geoNotifIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      '@keyframes geoNotifIn': {
        from: { opacity: 0, transform: 'translateY(24px) scale(0.97)' },
        to:   { opacity: 1, transform: 'translateY(0) scale(1)' },
      },
    }}>

      {/* Header */}
      <Box sx={{ px: 2, pt: 2, pb: 1.25, display: 'flex', alignItems: 'flex-start', gap: 1.25,
        borderBottom: '1px solid #eef0f4' }}>
        <Box sx={{ width: 32, height: 32, bgcolor: '#fff7ed', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.125 }}>
          <GpsNotFixedIcon sx={{ fontSize: '1rem', color: '#f59e0b' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            Geo-access request
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25 }}>
            User attempting login from outside the geo-fence
          </Typography>
        </Box>
        <IconButton disableRipple size="small" onClick={onDismiss}
          sx={{ color: '#94a3b8', borderRadius: 0, p: 0.25, '&:hover': { color: '#475569' } }}>
          <CloseRoundedIcon sx={{ fontSize: '0.9375rem' }} />
        </IconButton>
      </Box>

      {phase === 'done' ? (
        <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: '50%',
            bgcolor: decision === 'approved' ? '#f0fdf4' : '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5,
          }}>
            {decision === 'approved'
              ? <CheckOutlinedIcon sx={{ fontSize: '1.25rem', color: '#10b981' }} />
              : <BlockOutlinedIcon sx={{ fontSize: '1.25rem', color: '#dc2626' }} />}
          </Box>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            {decision === 'approved' ? 'Access Granted' : 'Access Denied'}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>
            {decision === 'approved'
              ? 'The user will be signed in automatically.'
              : 'The user has been returned to the sign-in page.'}
          </Typography>
        </Box>
      ) : (
        <>
          {/* Mini map */}
          {hasLocation && (
            <Box sx={{ height: 156, overflow: 'hidden', borderBottom: '1px solid #eef0f4' }}>
              <MapContainer
                center={[request.rawLat!, request.rawLng!]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                attributionControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[request.rawLat!, request.rawLng!]} />
              </MapContainer>
            </Box>
          )}

          {/* Details */}
          <Box sx={{ px: 2, py: 1.75 }}>
            <Stack gap={0.875}>
              <Detail
                label="User"
                value={request.userFullName
                  ? `${request.userFullName} (${request.userEmail})`
                  : request.userEmail}
              />
              {hasLocation && (
                <Detail label="Location"
                  value={`${request.rawLat!.toFixed(5)}, ${request.rawLng!.toFixed(5)}`} mono />
              )}
              {request.ip       && <Detail label="IP"      value={request.ip}                           mono />}
              {request.userAgent && <Detail label="Browser" value={parseUA(request.userAgent)}                />}
              {request.deviceId  && <Detail label="Device"  value={request.deviceId.slice(0, 18) + '…'} mono />}
              <Detail label="Time" value={fmtTime(request.createdAt)} mono />
            </Stack>
          </Box>

          {/* Approve / Deny buttons */}
          {phase === 'view' && (
            <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1 }}>
              <Box
                onClick={() => beginDecision('approved')}
                sx={{
                  flex: 1, py: 0.875, bgcolor: '#f0fdf4', border: '1px solid #86efac',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
                  cursor: 'pointer', transition: 'all 0.15s',
                  '&:hover': { bgcolor: '#dcfce7', borderColor: '#10b981' },
                }}
              >
                <CheckOutlinedIcon sx={{ fontSize: '0.875rem', color: '#10b981' }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', fontFamily: 'Jost' }}>
                  Approve
                </Typography>
              </Box>
              <Box
                onClick={() => beginDecision('rejected')}
                sx={{
                  flex: 1, py: 0.875, bgcolor: '#fef2f2', border: '1px solid #fca5a5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
                  cursor: 'pointer', transition: 'all 0.15s',
                  '&:hover': { bgcolor: '#fee2e2', borderColor: '#dc2626' },
                }}
              >
                <BlockOutlinedIcon sx={{ fontSize: '0.875rem', color: '#dc2626' }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', fontFamily: 'Jost' }}>
                  Deny
                </Typography>
              </Box>
            </Box>
          )}

          {/* TOTP confirmation */}
          {phase === 'confirm' && (
            <Box sx={{ px: 2, pb: 2 }}>
              <Typography sx={{
                fontSize: '0.6875rem', fontWeight: 700, color: '#475569',
                textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1,
              }}>
                {pending === 'approved' ? 'Confirm approval with TOTP' : 'Confirm denial with TOTP'}
              </Typography>
              <TextField
                fullWidth
                placeholder="000000"
                value={totp}
                onChange={e => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                size="small"
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
                sx={{
                  mb: err ? 0.75 : 1,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 0,
                    bgcolor: '#f8fafc',
                    '& fieldset': { borderColor: '#e2e8f0' },
                    '&:hover fieldset': { borderColor: '#94a3b8' },
                    '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
                  },
                  '& input': {
                    textAlign: 'center', py: '10px',
                    fontFamily: 'SF Mono, Monaco, monospace',
                    fontSize: '1.25rem', letterSpacing: '0.25em', color: '#00288e',
                  },
                }}
              />
              {err && (
                <Typography sx={{ fontSize: '0.6875rem', color: '#dc2626', mb: 1 }}>{err}</Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box
                  onClick={() => { setPhase('view'); setErr(null) }}
                  sx={{
                    px: 1.5, py: 0.875, border: '1px solid #e2e8f0', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                    '&:hover': { borderColor: '#94a3b8' },
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', fontFamily: 'Jost' }}>
                    Back
                  </Typography>
                </Box>
                <Box
                  onClick={() => !busy && submit()}
                  sx={{
                    flex: 1, py: 0.875,
                    bgcolor: pending === 'approved' ? '#10b981' : '#dc2626',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.7 : 1, transition: 'opacity 0.15s',
                    '&:hover': { bgcolor: pending === 'approved' ? '#059669' : '#b91c1c' },
                  }}
                >
                  {busy
                    ? <CircularProgress size={12} sx={{ color: '#ffffff' }} />
                    : pending === 'approved'
                      ? <CheckOutlinedIcon sx={{ fontSize: '0.875rem', color: '#ffffff' }} />
                      : <BlockOutlinedIcon sx={{ fontSize: '0.875rem', color: '#ffffff' }} />}
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Jost' }}>
                    {pending === 'approved' ? 'Grant Access' : 'Deny Access'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
      <Typography sx={{
        fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 64, flexShrink: 0,
      }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: '0.75rem', color: '#00288e', wordBreak: 'break-all',
        fontFamily: mono ? 'SF Mono, Monaco, monospace' : 'Jost',
        fontWeight: mono ? 500 : 400,
      }}>
        {value}
      </Typography>
    </Box>
  )
}
