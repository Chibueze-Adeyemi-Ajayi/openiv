import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box, Typography, Stack, Button, TextField, Switch,
  IconButton, Popover, Skeleton, Collapse, Dialog,
} from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import {
  webhookApi,
  type WebhookEndpoint,
  type WebhookSecret,
  type WebhookDelivery,
  type WebhookSecurityRule,
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
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

// ── Style constants ───────────────────────────────────────────────────────────

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

const selectSx = {
  height: 36, fontSize: '0.8125rem', fontFamily: 'Jost',
  borderRadius: 0, bgcolor: '#ffffff',
  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #eef0f4' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colorPalette.primary, borderWidth: '1px' },
}

const eventTypes = [
  { id: 'tx.flagged',     label: 'Transaction flagged',     desc: 'Fires when a transaction crosses a risk threshold' },
  { id: 'tx.blocked',     label: 'Transaction blocked',     desc: 'Fires when an inbound transaction is auto-blocked' },
  { id: 'case.opened',    label: 'Case opened',             desc: 'Fires when an investigation case is created' },
  { id: 'case.escalated', label: 'Case escalated',          desc: 'Fires when a case is escalated to a senior officer' },
  { id: 'kyc.failed',     label: 'KYC verification failed', desc: 'Fires when a customer fails identity verification' },
  { id: 'sar.filed',      label: 'SAR/STR filed',           desc: 'Fires after an NFIU report is successfully filed' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function prettyJson(raw: string | null): string {
  if (!raw) return ''
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function shortId(id: string | null): string {
  if (!id) return '—'
  const parts = id.split('_')
  return parts[parts.length - 1]?.slice(0, 8) ?? id.slice(-8)
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

// ── Status badges ─────────────────────────────────────────────────────────────

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

function DeliveryStatusBadge({ status }: { status: 'pending' | 'delivered' | 'failed' }) {
  const config = {
    delivered: { bg: '#f0fdf4', color: '#10b981', dot: '#10b981' },
    failed:    { bg: '#fef2f2', color: '#dc2626', dot: '#dc2626' },
    pending:   { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' },
  }[status]
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.375, bgcolor: config.bg }}>
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: config.dot, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', color: config.color }}>
        {status.toUpperCase()}
      </Typography>
    </Box>
  )
}

// ── Syntax highlighting ───────────────────────────────────────────────────────

type SToken = { text: string; color: string; italic?: boolean }

const SC = {
  keyword:  '#c792ea',
  string:   '#c3e88d',
  number:   '#f78c6c',
  comment:  '#546e7a',
  func:     '#82aaff',
  env:      '#ffcb6b',
  url:      '#80cbc4',
  punct:    '#89ddff',
  plain:    '#e2e8f0',
  operator: '#89ddff',
}

const SKW = [
  'curl','const','let','var','import','from','require','async','await',
  'function','return','if','else','try','catch','throw','new','class',
  'export','default','def','for','in','with','pass','raise','as','elif',
  'True','False','None','func','package','type','struct','interface',
  'public','private','protected','static','void','final','this',
  'print','println','true','false','null','undefined','nil',
  'bytes','json','http','time','net','os','fmt','uuid',
  'POST','GET','PUT','DELETE','PATCH','HEAD',
].join('|')

const SKW_RE = new RegExp(`^(?:${SKW})(?=[^a-zA-Z_0-9]|$)`)

const SPATTERNS: Array<{ re: RegExp; color: string; italic?: boolean }> = [
  { re: /^#[^\n]*/,                           color: SC.comment,  italic: true },
  { re: /^\/\/[^\n]*/,                        color: SC.comment,  italic: true },
  { re: /^"(?:[^"\\]|\\.)*"/,                 color: SC.string },
  { re: /^'(?:[^'\\]|\\.)*'/,                 color: SC.string },
  { re: /^`(?:[^`\\]|\\.)*`/,                 color: SC.string },
  { re: /^\$\{[^}]+\}/,                       color: SC.env },
  { re: /^\$[A-Z_][A-Z_0-9]*/,               color: SC.env },
  { re: /^https?:\/\/[^\s'"\\),`]+/,          color: SC.url },
  { re: SKW_RE,                               color: SC.keyword },
  { re: /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, color: SC.number },
  { re: /^[{}[\]();,]/,                       color: SC.punct },
  { re: /^[:=<>+\-*/|&^~%!]/,                color: SC.operator },
  { re: /^[\\]/,                              color: SC.punct },
  { re: /^[a-zA-Z_][a-zA-Z_0-9]*(?=\()/,    color: SC.func },
]

