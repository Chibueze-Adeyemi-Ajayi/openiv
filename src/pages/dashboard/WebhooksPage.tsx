import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Stack, Button, TextField, Switch,
  IconButton, Popover, Skeleton, Collapse,
} from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import {
  webhookApi,
  type WebhookEndpoint,
  type WebhookSecret,
  type WebhookDelivery,
} from '@/api/webhooks'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#f5f3fb',
    borderRadius: 0,
    transition: 'all 0.2s ease',
    '& fieldset': { border: '1px solid transparent' },
    '&:hover fieldset': { borderColor: '#e4dff2' },
    '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
    '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
  },
  '& .MuiOutlinedInput-input': {
    fontSize: '0.875rem',
    fontFamily: 'Jost',
    py: '12px',
    px: '14px',
    color: '#0f172a',
  },
}

const labelSx = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#475569',
  mb: 0.875,
  fontFamily: 'Jost',
}

const eventTypes = [
  { id: 'tx.flagged',     label: 'Transaction flagged',     desc: 'Fires when a transaction crosses a risk threshold' },
  { id: 'tx.blocked',     label: 'Transaction blocked',     desc: 'Fires when an inbound transaction is auto-blocked' },
  { id: 'case.opened',    label: 'Case opened',             desc: 'Fires when an investigation case is created' },
  { id: 'case.escalated', label: 'Case escalated',          desc: 'Fires when a case is escalated to a senior officer' },
  { id: 'kyc.failed',     label: 'KYC verification failed', desc: 'Fires when a customer fails identity verification' },
  { id: 'sar.filed',      label: 'SAR/STR filed',           desc: 'Fires after an NFIU report is successfully filed' },
]

function statusBadge(status: 'active' | 'paused') {
  const active = status === 'active'
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, bgcolor: active ? '#f0fdf4' : '#fef3c7' }}>
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: active ? '#10b981' : '#f59e0b', flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', color: active ? '#10b981' : '#b45309' }}>
        {status.toUpperCase()}
      </Typography>
    </Box>
  )
}

