/**
 * GeoFenceDialog
 *
 * Full-screen dialog for super-admin to:
 *  1. View their current GPS on an OpenStreetMap
 *  2. Drag a marker to calibrate GPS offset (systematic drift correction)
 *  3. Draw a polygon boundary by clicking on the map
 *  4. Assign which team members are subject to geo-fence enforcement
 *  5. Save with TOTP step-up confirmation
 */
import {
  Box, Typography, Dialog, IconButton, Stack, Switch, Button,
  Divider, TextField, Chip, CircularProgress, Tooltip,
} from '@mui/material'
import { colorPalette } from '@/theme'
import { useEffect, useRef, useState, useCallback } from 'react'
import { geoFenceApi, type GeoPoint, type GeoFenceConfig } from '@/api/geoFence'
import { teamApi, type TeamMember } from '@/api/team'
import CloseRoundedIcon      from '@mui/icons-material/CloseRounded'
import MyLocationIcon         from '@mui/icons-material/MyLocation'
import PolylineOutlinedIcon   from '@mui/icons-material/PolylineOutlined'
import DeleteOutlineIcon      from '@mui/icons-material/DeleteOutline'
import SaveOutlinedIcon       from '@mui/icons-material/SaveOutlined'
import PersonAddAlt1Icon      from '@mui/icons-material/PersonAddAlt1'
import PersonRemoveAlt1Icon   from '@mui/icons-material/PersonRemoveAlt1'
import TuneIcon               from '@mui/icons-material/Tune'

// ── Leaflet (lazy-imported to avoid SSR issues) ────────────────────────────
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import {
  MapContainer, TileLayer, Marker, Polygon, Polyline,
  useMapEvents, useMap,
} from 'react-leaflet'

// Fix default icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png',    import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
})

const calibratedIcon = new L.Icon({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
  className: 'calibration-marker',
})

// ── Types ───────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean
  onClose: () => void
}

// ── Map sub-components ──────────────────────────────────────────────────────