function syntaxTokenize(code: string): SToken[] {
  const tokens: SToken[] = []
  let remaining = code
  while (remaining.length > 0) {
    let matched = false
    for (const { re, color, italic } of SPATTERNS) {
      const m = re.exec(remaining)
      if (m) {
        tokens.push({ text: m[0], color, italic })
        remaining = remaining.slice(m[0].length)
        matched = true
        break
      }
    }
    if (!matched) {
      const last = tokens[tokens.length - 1]
      if (last && last.color === SC.plain && !last.italic) {
        last.text += remaining[0]
      } else {
        tokens.push({ text: remaining[0], color: SC.plain })
      }
      remaining = remaining.slice(1)
    }
  }
  return tokens
}

// ── Shared components ─────────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <Button
      size="small"
      startIcon={copied
        ? <CheckRoundedIcon sx={{ fontSize: '0.75rem !important', color: '#10b981' }} />
        : <ContentCopyOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
      onClick={copy}
      sx={{
        fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600,
        color: copied ? '#10b981' : '#64748b', textTransform: 'none',
        px: 1, py: 0.375, borderRadius: 0,
        '&:hover': { bgcolor: '#f8fafc' },
        '& .MuiButton-startIcon': { mr: 0.375 },
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}

function CodeBlock({ content, copyLabel, highlight = false }: { content: string; copyLabel?: string; highlight?: boolean }) {
  const tokens = highlight ? syntaxTokenize(content) : null
  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{
        bgcolor: '#0d1117', borderRadius: 0,
        p: 2, fontFamily: 'SF Mono, Monaco, Consolas, monospace',
        fontSize: '0.6875rem', lineHeight: 1.7,
        overflowX: 'auto', whiteSpace: 'pre',
        maxHeight: 320, overflowY: 'auto',
      }}>
        {tokens
          ? tokens.map((t, i) => (
              <Box key={i} component="span" sx={{ color: t.color, fontStyle: t.italic ? 'italic' : 'normal', whiteSpace: 'pre' }}>{t.text}</Box>
            ))
          : <Box component="span" sx={{ color: '#e2e8f0' }}>{content || '(empty)'}</Box>
        }
      </Box>
      {content && (
        <Box sx={{ position: 'absolute', top: 6, right: 6 }}>
          <CopyBtn text={content} label={copyLabel ?? 'Copy'} />
        </Box>
      )}
    </Box>
  )
}