function deliveryStatusBadge(status: 'pending' | 'delivered' | 'failed') {
  const colors: Record<string, { bg: string; text: string }> = {
    delivered: { bg: '#f0fdf4', text: '#10b981' },
    failed:    { bg: '#fef2f2', text: '#dc2626' },
    pending:   { bg: '#f8fafc', text: '#64748b' },
  }
  const c = colors[status]
  return (
    <Box sx={{ px: 1, py: 0.25, bgcolor: c.bg }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', color: c.text }}>
        {status.toUpperCase()}
      </Typography>
    </Box>
  )
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

// ── Endpoint row ─────────────────────────────────────────────────────────────

type RowAction = 'pause' | 'resume' | 'delete'

interface EndpointRowProps {
  ep: WebhookEndpoint
  onUpdate: () => void
}

function EndpointRow({ ep, onUpdate }: EndpointRowProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [expanded,   setExpanded]   = useState(false)
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [dlLoading,  setDlLoading]  = useState(false)
  const [testing,    setTesting]    = useState(false)
  const [testNote,   setTestNote]   = useState<string | null>(null)

  // TOTP gate for updates / deletes
  const [totpOpen,   setTotpOpen]   = useState(false)
  const [totpAction, setTotpAction] = useState<RowAction | null>(null)

  const total = ep.successCount + ep.failureCount
  const rate  = total === 0 ? 100 : Math.round((ep.successCount / total) * 1000) / 10

  const loadDeliveries = useCallback(async () => {
    setDlLoading(true)
    try {
      const res = await webhookApi.deliveries(ep.id)
      setDeliveries(res.deliveries)
    } finally { setDlLoading(false) }
  }, [ep.id])

  const handleExpand = () => {
    if (!expanded) loadDeliveries()
    setExpanded(p => !p)
  }

  const openTotp = (action: RowAction) => {
    setMenuAnchor(null)
    setTotpAction(action)
    setTotpOpen(true)
  }

  const handleTotpConfirm = async () => {
    setTotpOpen(false)
    try {
      if (totpAction === 'delete') {
        await webhookApi.delete(ep.id)
      } else if (totpAction === 'pause') {
        await webhookApi.update(ep.id, { status: 'paused' })
      } else if (totpAction === 'resume') {
        await webhookApi.update(ep.id, { status: 'active' })
      }
      onUpdate()
    } catch {}
    setTotpAction(null)
  }

  const handleTest = async () => {
    setMenuAnchor(null)
    setTesting(true)
    setTestNote(null)
    try {
      await webhookApi.test(ep.id)
      setTestNote('Test event dispatched — check deliveries')
      if (expanded) loadDeliveries()
      else { setExpanded(true); setTimeout(loadDeliveries, 100) }
    } catch {
      setTestNote('Test failed')
    } finally { setTesting(false) }
  }

  const totpConfig = totpAction ? {
    delete: {
      operation: 'delete' as const,
      title: 'Delete webhook endpoint',
      description: 'This endpoint and all its delivery history will be permanently removed. Any system sending to this URL will stop receiving events immediately.',
      changes: undefined,
    },
    pause: {
      operation: 'update' as const,
      title: 'Pause webhook endpoint',
      description: 'Pausing this endpoint will stop OpenIV from delivering events to it. Existing delivery history is preserved.',
      changes: [{ field: 'Status', from: 'Active', to: 'Paused' }],
    },
    resume: {
      operation: 'update' as const,
      title: 'Resume webhook endpoint',
      description: 'Resuming this endpoint will immediately start delivering new events to it.',
      changes: [{ field: 'Status', from: 'Paused', to: 'Active' }],
    },
  }[totpAction] : null

  return (
    <Box sx={{ borderBottom: '1px solid #f4f5f7', '&:last-child': { borderBottom: 'none' } }}>
      {/* Main row */}
      <Box sx={{ px: 3, py: 2, display: 'grid', gridTemplateColumns: '1fr 80px 100px 110px 44px 44px', gap: 2, alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ep.url}
          </Typography>
          {ep.description && (
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25 }}>{ep.description}</Typography>
          )}
        </Box>
        <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{ep.events.length} event{ep.events.length !== 1 ? 's' : ''}</Typography>
        {statusBadge(ep.status)}
        <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{fmtRelative(ep.lastDeliveredAt)}</Typography>
        <Typography sx={{
          fontSize: '0.8125rem', fontWeight: 700,
          color: rate >= 99 ? '#10b981' : rate >= 95 ? '#f59e0b' : '#dc2626',
          fontFamily: 'SF Mono, Monaco, monospace',
        }}>
          {total === 0 ? '—' : `${rate}%`}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <IconButton size="small" disableRipple onClick={handleExpand} sx={{ borderRadius: 0, color: '#94a3b8', p: 0.5 }}>
            {expanded ? <ExpandLessRoundedIcon sx={{ fontSize: '1rem' }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: '1rem' }} />}
          </IconButton>
          <IconButton size="small" disableRipple onClick={e => setMenuAnchor(e.currentTarget)} sx={{ borderRadius: 0, color: '#94a3b8', p: 0.5 }}>
            <MoreHorizRoundedIcon sx={{ fontSize: '1.125rem' }} />
          </IconButton>
        </Box>
      </Box>

      {/* 3-dot menu */}
      <Popover
        open={Boolean(menuAnchor)}
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { borderRadius: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', border: '1px solid #eef0f4', minWidth: 180 } } }}
      >
        <Box onClick={handleTest} sx={{ px: 2, py: 1.25, cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Jost', fontWeight: 500, color: '#0f172a', '&:hover': { bgcolor: '#f8fafc' } }}>
          {testing ? 'Sending…' : 'Send test event'}
        </Box>
        <Box
          onClick={() => openTotp(ep.status === 'active' ? 'pause' : 'resume')}
          sx={{ px: 2, py: 1.25, cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Jost', fontWeight: 500, color: '#0f172a', '&:hover': { bgcolor: '#f8fafc' }, borderTop: '1px solid #f4f5f7' }}
        >
          {ep.status === 'active' ? 'Pause endpoint' : 'Resume endpoint'}
        </Box>
        <Box
          onClick={() => openTotp('delete')}
          sx={{ px: 2, py: 1.25, cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Jost', fontWeight: 500, color: '#dc2626', '&:hover': { bgcolor: '#fef2f2' }, borderTop: '1px solid #f4f5f7' }}
        >
          Delete endpoint
        </Box>
      </Popover>

      {/* Test result notice */}
      {testNote && (
        <Box sx={{ mx: 3, mb: 1.5, px: 2, py: 1, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <Typography sx={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>{testNote}</Typography>
        </Box>
      )}

      {/* Collapsible deliveries */}
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 2 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', mb: 1 }}>
            RECENT DELIVERIES
          </Typography>
          {dlLoading ? (
            <Stack gap={0.75}>
              {[1, 2, 3].map(i => <Skeleton key={i} variant="rectangular" height={32} />)}
            </Stack>
          ) : deliveries.length === 0 ? (
            <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No deliveries yet</Typography>
          ) : (
            <Stack gap={0}>
              {deliveries.map(d => (
                <Box key={d.id} sx={{ display: 'grid', gridTemplateColumns: '130px 90px 60px 1fr', gap: 2, alignItems: 'center', py: 0.875, borderBottom: '1px solid #f4f5f7', '&:last-child': { borderBottom: 'none' } }}>
                  <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#475569' }}>{d.eventType}</Typography>
                  {deliveryStatusBadge(d.status)}
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{d.responseCode ?? '—'}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right' }}>{fmtRelative(d.createdAt)}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>

      {/* TOTP modal scoped to this row */}
      {totpConfig && (
        <TOTPConfirmation
          open={totpOpen}
          onClose={() => { setTotpOpen(false); setTotpAction(null) }}
          onConfirm={handleTotpConfirm}
          operation={totpConfig.operation}
          title={totpConfig.title}
          description={totpConfig.description}
          resourceType="Webhook endpoint"
          resourceName={ep.url}
          changes={totpConfig.changes}
        />
      )}
    </Box>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const [secret,        setSecret]        = useState<WebhookSecret | null>(null)
  const [secretLoading, setSecretLoading] = useState(true)
  const [endpoints,     setEndpoints]     = useState<WebhookEndpoint[]>([])
  const [epLoading,     setEpLoading]     = useState(true)
  const [showSecret,    setShowSecret]    = useState(false)
  const [copied,        setCopied]        = useState(false)

  // New endpoint form
  const [url,            setUrl]            = useState('')
  const [description,    setDescription]    = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['tx.flagged', 'case.opened'])
  const [formError,      setFormError]      = useState<string | null>(null)
  const [submitting,     setSubmitting]     = useState(false)

  // TOTP guards
  const [createOpen, setCreateOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)

  const loadSecret = useCallback(async () => {
    setSecretLoading(true)
    try { setSecret((await webhookApi.getSecret()).secret) }
    finally { setSecretLoading(false) }
  }, [])

  const loadEndpoints = useCallback(async () => {
    setEpLoading(true)
    try { setEndpoints((await webhookApi.list()).endpoints) }
    finally { setEpLoading(false) }
  }, [])

  useEffect(() => { loadSecret(); loadEndpoints() }, [loadSecret, loadEndpoints])

  const toggleEvent = (id: string) =>
    setSelectedEvents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleCopy = () => {
    if (!secret) return
    navigator.clipboard.writeText(secret.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCreateClick = () => {
    if (!url.startsWith('https://')) { setFormError('URL must start with https://'); return }
    if (selectedEvents.length === 0) { setFormError('Select at least one event'); return }
    setFormError(null)
    setCreateOpen(true)
  }

  const handleCreateConfirm = async () => {
    setSubmitting(true)
    try {
      await webhookApi.create(url, description, selectedEvents)
      setUrl(''); setDescription(''); setSelectedEvents(['tx.flagged', 'case.opened'])
      setCreateOpen(false)
      await loadEndpoints()
    } catch (e: any) {
      setFormError(e?.detail ?? e?.message ?? 'Failed to create endpoint')
      setCreateOpen(false)
    } finally { setSubmitting(false) }
  }

  const handleRotateConfirm = async () => {
    try {
      setSecret((await webhookApi.rotateSecret()).secret)
      setRotateOpen(false)
    } catch {}
  }

  const handleAutoRotateChange = async (checked: boolean) => {
    try { setSecret((await webhookApi.updateSecret(checked)).secret) } catch {}
  }

  // Days until next scheduled rotation
  const rotationDays   = secret ? daysUntil(secret.nextRotation) : null
  const rotationOverdue = rotationDays !== null && rotationDays <= 0

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Configure
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Webhooks
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Stream OpenIV events to your SIEM, case-management, or core banking systems in real time
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' }, gap: 3 }}>
          {/* Left column */}
          <Stack gap={3}>
            {/* New endpoint form */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  Add new endpoint
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  OpenIV will sign every payload with HMAC-SHA256 using your signing secret
                </Typography>
              </Box>
              <Box sx={{ p: 3 }}>
                <Stack gap={2.5}>
                  <Box>
                    <Typography sx={labelSx}>Endpoint URL</Typography>
                    <TextField fullWidth value={url} onChange={e => setUrl(e.target.value)}
                      placeholder="https://your-domain.com/webhooks/openiv" sx={inputSx} />
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>
                      Must be HTTPS. We retry with exponential backoff for up to 24 hours on 5xx responses.
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={labelSx}>
                      Description{' '}
                      <Typography component="span" sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>(optional)</Typography>
                    </Typography>
                    <TextField fullWidth value={description} onChange={e => setDescription(e.target.value)}
                      placeholder="Production SIEM ingestion" sx={inputSx} />
                  </Box>
                  <Box>
                    <Typography sx={labelSx}>Subscribe to events</Typography>
                    <Stack gap={0.75}>
                      {eventTypes.map(e => {
                        const checked = selectedEvents.includes(e.id)
                        return (
                          <Box
                            key={e.id}
                            onClick={() => toggleEvent(e.id)}
                            sx={{
                              p: 1.75, border: '1px solid',
                              borderColor: checked ? colorPalette.primary : '#eef0f4',
                              bgcolor: checked ? `${colorPalette.primary}06` : '#ffffff',
                              display: 'flex', alignItems: 'center', gap: 1.5,
                              cursor: 'pointer', transition: 'all 0.18s',
                              '&:hover': { borderColor: checked ? colorPalette.primary : '#cbd5e1' },
                            }}
                          >
                            <Box sx={{
                              width: 16, height: 16, flexShrink: 0,
                              border: `1.5px solid ${checked ? colorPalette.primary : '#cbd5e1'}`,
                              bgcolor: checked ? colorPalette.primary : '#ffffff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {checked && <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#ffffff' }} />}
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost' }}>
                                {e.label}
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>{e.desc}</Typography>
                            </Box>
                            <Typography sx={{ fontSize: '0.6875rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#94a3b8', bgcolor: '#f8fafc', px: 1, py: 0.375 }}>
                              {e.id}
                            </Typography>
                          </Box>
                        )
                      })}
                    </Stack>
                  </Box>

                  {formError && (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 500 }}>{formError}</Typography>
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      onClick={handleCreateClick}
                      disabled={submitting}
                      startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important', color: '#ffffff' }} />}
                      sx={{
                        bgcolor: colorPalette.primary, color: '#ffffff',
                        px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
                        borderRadius: 0, textTransform: 'none', boxShadow: 'none',
                        '& .MuiButton-startIcon': { color: '#ffffff' },
                        '&:hover': { bgcolor: '#1a3896' },
                        '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
                      }}
                    >
                      Create Endpoint
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </Box>

            {/* Endpoint list */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  {epLoading ? 'Endpoints' : `Endpoints (${endpoints.length})`}
                </Typography>
              </Box>
              {/* Column headers */}
              <Box sx={{ px: 3, py: 1, display: 'grid', gridTemplateColumns: '1fr 80px 100px 110px 44px 44px', gap: 2, borderBottom: '1px solid #f4f5f7' }}>
                {['URL / Description', 'Events', 'Status', 'Last delivery', 'Rate', ''].map((h, i) => (
                  <Typography key={i} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>{h}</Typography>
                ))}
              </Box>
              {epLoading ? (
                <Stack>
                  {[1, 2, 3].map(i => (
                    <Box key={i} sx={{ px: 3, py: 2.25, borderBottom: '1px solid #f4f5f7' }}>
                      <Skeleton variant="rectangular" height={20} width="60%" />
                    </Box>
                  ))}
                </Stack>
              ) : endpoints.length === 0 ? (
                <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No endpoints yet — add one above</Typography>
                </Box>
              ) : (
                endpoints.map(ep => <EndpointRow key={ep.id} ep={ep} onUpdate={loadEndpoints} />)
              )}
            </Box>
          </Stack>

          {/* Sidebar */}
          <Stack gap={3}>
            {/* Signing secret */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 3 }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>
                Signing Secret
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 2 }}>
                Use this secret to verify the HMAC-SHA256 signature on every webhook delivery.
              </Typography>

              <Box sx={{ bgcolor: '#0f172a', color: '#e2e8f0', p: 1.75, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', wordBreak: 'break-all', mb: 1.25 }}>
                {secretLoading
                  ? <Skeleton variant="text" sx={{ bgcolor: '#1e293b' }} />
                  : showSecret
                    ? (secret?.secret ?? '—')
                    : '•'.repeat(48)}
              </Box>

              <Stack direction="row" gap={1}>
                {/* Reveal / Hide */}
                <Button
                  startIcon={showSecret
                    ? <VisibilityOffOutlinedIcon sx={{ fontSize: '1rem !important' }} />
                    : <VisibilityOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
                  onClick={() => setShowSecret(p => !p)}
                  sx={{
                    flex: 1, bgcolor: '#ffffff', color: '#475569', border: '1px solid #e5e7eb',
                    px: 1.75, py: 1, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost',
                    borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#f8fafc' },
                  }}
                >
                  {showSecret ? 'Hide' : 'Reveal'}
                </Button>

                {/* Copy — explicit white text + icon */}
                <Button
                  startIcon={
                    copied
                      ? <CheckRoundedIcon sx={{ fontSize: '1rem !important', color: '#ffffff' }} />
                      : <ContentCopyOutlinedIcon sx={{ fontSize: '1rem !important', color: '#ffffff' }} />
                  }
                  onClick={handleCopy}
                  disabled={!secret}
                  sx={{
                    flex: 1,
                    bgcolor: copied ? '#10b981' : colorPalette.primary,
                    color: '#ffffff',
                    px: 1.75, py: 1,
                    fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost',
                    borderRadius: 0, textTransform: 'none', boxShadow: 'none',
                    '& .MuiButton-startIcon': { color: '#ffffff' },
                    '&:hover': { bgcolor: copied ? '#10b981' : '#1a3896' },
                    '&:disabled': { bgcolor: '#e2e8f0' },
                  }}
                >
                  <Box component="span" sx={{ color: '#ffffff' }}>{copied ? 'Copied' : 'Copy'}</Box>
                </Button>
              </Stack>

              {/* Auto-rotate section */}
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eef0f4' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                      Auto-rotate every 90 days
                    </Typography>
                    {secret && (
                      <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{
                          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                          bgcolor: rotationOverdue ? '#dc2626' : secret.autoRotate ? '#10b981' : '#94a3b8',
                        }} />
                        <Typography sx={{ fontSize: '0.6875rem', color: rotationOverdue ? '#dc2626' : '#94a3b8', fontWeight: rotationOverdue ? 600 : 400 }}>
                          {rotationOverdue
                            ? 'Rotation overdue — will run on next check'
                            : `Next rotation in ${rotationDays} day${rotationDays === 1 ? '' : 's'} · ${new Date(secret.nextRotation).toLocaleDateString()}`}
                        </Typography>
                      </Box>
                    )}
                    {secretLoading && (
                      <Skeleton variant="text" width={160} sx={{ mt: 0.5 }} />
                    )}
                  </Box>
                  <Switch
                    checked={secret?.autoRotate ?? true}
                    onChange={e => handleAutoRotateChange(e.target.checked)}
                    disabled={secretLoading}
                    size="small"
                    sx={{
                      '& .MuiSwitch-track': { borderRadius: 8 },
                      '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                      '& .Mui-checked .MuiSwitch-thumb': { color: '#ffffff' },
                    }}
                  />
                </Box>
                <Button
                  onClick={() => setRotateOpen(true)}
                  startIcon={<RefreshRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                  sx={{
                    fontSize: '0.75rem', fontWeight: 600, color: colorPalette.primary,
                    fontFamily: 'Jost', textTransform: 'none', p: 0,
                    '&:hover': { bgcolor: 'transparent', opacity: 0.75 },
                  }}
                >
                  Rotate now
                </Button>
              </Box>
            </Box>

            {/* Verification snippet */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 3 }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>
                Verify a payload
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 2 }}>
                Sample Node.js verification snippet
              </Typography>
              <Box sx={{
                bgcolor: '#0f172a', color: '#e2e8f0',
                p: 1.75, fontFamily: 'SF Mono, Monaco, monospace',
                fontSize: '0.6875rem', lineHeight: 1.6,
                overflowX: 'auto', whiteSpace: 'pre',
              }}>
{`const sig = req.headers['x-openiv-signature']
const hash = crypto
  .createHmac('sha256', process.env.OPENIV_SECRET)
  .update(req.rawBody)
  .digest('hex')

if (sig !== hash) return res.sendStatus(401)`}
              </Box>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* TOTP — create endpoint */}
      <TOTPConfirmation
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onConfirm={handleCreateConfirm}
        operation="create"
        title="Create webhook endpoint"
        description="You're creating a new outbound webhook that will receive sensitive event payloads from OpenIV. Verify with your authenticator code to authorize."
        resourceType="Webhook endpoint"
        resourceName={url}
      />

      {/* TOTP — rotate signing secret */}
      <TOTPConfirmation
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        onConfirm={handleRotateConfirm}
        operation="update"
        title="Rotate signing secret"
        description="Rotating the signing secret immediately invalidates the existing one. All endpoints must be updated with the new secret to keep verifying signatures."
        resourceType="Signing secret"
        resourceName="Webhook signing secret"
        changes={[{ field: 'Secret', from: 'Current secret', to: 'New generated secret' }]}
      />
    </DashboardLayout>
  )
}
