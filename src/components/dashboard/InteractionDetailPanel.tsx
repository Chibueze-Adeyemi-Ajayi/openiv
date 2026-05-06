import { Box, Typography, IconButton, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { colorPalette } from '@/theme'
import { type BeamRecord } from '@/api/beam'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'

interface Props {
  beam: BeamRecord | null
  open: boolean
  onClose: () => void
}

function riskColor(score: number) {
  return score >= 70 ? '#dc2626' : score >= 40 ? '#f59e0b' : '#10b981'
}

function riskLabel(score: number) {
  return score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW'
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(iso))
  } catch { return iso }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.25 }}>
      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ border: '1px solid #eef0f4', p: 1.5, borderRadius: 0 }}>{children}</Box>
    </Box>
  )
}

function Field({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '108px 1fr', gap: 1, mb: 0.875, '&:last-child': { mb: 0 }, alignItems: 'start' }}>
      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, pt: 0.125, lineHeight: 1.4 }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: '0.8125rem', color: value ? '#0f172a' : '#cbd5e1',
        fontFamily: mono ? 'SF Mono, Monaco, monospace' : 'Jost, sans-serif',
        fontWeight: mono ? 500 : 400, lineHeight: 1.4, wordBreak: 'break-all',
      }}>
        {value || '—'}
      </Typography>
    </Box>
  )
}

function determineStatus(record: BeamRecord) {
  let score: number | null = null
  try {
    const payload = JSON.parse(record.payload)
    score = payload.risk_score ?? payload.riskScore ?? payload.score ?? payload.fraud_score ?? null
  } catch {}

  if (score === null) {
    return { label: 'UNSCORED', bg: '#f8fafc', color: '#94a3b8', score: 0 }
  }
  if (score >= 70) {
    return { label: 'FRAUDULENT', bg: '#fef2f2', color: '#dc2626', score }
  }
  if (score >= 40) {
    return { label: 'SUSPICIOUS', bg: '#fffbeb', color: '#f59e0b', score }
  }
  return { label: 'NORMAL', bg: '#f0fdf4', color: '#10b981', score }
}

export default function InteractionDetailPanel({ beam, open, onClose }: Props) {
  const navigate = useNavigate()
  if (!open || !beam) return null

  let parsed: any = {}
  try { parsed = JSON.parse(beam.payload) } catch {}
  
  const statusCfg = determineStatus(beam)
  const rc = riskColor(statusCfg.score)
  const risk = statusCfg.score

  return (
    <>
      <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.3)', zIndex: 1200 }} />
      <Box sx={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 440, bgcolor: '#ffffff', zIndex: 1201,
        boxShadow: '-8px 0 40px rgba(15,23,42,0.14)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInPanel 0.24s cubic-bezier(0.4,0,0.2,1)',
        '@keyframes slideInPanel': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
      }}>
        {/* Sticky header */}
        <Box sx={{ flexShrink: 0, borderBottom: '1px solid #eef0f4' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pt: 2.5, pb: 1.25 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.25 }}>
                Interaction Beam
              </Typography>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '-0.01em' }}>
                {beam.id}
              </Typography>
            </Box>
            <Box sx={{ px: 1, py: 0.375, bgcolor: statusCfg.bg, flexShrink: 0, borderRadius: 0 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: statusCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {statusCfg.label}
              </Typography>
            </Box>
            <Button
              size="small"
              startIcon={<AccountCircleOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              onClick={() => {
                const userId = parsed.user_id || parsed.customer_id
                if (userId) navigate(`/dashboard/users/${encodeURIComponent(userId)}`)
              }}
              sx={{
                ml: 1,
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: colorPalette.primary,
                textTransform: 'none',
                fontFamily: 'Jost',
                '&:hover': { bgcolor: `${colorPalette.primary}0a` }
              }}
            >
              View Profile
            </Button>
            <IconButton disableRipple size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#475569' } }}>
              <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
            </IconButton>
          </Box>
        </Box>

        {/* Scrollable body */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
          {/* Risk score */}
          <Box sx={{ mb: 2.5, p: 1.5, border: '1px solid #eef0f4', bgcolor: `${rc}04` }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
              <Typography sx={{ fontSize: '2.25rem', fontWeight: 800, color: rc, fontFamily: 'Jost', lineHeight: 1 }}>
                {risk}
              </Typography>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: rc, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                {riskLabel(risk)} RISK
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', ml: 'auto' }}>/100</Typography>
            </Box>
            <Box sx={{ height: 6, bgcolor: '#f1f5f9', position: 'relative' }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${risk}%`, bgcolor: rc, transition: 'width 0.6s ease' }} />
            </Box>
          </Box>

          <Section title="Overview">
            <Field label="Action" value={String(parsed.activity_name || parsed.action || parsed.event || 'Interaction')} />
            <Field label="Note" value={parsed.note} />
            <Field label="User ID" value={parsed.user_id || parsed.customer_id} mono />
            <Field label="User Name" value={parsed.user_name} />
            <Field label="Stream" value={beam.stream} />
            <Field label="Status" value={beam.status} />
            <Field label="Date & Time" value={fmtDate(beam.occurredAt || parsed.occurred_at || parsed.occurredAt || beam.receivedAt)} />
          </Section>

          <Section title="Client & Network">
            <Field label="IP Address" value={parsed.ip_address || beam.ip || 'Unknown'} mono />
            <Field label="Location" value={parsed.location || 'Unknown'} />
            <Field label="Device / OS" value={parsed.device_name || parsed.os || 'Unknown'} />
            <Field label="User Agent" value={beam.userAgent} />
          </Section>

          {Object.keys(parsed).filter(k => !['activity_name', 'note', 'user_name', 'action', 'event', 'user_id', 'customer_id', 'ip_address', 'location', 'device_name', 'os'].includes(k)).length > 0 && (
            <Section title="Additional Payload Data">
              {Object.entries(parsed).filter(([k]) => !['activity_name', 'note', 'user_name', 'action', 'event', 'user_id', 'customer_id', 'ip_address', 'location', 'device_name', 'os'].includes(k)).map(([k, v]) => (
                <Field key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
              ))}
            </Section>
          )}

          <Section title="Monitoring Fields">
            <Field label="Duration" value={beam.durationMs ? `${beam.durationMs} ms` : null} />
            <Field label="Response Code" value={beam.responseCode ? String(beam.responseCode) : null} />
            <Field label="Bytes" value={beam.bytes ? String(beam.bytes) : null} />
          </Section>
        </Box>
      </Box>
    </>
  )
}