function DeliveryDetail({ d }: { d: WebhookDelivery }) {
  const [tab, setTab] = useState(0)
  const reqBody  = prettyJson(d.requestBody)
  const respBody = prettyJson(d.responseBody)

  return (
    <Box sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #eef0f4' }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          borderBottom: '1px solid #eef0f4', minHeight: 36,
          '& .MuiTabs-indicator': { bgcolor: colorPalette.primary, height: 2 },
          '& .MuiTab-root': {
            fontFamily: 'Jost', fontSize: '0.75rem', fontWeight: 600,
            textTransform: 'none', minHeight: 36, py: 0, px: 2.5,
            color: '#94a3b8',
            '&.Mui-selected': { color: colorPalette.primary },
          },
        }}
      >
        <Tab label="Request" />
        <Tab label="Response" />
        <Tab label="Metadata" />
      </Tabs>

      <Box sx={{ p: 2.5 }}>
        {tab === 0 && (
          <Stack gap={2}>
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', mb: 0.75 }}>HEADERS</Typography>
              <CodeBlock content={d.requestHeaders ?? ''} copyLabel="Copy headers" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', mb: 0.75 }}>BODY</Typography>
              <CodeBlock content={reqBody} copyLabel="Copy payload" />
            </Box>
          </Stack>
        )}

        {tab === 1 && (
          <Stack gap={2}>
            {d.status === 'failed' && d.errorMessage && (
              <Box sx={{ px: 2, py: 1.5, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', mb: 0.25 }}>Connection error</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {d.errorMessage}
                </Typography>
              </Box>
            )}
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', mb: 0.75 }}>HEADERS</Typography>
              <CodeBlock content={d.responseHeaders ?? '(no response headers)'} copyLabel="Copy headers" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', mb: 0.75 }}>BODY</Typography>
              <CodeBlock content={respBody || '(no response body)'} copyLabel="Copy body" />
            </Box>
          </Stack>
        )}

        {tab === 2 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {[
              ['Delivery ID',   d.deliveryId ?? '—'],
              ['Event type',    d.eventType],
              ['Status',        d.status],
              ['HTTP code',     d.responseCode != null ? String(d.responseCode) : '—'],
              ['Duration',      fmtDuration(d.durationMs)],
              ['Attempt count', String(d.attemptCount)],
              ['Delivered at',  d.deliveredAt ? new Date(d.deliveredAt).toLocaleString() : '—'],
              ['Queued at',     new Date(d.createdAt).toLocaleString()],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', mb: 0.25 }}>
                  {label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#0f172a', wordBreak: 'break-all' }}>
                    {value}
                  </Typography>
                  {label === 'Delivery ID' && d.deliveryId && <CopyBtn text={d.deliveryId} label="Copy" />}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}

function LogDeliveryRow({ d, endpointUrl }: { d: WebhookDelivery; endpointUrl: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Box sx={{ borderBottom: '1px solid #f4f5f7', '&:last-child': { borderBottom: 'none' } }}>
      <Box
        onClick={() => setExpanded(p => !p)}
        data-ai-analyzable="true"
        data-ai-description={`Webhook Delivery: ${shortId(d.deliveryId)}. event: ${d.eventType}. status: ${d.status}. response: ${d.responseCode ?? 'N/A'}. duration: ${fmtDuration(d.durationMs)}. queued: ${fmtRelative(d.createdAt)}.`}
        sx={{
          px: 3, py: 1.5,
          display: 'grid',
          gridTemplateColumns: '120px 1fr 130px 90px 56px 80px 80px 32px',
          gap: 1.5, alignItems: 'center',
          cursor: 'pointer',
          '&:hover': { bgcolor: '#f8fafc' },
          transition: 'background 0.15s',
        }}
      >
        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#475569' }}>
          {shortId(d.deliveryId)}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {endpointUrl}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#475569' }}>
          {d.eventType}
        </Typography>
        <DeliveryStatusBadge status={d.status} />
        <Typography sx={{
          fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', fontWeight: 600,
          color: d.responseCode == null ? '#94a3b8'
            : d.responseCode < 300 ? '#10b981'
            : d.responseCode < 500 ? '#f59e0b' : '#dc2626',
        }}>
          {d.responseCode ?? '—'}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'SF Mono, Monaco, monospace' }}>
          {fmtDuration(d.durationMs)}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          {fmtRelative(d.createdAt)}
        </Typography>
        <IconButton size="small" disableRipple sx={{ borderRadius: 0, color: '#94a3b8', p: 0.25 }}>
          {expanded
            ? <ExpandLessRoundedIcon sx={{ fontSize: '1rem' }} />
            : <ExpandMoreRoundedIcon sx={{ fontSize: '1rem' }} />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <DeliveryDetail d={d} />
      </Collapse>
    </Box>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Box 
      data-ai-analyzable="true"
      data-ai-description={`Webhook Performance KPI: ${label}. current value: ${value}. status: ${sub || 'N/A'}.`}
      sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2, flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: color ?? '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.02em' }}>
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25 }}>{sub}</Typography>
      )}
    </Box>
  )
}

// ── Security Rules Modal ──────────────────────────────────────────────────────

interface SecurityRulesModalProps {
  ep: WebhookEndpoint
  open: boolean
  onClose: () => void
}