function ClickToAddVertex({
  drawing, onAdd, onMouseMove,
}: {
  drawing: boolean
  onAdd: (pt: GeoPoint) => void
  onMouseMove: (pt: GeoPoint | null) => void
}) {
  useMapEvents({
    click(e) {
      if (drawing) onAdd({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
    mousemove(e) {
      if (drawing) onMouseMove({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
    mouseout() {
      onMouseMove(null)
    },
  })
  return null
}

function FlyToLocation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 }) }, [lat, lng, map])
  return null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtCoord(n: number | null) {
  return n == null ? '—' : n.toFixed(6)
}

function fmtOffset(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${(n * 111_320).toFixed(1)} m`
}

// ── Main component ──────────────────────────────────────────────────────────

export default function GeoFenceDialog({ open, onClose }: Props) {
  // Remote config
  const [saved,   setSaved]   = useState<GeoFenceConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  // Map state
  const [enabled,       setEnabled]       = useState(false)
  const [polygon,       setPolygon]       = useState<GeoPoint[]>([])
  const [drawing,       setDrawing]       = useState(false)
  const [calLatOffset,  setCalLatOffset]  = useState(0)
  const [calLngOffset,  setCalLngOffset]  = useState(0)
  const [rawGps,        setRawGps]        = useState<GeoPoint | null>(null)
  const [flyTarget,     setFlyTarget]     = useState<GeoPoint | null>(null)
  const [locating,      setLocating]      = useState(false)

  // Calibration marker position (what the admin drags to)
  const [calMarker, setCalMarker] = useState<GeoPoint | null>(null)

  // Users
  const [members,     setMembers]     = useState<TeamMember[]>([])
  const [fencedIds,   setFencedIds]   = useState<Set<number>>(new Set())
  const [memberBusy,  setMemberBusy]  = useState<Set<number>>(new Set())

  // Mouse preview while drawing
  const [mousePos, setMousePos] = useState<GeoPoint | null>(null)

  useEffect(() => { if (!drawing) setMousePos(null) }, [drawing])

  // TOTP dialog
  const [totpOpen,  setTotpOpen]  = useState(false)
  const [totpCode,  setTotpCode]  = useState('')
  const [totpError, setTotpError] = useState<string | null>(null)

  // Search
  const [search, setSearch] = useState('')

  // ── Load config & members on open ────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      geoFenceApi.getConfig(),
      geoFenceApi.listFencedUsers(),
      teamApi.listMembers(),
    ]).then(([cfg, fenced, team]) => {
      setSaved(cfg)
      setEnabled(cfg.enabled)
      setPolygon(cfg.polygon)
      setCalLatOffset(cfg.calLatOffset)
      setCalLngOffset(cfg.calLngOffset)
      setFencedIds(new Set(fenced.users.map(u => u.userId)))
      setMembers(team.members.filter(m => !m.role.toLowerCase().includes('admin')))
    }).catch(() => {}).finally(() => setLoading(false))
    acquireGps()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── GPS acquisition ───────────────────────────────────────────────────────

  const acquireGps = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setRawGps(pt)
        setCalMarker(pt)
        setFlyTarget(pt)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [])

  // Update calibration offsets whenever admin drags the marker
  useEffect(() => {
    if (!rawGps || !calMarker) return
    setCalLatOffset(calMarker.lat - rawGps.lat)
    setCalLngOffset(calMarker.lng - rawGps.lng)
  }, [calMarker, rawGps])

  // ── Polygon drawing ───────────────────────────────────────────────────────

  const addVertex = useCallback((pt: GeoPoint) => {
    setPolygon(prev => [...prev, pt])
  }, [])

  const closePoly = useCallback(() => {
    setDrawing(false)
  }, [])

  // ── User assignment ───────────────────────────────────────────────────────

  const toggleUser = async (userId: number, currentlyFenced: boolean) => {
    setMemberBusy(s => new Set(s).add(userId))
    try {
      if (currentlyFenced) {
        await geoFenceApi.removeFencedUser(userId)
        setFencedIds(s => { const n = new Set(s); n.delete(userId); return n })
      } else {
        await geoFenceApi.addFencedUser(userId)
        setFencedIds(s => new Set(s).add(userId))
      }
    } finally {
      setMemberBusy(s => { const n = new Set(s); n.delete(userId); return n })
    }
  }

  // ── Save with TOTP ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!totpCode.trim()) { setTotpError('Enter your authenticator code'); return }
    setSaving(true); setTotpError(null)
    try {
      const result = await geoFenceApi.saveConfig({
        enabled, polygon, calLatOffset, calLngOffset, totpCode: totpCode.trim(),
      })
      setSaved(result)
      setTotpOpen(false)
      setTotpCode('')
    } catch {
      setTotpError('Code invalid or request failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()))

  const mapCenter: [number, number] = rawGps
    ? [rawGps.lat, rawGps.lng]
    : [6.4541, 3.3947] // Lagos fallback

  const isDirty = saved !== null && (
    saved.enabled !== enabled ||
    JSON.stringify(saved.polygon) !== JSON.stringify(polygon) ||
    Math.abs(saved.calLatOffset - calLatOffset) > 1e-9 ||
    Math.abs(saved.calLngOffset - calLngOffset) > 1e-9
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onClose={onClose} fullScreen
      PaperProps={{ sx: { bgcolor: '#f8fafc', borderRadius: 0 } }}>

      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 3, py: 2, bgcolor: '#ffffff', borderBottom: '1px solid #eef0f4',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            Geographical Access Fence
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Draw a boundary on the map — only fenced users outside it will be blocked
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {isDirty && (
            <Button
              variant="contained"
              startIcon={<SaveOutlinedIcon sx={{ fontSize: '0.9rem' }} />}
              onClick={() => { setSaveErr(null); setTotpOpen(true) }}
              sx={{
                bgcolor: colorPalette.primary, color: '#fff', borderRadius: 0,
                textTransform: 'none', fontFamily: 'Jost', fontWeight: 600,
                fontSize: '0.8125rem', px: 2, py: 1, boxShadow: 'none',
                '&:hover': { bgcolor: '#1e293b' },
              }}
            >
              Save Changes
            </Button>
          )}
          <IconButton onClick={onClose} size="small" sx={{ color: '#475569' }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {loading ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', height: 'calc(100vh - 65px)', overflow: 'hidden' }}>

          {/* ── Map panel ── */}
          <Box sx={{ flex: 1, position: 'relative' }}>
            <MapContainer
              center={mapCenter}
              zoom={15}
              style={{ height: '100%', width: '100%', cursor: drawing ? 'crosshair' : 'grab' }}
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />

              {/* Fly to GPS on acquire */}
              {flyTarget && <FlyToLocation lat={flyTarget.lat} lng={flyTarget.lng} />}

              {/* Click handler for polygon drawing */}
              <ClickToAddVertex drawing={drawing} onAdd={addVertex} onMouseMove={setMousePos} />

              {/* Calibration marker (draggable) */}
              {calMarker && (
                <Marker
                  position={[calMarker.lat, calMarker.lng]}
                  icon={calibratedIcon}
                  draggable={true}
                  eventHandlers={{
                    dragend(e) {
                      const ll = (e.target as L.Marker).getLatLng()
                      setCalMarker({ lat: ll.lat, lng: ll.lng })
                    },
                  }}
                />
              )}

              {/* Finished polygon */}
              {polygon.length >= 3 && (
                <Polygon
                  positions={polygon.map(p => [p.lat, p.lng] as [number, number])}
                  pathOptions={{ color: colorPalette.primary, fillOpacity: 0.15, weight: 2 }}
                />
              )}

              {/* In-progress polyline while drawing */}
              {drawing && polygon.length > 0 && (
                <Polyline
                  positions={polygon.map(p => [p.lat, p.lng] as [number, number])}
                  pathOptions={{ color: colorPalette.primary, dashArray: '6 4', weight: 2 }}
                />
              )}

              {/* Ghost preview: last vertex → mouse cursor */}
              {drawing && polygon.length > 0 && mousePos && (
                <Polyline
                  positions={[
                    [polygon[polygon.length - 1].lat, polygon[polygon.length - 1].lng],
                    [mousePos.lat, mousePos.lng],
                  ]}
                  pathOptions={{ color: colorPalette.primary, dashArray: '6 4', weight: 2, opacity: 0.65 }}
                />
              )}

              {/* Ghost closing edge: mouse cursor → first vertex (shows completed shape) */}
              {drawing && polygon.length >= 2 && mousePos && (
                <Polyline
                  positions={[
                    [mousePos.lat, mousePos.lng],
                    [polygon[0].lat, polygon[0].lng],
                  ]}
                  pathOptions={{ color: colorPalette.primary, dashArray: '4 6', weight: 1.5, opacity: 0.35 }}
                />
              )}
            </MapContainer>

            {/* Map controls overlay */}
            <Box sx={{
              position: 'absolute', top: 12, left: 12, zIndex: 1000,
              display: 'flex', flexDirection: 'column', gap: 1,
            }}>
              <Tooltip title="Locate me" placement="right">
                <Box
                  onClick={acquireGps}
                  sx={{
                    width: 34, height: 34, bgcolor: '#ffffff',
                    border: '1px solid #e2e8f0', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', borderRadius: '4px',
                    boxShadow: '0 1px 4px rgba(0,0,0,.12)',
                    '&:hover': { bgcolor: '#f1f5f9' },
                  }}
                >
                  {locating
                    ? <CircularProgress size={14} />
                    : <MyLocationIcon sx={{ fontSize: '1rem', color: colorPalette.primary }} />}
                </Box>
              </Tooltip>

              <Tooltip title={drawing ? 'Finish polygon (click here or first vertex)' : 'Draw boundary'} placement="right">
                <Box
                  onClick={() => {
                    if (drawing) { closePoly() } else { setDrawing(true) }
                  }}
                  sx={{
                    width: 34, height: 34,
                    bgcolor: drawing ? colorPalette.primary : '#ffffff',
                    border: `1px solid ${drawing ? colorPalette.primary : '#e2e8f0'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', borderRadius: '4px',
                    boxShadow: '0 1px 4px rgba(0,0,0,.12)',
                    '&:hover': { opacity: 0.88 },
                  }}
                >
                  <PolylineOutlinedIcon sx={{ fontSize: '1rem', color: drawing ? '#fff' : '#475569' }} />
                </Box>
              </Tooltip>

              {polygon.length > 0 && (
                <Tooltip title="Clear polygon" placement="right">
                  <Box
                    onClick={() => { setPolygon([]); setDrawing(false) }}
                    sx={{
                      width: 34, height: 34, bgcolor: '#ffffff',
                      border: '1px solid #e2e8f0', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', borderRadius: '4px',
                      boxShadow: '0 1px 4px rgba(0,0,0,.12)',
                      '&:hover': { bgcolor: '#fef2f2' },
                    }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: '1rem', color: '#dc2626' }} />
                  </Box>
                </Tooltip>
              )}
            </Box>

            {/* Drawing hint */}
            {drawing && (
              <Box sx={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                bgcolor: '#00288e', color: '#fff', px: 2, py: 0.75, borderRadius: '4px',
                fontSize: '0.75rem', fontFamily: 'Jost', zIndex: 1000,
                pointerEvents: 'none',
              }}>
                {polygon.length === 0
                  ? 'Click on the map to place the first vertex'
                  : `${polygon.length} vertices — click the toolbar icon to finish`}
              </Box>
            )}

            {/* Polygon vertex count */}
            {!drawing && polygon.length > 0 && (
              <Box sx={{
                position: 'absolute', bottom: 16, left: 12, zIndex: 1000,
                bgcolor: colorPalette.primary, color: '#fff',
                px: 1.25, py: 0.5, borderRadius: '3px',
                fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600,
              }}>
                {polygon.length} vertices
              </Box>
            )}
          </Box>

          {/* ── Right panel ── */}
          <Box sx={{
            width: 340, bgcolor: '#ffffff', borderLeft: '1px solid #eef0f4',
            overflowY: 'auto', flexShrink: 0,
          }}>

            {/* Enable toggle */}
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                  Enable Geo-Fence
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.25 }}>
                  {enabled ? 'Fenced users outside the boundary will be blocked' : 'Fence is off — all users can log in freely'}
                </Typography>
              </Box>
              <Switch
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                size="small"
                sx={{
                  '& .MuiSwitch-track': { borderRadius: 8 },
                  '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                }}
              />
            </Box>

            {/* GPS / Calibration */}
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <TuneIcon sx={{ fontSize: '0.9rem', color: colorPalette.primary }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  GPS Calibration
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mb: 1.5, lineHeight: 1.6 }}>
                Drag the blue marker on the map to your actual position. This corrects systematic GPS drift for all fenced users.
              </Typography>
              <Stack spacing={0.75}>
                <Row label="Raw GPS" value={rawGps ? `${fmtCoord(rawGps.lat)}, ${fmtCoord(rawGps.lng)}` : 'Not acquired'} />
                <Row label="Calibrated" value={calMarker ? `${fmtCoord(calMarker.lat)}, ${fmtCoord(calMarker.lng)}` : '—'} />
                <Row
                  label="Offset"
                  value={calLatOffset === 0 && calLngOffset === 0
                    ? 'None'
                    : `Δlat ${fmtOffset(calLatOffset)}, Δlng ${fmtOffset(calLngOffset)}`}
                  highlight={calLatOffset !== 0 || calLngOffset !== 0}
                />
              </Stack>
              <Button
                size="small"
                startIcon={<MyLocationIcon sx={{ fontSize: '0.8rem' }} />}
                onClick={acquireGps}
                disabled={locating}
                sx={{
                  mt: 1.5, color: colorPalette.primary, fontFamily: 'Jost',
                  fontSize: '0.75rem', textTransform: 'none', p: 0,
                  '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                }}
              >
                {locating ? 'Locating…' : 'Re-acquire GPS'}
              </Button>
            </Box>

            {/* Polygon summary */}
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <PolylineOutlinedIcon sx={{ fontSize: '0.9rem', color: colorPalette.primary }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Boundary
                </Typography>
              </Stack>
              {polygon.length === 0 ? (
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  No boundary drawn. Use the polygon tool on the map.
                </Typography>
              ) : polygon.length < 3 ? (
                <Typography sx={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                  {polygon.length} vertex — need at least 3 to close a polygon.
                </Typography>
              ) : (
                <Chip
                  label={`${polygon.length}-vertex polygon`}
                  size="small"
                  sx={{ bgcolor: '#eff6ff', color: colorPalette.primary, fontWeight: 600, borderRadius: '4px', fontSize: '0.6875rem' }}
                />
              )}
            </Box>

            {/* User assignment */}
            <Box sx={{ px: 3, pt: 2.25, pb: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <PersonAddAlt1Icon sx={{ fontSize: '0.9rem', color: colorPalette.primary }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Fenced Users
                </Typography>
                <Chip
                  label={fencedIds.size}
                  size="small"
                  sx={{ ml: 'auto !important', bgcolor: fencedIds.size > 0 ? colorPalette.primary : '#f1f5f9', color: fencedIds.size > 0 ? '#fff' : '#64748b', fontWeight: 700, borderRadius: '4px', fontSize: '0.6875rem', height: 18 }}
                />
              </Stack>
              <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mb: 1.5, lineHeight: 1.6 }}>
                Admin users are always exempt. Toggle to enforce the fence on specific members.
              </Typography>
              <TextField
                size="small"
                placeholder="Search members…"
                fullWidth
                value={search}
                onChange={e => setSearch(e.target.value)}
                sx={{
                  mb: 1.5,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#f8fafc', borderRadius: '4px', fontSize: '0.8125rem',
                    '& fieldset': { border: '1px solid #e2e8f0' },
                  },
                }}
              />
            </Box>
            <Stack divider={<Divider />} sx={{ pb: 2 }}>
              {filteredMembers.map(m => {
                const fenced = fencedIds.has(m.id)
                const busy   = memberBusy.has(m.id)
                return (
                  <Box key={m.id} sx={{
                    px: 3, py: 1.25,
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    bgcolor: fenced ? `${colorPalette.primary}08` : 'transparent',
                  }}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      bgcolor: fenced ? colorPalette.primary : '#e2e8f0',
                      color: fenced ? '#fff' : '#64748b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.6875rem', fontWeight: 700,
                    }}>
                      {m.initials}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.role} · {m.email}
                      </Typography>
                    </Box>
                    <Tooltip title={fenced ? 'Remove from fence' : 'Add to fence'} placement="left">
                      <Box
                        onClick={() => !busy && toggleUser(m.id, fenced)}
                        sx={{
                          width: 28, height: 28, borderRadius: '4px', flexShrink: 0,
                          bgcolor: fenced ? '#fef2f2' : '#f0fdf4',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: busy ? 'default' : 'pointer',
                          '&:hover': { opacity: 0.8 },
                        }}
                      >
                        {busy
                          ? <CircularProgress size={12} />
                          : fenced
                            ? <PersonRemoveAlt1Icon sx={{ fontSize: '0.9rem', color: '#dc2626' }} />
                            : <PersonAddAlt1Icon    sx={{ fontSize: '0.9rem', color: '#10b981' }} />}
                      </Box>
                    </Tooltip>
                  </Box>
                )
              })}
              {filteredMembers.length === 0 && (
                <Box sx={{ px: 3, py: 3, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>No members found</Typography>
                </Box>
              )}
            </Stack>
          </Box>
        </Box>
      )}

      {/* ── TOTP confirmation dialog ── */}
      <Dialog open={totpOpen} onClose={() => setTotpOpen(false)}
        PaperProps={{ sx: { bgcolor: '#ffffff', borderRadius: 0, width: 380, p: 0 } }}>
        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            Confirm with Authenticator
          </Typography>
          <IconButton size="small" onClick={() => setTotpOpen(false)} sx={{ color: '#64748b' }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ px: 3, py: 2.5 }}>
          <Typography sx={{ fontSize: '0.8125rem', color: '#475569', mb: 2.5, lineHeight: 1.6 }}>
            Saving the geo-fence boundary requires step-up authentication. Enter the 6-digit code from your authenticator app.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            placeholder="000000"
            value={totpCode}
            onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ inputMode: 'numeric', style: { letterSpacing: '0.4em', textAlign: 'center', fontSize: '1.25rem', fontFamily: 'monospace' } }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            error={!!totpError}
            helperText={totpError ?? ''}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '4px', bgcolor: '#f8fafc',
                '& fieldset': { border: '1px solid #e2e8f0' },
                '&.Mui-focused fieldset': { borderColor: colorPalette.primary },
              },
            }}
          />
          {saveErr && (
            <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', mb: 1.5 }}>{saveErr}</Typography>
          )}
          <Button
            fullWidth
            onClick={handleSave}
            disabled={saving || totpCode.length < 6}
            sx={{
              bgcolor: colorPalette.primary, color: '#fff', borderRadius: 0,
              textTransform: 'none', fontFamily: 'Jost', fontWeight: 600,
              fontSize: '0.875rem', py: 1.25, boxShadow: 'none',
              '&:hover': { bgcolor: '#1e293b' },
              '&.Mui-disabled': { bgcolor: '#c7d2fe', color: '#fff' },
            }}
          >
            {saving ? 'Saving…' : 'Confirm & Save'}
          </Button>
        </Box>
      </Dialog>
    </Dialog>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
      <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'Jost' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: highlight ? colorPalette.primary : '#00288e', fontFamily: 'monospace', textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  )
}