function SecurityRulesModal({ ep, open, onClose }: SecurityRulesModalProps) {
  const [rule,         setRule]         = useState<WebhookSecurityRule | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [ipAllowlist,  setIpAllowlist]  = useState('')
  const [timeout,      setTimeout_]     = useState(10)
  const [maxRetries,   setMaxRetries]   = useState(3)
  const [requireAck,   setRequireAck]   = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saveMsg,      setSaveMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  const [keyTotpOpen, setKeyTotpOpen]  = useState(false)
  const [newKey,      setNewKey]       = useState<string | null>(null)
  const [keyCopied,   setKeyCopied]    = useState(false)

  const loadRule = useCallback(async () => {
    setLoading(true)
    try {
      const res = await webhookApi.getSecurityRule(ep.id)
      const r = res.rule
      setRule(r)
      if (r) {
        setIpAllowlist(r.ipAllowlist ?? '')
        setTimeout_(r.timeoutSeconds)
        setMaxRetries(r.maxRetries)
        setRequireAck(r.requireAck)
      }
    } finally { setLoading(false) }
  }, [ep.id])

  useEffect(() => { if (open) loadRule() }, [open, loadRule])

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await webhookApi.upsertSecurityRule(ep.id, {
        ipAllowlist: ipAllowlist.trim() || null,
        timeoutSeconds: timeout,
        maxRetries,
        requireAck,
      })
      setRule(res.rule)
      setSaveMsg({ ok: true, text: 'Security rules saved successfully' })
    } catch {
      setSaveMsg({ ok: false, text: 'Failed to save — please try again' })
    } finally { setSaving(false) }
  }

  const handleGenerateKey = async () => {
    try {
      const res = await webhookApi.generateApiKey(ep.id)
      setNewKey(res.apiKey)
      setRule(prev => prev ? { ...prev, hasApiKey: true } : null)
      setKeyTotpOpen(false)
    } catch {}
  }

  const copyKey = () => {
    if (!newKey) return
    navigator.clipboard.writeText(newKey)
    setKeyCopied(true)
    setTimeout(() => setKeyCopied(false), 2000)
  }

  const smallLabel = { fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 0.75, fontFamily: 'Jost' }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        disableEnforceFocus={keyTotpOpen}
        PaperProps={{ sx: { borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } }}
      >
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <SecurityOutlinedIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
            <Box>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Security Rules
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.125, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ep.url}
              </Typography>
            </Box>
          </Box>
          <IconButton disableRipple size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#475569' } }}>
            <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
          </IconButton>
        </Box>

        <Box sx={{ px: 3, py: 3 }}>
          {loading ? (
            <Stack gap={2}>
              {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rectangular" height={40} />)}
            </Stack>
          ) : (
            <Stack gap={3}>
              <Box 
                data-ai-analyzable="true"
                data-ai-description={`Webhook Security: API Key Configuration. status: ${rule?.hasApiKey ? 'Configured' : 'Not set'}. When set, OpenIV sends this key in the X-OpenIV-Api-Key header to verify request origin.`}
                sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
                    <VpnKeyOutlinedIcon sx={{ fontSize: '1rem', color: '#475569' }} />
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost' }}>
                      API Key
                    </Typography>
                  </Box>
                  <Box sx={{
                    px: 1, py: 0.375, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em',
                    bgcolor: rule?.hasApiKey ? '#f0fdf4' : '#f8fafc',
                    color: rule?.hasApiKey ? '#10b981' : '#94a3b8',
                  }}>
                    {rule?.hasApiKey ? 'CONFIGURED' : 'NOT SET'}
                  </Box>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 1.5 }}>
                  When set, OpenIV sends this key in the <code style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>X-OpenIV-Api-Key</code> header so your endpoint can verify the request origin.
                </Typography>

                {newKey && (
                  <Box sx={{ mb: 1.5, p: 1.5, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#10b981', mb: 0.75, letterSpacing: '0.08em' }}>
                      NEW KEY — COPY NOW, IT WON'T BE SHOWN AGAIN
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ flex: 1, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: '#0f172a', wordBreak: 'break-all' }}>
                        {newKey}
                      </Typography>
                      <Button
                        startIcon={keyCopied
                          ? <CheckRoundedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />
                          : <ContentCopyOutlinedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />}
                        onClick={copyKey}
                        sx={{
                          flexShrink: 0,
                          bgcolor: keyCopied ? '#10b981' : colorPalette.primary, color: '#ffffff',
                          px: 1.5, py: 0.75, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost',
                          borderRadius: 0, textTransform: 'none', boxShadow: 'none',
                          '& .MuiButton-startIcon': { color: '#ffffff', mr: 0.5 },
                          '&:hover': { bgcolor: keyCopied ? '#10b981' : '#1a3896' },
                        }}
                      >
                        <Box component="span" sx={{ color: '#ffffff' }}>{keyCopied ? 'Copied' : 'Copy'}</Box>
                      </Button>
                    </Box>
                  </Box>
                )}

                <Button
                  onClick={() => setKeyTotpOpen(true)}
                  startIcon={<VpnKeyOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                  sx={{
                    fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none',
                    color: colorPalette.primary, border: `1px solid ${colorPalette.primary}30`,
                    px: 1.75, py: 0.75, borderRadius: 0,
                    '&:hover': { bgcolor: `${colorPalette.primary}06` },
                  }}
                >
                  {rule?.hasApiKey ? 'Regenerate API key' : 'Generate API key'}
                </Button>
              </Box>

              <Box>
                <Typography sx={smallLabel}>IP Allowlist</Typography>
                <TextField
                  fullWidth multiline rows={3}
                  value={ipAllowlist}
                  onChange={e => setIpAllowlist(e.target.value)}
                  placeholder={'192.168.1.0/24\n10.0.0.1\n172.16.0.0/12'}
                  sx={inputSx}
                />
                <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>
                  One IP or CIDR range per line. Leave blank to allow all sources.
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography sx={smallLabel}>Request timeout (seconds)</Typography>
                  <TextField
                    fullWidth type="number" value={timeout}
                    onChange={e => setTimeout_(Math.max(1, Math.min(60, Number(e.target.value))))}
                    inputProps={{ min: 1, max: 60 }}
                    sx={inputSx}
                  />
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>1–60 seconds</Typography>
                </Box>
                <Box>
                  <Typography sx={smallLabel}>Max retries</Typography>
                  <TextField
                    fullWidth type="number" value={maxRetries}
                    onChange={e => setMaxRetries(Math.max(0, Math.min(10, Number(e.target.value))))}
                    inputProps={{ min: 0, max: 10 }}
                    sx={inputSx}
                  />
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>0–10 retries</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost' }}>
                    Require acknowledgement
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    Mark delivery failed if your endpoint doesn't respond with 2xx within the timeout
                  </Typography>
                </Box>
                <Switch
                  checked={requireAck}
                  onChange={e => setRequireAck(e.target.checked)}
                  size="small"
                  sx={{
                    flexShrink: 0,
                    '& .MuiSwitch-track': { borderRadius: 8 },
                    '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                    '& .Mui-checked .MuiSwitch-thumb': { color: '#ffffff' },
                  }}
                />
              </Box>

              {saveMsg && (
                <Box sx={{ px: 2, py: 1, bgcolor: saveMsg.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${saveMsg.ok ? '#bbf7d0' : '#fecaca'}` }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: saveMsg.ok ? '#10b981' : '#dc2626' }}>
                    {saveMsg.text}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </Box>

        <Box sx={{ px: 3, py: 2, borderTop: '1px solid #eef0f4', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button
            onClick={onClose}
            sx={{ fontSize: '0.8125rem', fontFamily: 'Jost', fontWeight: 600, color: '#64748b', textTransform: 'none', px: 2, py: 1, borderRadius: 0, '&:hover': { bgcolor: '#f8fafc' } }}
          >
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            sx={{
              bgcolor: colorPalette.primary, color: '#ffffff',
              px: 2.5, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
              borderRadius: 0, textTransform: 'none', boxShadow: 'none',
              '&:hover': { bgcolor: '#1a3896' },
              '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
            }}
          >
            {saving ? 'Saving…' : 'Save rules'}
          </Button>
        </Box>
      </Dialog>

      <TOTPConfirmation
        open={keyTotpOpen}
        onClose={() => setKeyTotpOpen(false)}
        onConfirm={handleGenerateKey}
        operation="create"
        title={rule?.hasApiKey ? 'Regenerate API key' : 'Generate API key'}
        description={rule?.hasApiKey
          ? 'Regenerating the API key immediately invalidates the existing one. Update your endpoint to use the new key.'
          : 'Generating an API key allows OpenIV to authenticate requests to your endpoint via the X-OpenIV-Api-Key header.'}
        resourceType="Webhook endpoint"
        resourceName={ep.url}
      />
    </>
  )
}

// ── Endpoint row ──────────────────────────────────────────────────────────────

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

  const [totpOpen,   setTotpOpen]   = useState(false)
  const [totpAction, setTotpAction] = useState<RowAction | null>(null)
  const [secRulesOpen, setSecRulesOpen] = useState(false)

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
          onClick={() => { setMenuAnchor(null); setSecRulesOpen(true) }}
          sx={{ px: 2, py: 1.25, cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Jost', fontWeight: 500, color: '#0f172a', '&:hover': { bgcolor: '#f8fafc' }, borderTop: '1px solid #f4f5f7', display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <SecurityOutlinedIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
          Security rules
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

      {testNote && (
        <Box sx={{ mx: 3, mb: 1.5, px: 2, py: 1, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <Typography sx={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>{testNote}</Typography>
        </Box>
      )}

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

      <SecurityRulesModal
        ep={ep}
        open={secRulesOpen}
        onClose={() => setSecRulesOpen(false)}
      />
    </Box>
  )
}

// ── Code samples ──────────────────────────────────────────────────────────────

const codeSamples: Record<string, string> = {
  'Node.js': `const crypto = require('crypto')
const express = require('express')
const app = express()

// Use raw body parser — you must verify the signature before parsing JSON
app.post('/webhooks/openiv', express.raw({ type: 'application/json' }), (req, res) => {
  const sig    = req.headers['x-openiv-signature']
  const secret = process.env.OPENIV_WEBHOOK_SECRET

  // Compute HMAC-SHA256 over the raw request body
  const expected = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex')

  // Always use timingSafeEqual to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const event = JSON.parse(req.body)
  console.log(\`[openiv] \${event.event} · \${event.id}\`)

  switch (event.event) {
    case 'tx.flagged':
      flagTransaction(event.data)
      break
    case 'tx.blocked':
      blockTransaction(event.data)
      break
    case 'case.opened':
      openCase(event.data)
      break
    case 'case.escalated':
      escalateCase(event.data)
      break
    case 'kyc.failed':
      handleKycFailure(event.data)
      break
    case 'sar.filed':
      recordSar(event.data)
      break
  }

  res.status(200).json({ received: true })
})`,

  Python: `import hashlib, hmac, json, os
from flask import Flask, request, abort, jsonify

app = Flask(__name__)
OPENIV_SECRET = os.environ['OPENIV_WEBHOOK_SECRET'].encode('utf-8')

@app.route('/webhooks/openiv', methods=['POST'])
def handle_webhook():
    sig      = request.headers.get('X-Openiv-Signature', '')
    raw_body = request.get_data()   # must read raw bytes before any parsing

    expected = hmac.new(OPENIV_SECRET, raw_body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(sig, expected):
        abort(401)

    event = json.loads(raw_body)
    print(f"[openiv] {event['event']} · {event['id']}")

    handlers = {
        'tx.flagged':    flag_transaction,
        'tx.blocked':    block_transaction,
        'case.opened':   open_case,
        'case.escalated': escalate_case,
        'kyc.failed':    handle_kyc_failure,
        'sar.filed':     record_sar,
    }
    handler = handlers.get(event['event'])
    if handler:
        handler(event['data'])

    return jsonify(received=True), 200`,

  Go: `package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
)

var webhookSecret = []byte(os.Getenv("OPENIV_WEBHOOK_SECRET"))

func handleWebhook(w http.ResponseWriter, r *http.Request) {
    sig, _ := hex.DecodeString(r.Header.Get("X-Openiv-Signature"))

    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "bad request", 400)
        return
    }

    mac := hmac.New(sha256.New, webhookSecret)
    mac.Write(body)
    expected := mac.Sum(nil)

    // hmac.Equal does constant-time comparison
    if !hmac.Equal(sig, expected) {
        http.Error(w, "invalid signature", 401)
        return
    }

    var event map[string]json.RawMessage
    json.Unmarshal(body, &event)
    var eventType string
    json.Unmarshal(event["event"], &eventType)
    fmt.Printf("[openiv] %s\\n", eventType)

    switch eventType {
    case "tx.flagged":
        flagTransaction(event["data"])
    case "case.opened":
        openCase(event["data"])
    case "kyc.failed":
        handleKycFailure(event["data"])
    }

    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(\`{"received":true}\`))
}

func main() {
    http.HandleFunc("/webhooks/openiv", handleWebhook)
    http.ListenAndServe(":8080", nil)
}`,

  Java: `import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

@RestController
public class OpenIVWebhookController {

    private final String secret = System.getenv("OPENIV_WEBHOOK_SECRET");

    @PostMapping(value = "/webhooks/openiv",
                 consumes = "application/json")
    public ResponseEntity<?> handle(
            @RequestHeader("X-Openiv-Signature") String sig,
            @RequestBody byte[] rawBody,
            HttpServletRequest req) throws Exception {

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(
            secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));

        byte[] hash = mac.doFinal(rawBody);
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        String expected = sb.toString();

        // Constant-time comparison
        if (!MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                sig.getBytes(StandardCharsets.UTF_8))) {
            return ResponseEntity.status(401).build();
        }

        var payload = new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(rawBody);
        String event = payload.get("event").asText();
        System.out.printf("[openiv] %s · %s%n", event, payload.get("id").asText());

        switch (event) {
            case "tx.flagged"    -> flagTransaction(payload.get("data"));
            case "case.opened"   -> openCase(payload.get("data"));
            case "kyc.failed"    -> handleKycFailure(payload.get("data"));
            case "sar.filed"     -> recordSar(payload.get("data"));
        }

        return ResponseEntity.ok(Map.of("received", true));
    }
}`,

  PHP: `<?php
// webhook.php

$secret  = getenv('OPENIV_WEBHOOK_SECRET');
$rawBody = file_get_contents('php://input');
$sig     = $_SERVER['HTTP_X_OPENIV_SIGNATURE'] ?? '';

$expected = hash_hmac('sha256', $rawBody, $secret);

// hash_equals is constant-time — never use === for signature comparison
if (!hash_equals($expected, $sig)) {
    http_response_code(401);
    exit(json_encode(['error' => 'Invalid signature']));
}

$event = json_decode($rawBody, true);
error_log(sprintf('[openiv] %s · %s', $event['event'], $event['id']));

switch ($event['event']) {
    case 'tx.flagged':
        flagTransaction($event['data']);
        break;
    case 'tx.blocked':
        blockTransaction($event['data']);
        break;
    case 'case.opened':
        openCase($event['data']);
        break;
    case 'kyc.failed':
        handleKycFailure($event['data']);
        break;
    case 'sar.filed':
        recordSar($event['data']);
        break;
}

http_response_code(200);
echo json_encode(['received' => true]);`,

  '.NET': `using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapPost("/webhooks/openiv", async (HttpContext ctx) =>
{
    var secret = Environment.GetEnvironmentVariable("OPENIV_WEBHOOK_SECRET")!;
    var sig    = ctx.Request.Headers["X-Openiv-Signature"].ToString();

    // Read raw body before any middleware touches it
    using var reader = new StreamReader(ctx.Request.Body);
    var rawBody = await reader.ReadToEndAsync();

    using var hmac  = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
    var hash        = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody));
    var expected    = Convert.ToHexString(hash).ToLowerInvariant();

    // CryptographicOperations.FixedTimeEquals prevents timing attacks
    if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(sig)))
    {
        return Results.Unauthorized();
    }

    var payload = System.Text.Json.JsonDocument.Parse(rawBody);
    var eventType = payload.RootElement.GetProperty("event").GetString();
    Console.WriteLine($"[openiv] {eventType} · {payload.RootElement.GetProperty("id").GetString()}");

    return eventType switch
    {
        "tx.flagged"  => HandleFlaggedTx(payload),
        "case.opened" => HandleCaseOpened(payload),
        "kyc.failed"  => HandleKycFailure(payload),
        _             => Results.Ok(new { received = true }),
    };
});

app.Run();`,
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  // Endpoints view state
  const [secret,        setSecret]        = useState<WebhookSecret | null>(null)
  const [secretLoading, setSecretLoading] = useState(true)
  const [endpoints,     setEndpoints]     = useState<WebhookEndpoint[]>([])
  const [epLoading,     setEpLoading]     = useState(true)
  const [showSecret,    setShowSecret]    = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [url,            setUrl]            = useState('')
  const [description,    setDescription]    = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['tx.flagged', 'case.opened'])
  const [formError,      setFormError]      = useState<string | null>(null)
  const [submitting,     setSubmitting]     = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [codeLang,   setCodeLang]   = useState(0)

  const langs = Object.keys(codeSamples)

  // ── Loaders ─────────────────────────────────────────────────────────────────

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

  // ── Endpoint form handlers ────────────────────────────────────────────────────

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

  const rotationDays    = secret ? daysUntil(secret.nextRotation) : null
  const rotationOverdue = rotationDays !== null && rotationDays <= 0

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>

        {/* Header */}
        <Box sx={{ mb: 3 }}>
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

        {/* ── Endpoints view ───────────────────────────────────────────────── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' }, gap: 3 }}>
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

            {/* Right sidebar */}
            <Stack gap={3}>
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
                      {secretLoading && <Skeleton variant="text" width={160} sx={{ mt: 0.5 }} />}
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
