import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Stack, Button, TextField, Switch,
  IconButton, Popover, Skeleton, Collapse, Dialog, CircularProgress,
  Tabs, Tab, MenuItem,
} from '@mui/material'
import { colorPalette } from '@/theme'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import {
  webhookApi,
  type WebhookEndpoint,
  type WebhookSecret,
  type WebhookDelivery,
  type WebhookSecurityRule,
} from '@/api/webhooks'
import { kycApi, type KycFetchConfig } from '@/api/kyc'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import WebhookOutlinedIcon from '@mui/icons-material/WebhookOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
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
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined'

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
    color: '#00288e',
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
  { id: 'tx.flagged', label: 'Transaction flagged', desc: 'Fires when a transaction crosses a risk threshold' },
  { id: 'tx.blocked', label: 'Transaction blocked', desc: 'Fires when an inbound transaction is auto-blocked' },
  { id: 'case.opened', label: 'Case opened', desc: 'Fires when an investigation case is created' },
  { id: 'case.escalated', label: 'Case escalated', desc: 'Fires when a case is escalated to a senior officer' },
  { id: 'sar.filed', label: 'SAR/STR filed', desc: 'Fires after an NFIU report is successfully filed' },
  { id: 'kyc.verified', label: 'KYC verified', desc: 'Fires when a customer reaches full verification — BVN and NIN both on file' },
  { id: 'kyc.partial', label: 'KYC partial', desc: 'Fires when a customer submits only one identifier (BVN or NIN without the other)' },
  { id: 'kyc.flagged', label: 'KYC flagged', desc: 'Fires when a beamed KYC record triggers a risk concern — PEP match or suspicious identity pattern' },
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
  if (m < 1) return 'just now'
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
    failed: { bg: '#fef2f2', text: '#dc2626' },
    pending: { bg: '#f8fafc', text: '#64748b' },
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
    failed: { bg: '#fef2f2', color: '#dc2626', dot: '#dc2626' },
    pending: { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' },
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
  keyword: '#c792ea',
  string: '#c3e88d',
  number: '#f78c6c',
  comment: '#546e7a',
  func: '#82aaff',
  env: '#ffcb6b',
  url: '#80cbc4',
  punct: '#89ddff',
  plain: '#e2e8f0',
  operator: '#89ddff',
}

const SKW = [
  'curl', 'const', 'let', 'var', 'import', 'from', 'require', 'async', 'await',
  'function', 'return', 'if', 'else', 'try', 'catch', 'throw', 'new', 'class',
  'export', 'default', 'def', 'for', 'in', 'with', 'pass', 'raise', 'as', 'elif',
  'True', 'False', 'None', 'func', 'package', 'type', 'struct', 'interface',
  'public', 'private', 'protected', 'static', 'void', 'final', 'this',
  'print', 'println', 'true', 'false', 'null', 'undefined', 'nil',
  'bytes', 'json', 'http', 'time', 'net', 'os', 'fmt', 'uuid',
  'POST', 'GET', 'PUT', 'DELETE', 'PATCH', 'HEAD',
].join('|')

const SKW_RE = new RegExp(`^(?:${SKW})(?=[^a-zA-Z_0-9]|$)`)

const SPATTERNS: Array<{ re: RegExp; color: string; italic?: boolean }> = [
  { re: /^#[^\n]*/, color: SC.comment, italic: true },
  { re: /^\/\/[^\n]*/, color: SC.comment, italic: true },
  { re: /^"(?:[^"\\]|\\.)*"/, color: SC.string },
  { re: /^'(?:[^'\\]|\\.)*'/, color: SC.string },
  { re: /^`(?:[^`\\]|\\.)*`/, color: SC.string },
  { re: /^\$\{[^}]+\}/, color: SC.env },
  { re: /^\$[A-Z_][A-Z_0-9]*/, color: SC.env },
  { re: /^https?:\/\/[^\s'"\\),`]+/, color: SC.url },
  { re: SKW_RE, color: SC.keyword },
  { re: /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, color: SC.number },
  { re: /^[{}[\]();,]/, color: SC.punct },
  { re: /^[:=<>+\-*/|&^~%!]/, color: SC.operator },
  { re: /^[\\]/, color: SC.punct },
  { re: /^[a-zA-Z_][a-zA-Z_0-9]*(?=\()/, color: SC.func },
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

function CodeBlock({ content, copyLabel, highlight = false, fixedHeight }: { content: string; copyLabel?: string; highlight?: boolean; fixedHeight?: number }) {
  const tokens = highlight ? syntaxTokenize(content) : null
  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{
        bgcolor: '#0d1117', borderRadius: 0,
        p: 2, fontFamily: 'SF Mono, Monaco, Consolas, monospace',
        fontSize: '0.6875rem', lineHeight: 1.7,
        overflowX: 'hidden', overflowY: 'auto',
        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        ...(fixedHeight ? { height: fixedHeight } : { maxHeight: 320 }),
      }}>
        {tokens
          ? tokens.map((t, i) => (
            <Box key={i} component="span" sx={{ color: t.color, fontStyle: t.italic ? 'italic' : 'normal', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{t.text}</Box>
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
  const reqBody = prettyJson(d.requestBody)
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
              ['Delivery ID', d.deliveryId ?? '—'],
              ['Event type', d.eventType],
              ['Status', d.status],
              ['HTTP code', d.responseCode != null ? String(d.responseCode) : '—'],
              ['Duration', fmtDuration(d.durationMs)],
              ['Attempt count', String(d.attemptCount)],
              ['Delivered at', d.deliveredAt ? new Date(d.deliveredAt).toLocaleString() : '—'],
              ['Queued at', new Date(d.createdAt).toLocaleString()],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', mb: 0.25 }}>
                  {label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#00288e', wordBreak: 'break-all' }}>
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
        <Typography sx={{ fontSize: '0.75rem', color: '#00288e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: color ?? '#00288e', fontFamily: 'Jost', letterSpacing: '-0.02em' }}>
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
  const [rule, setRule] = useState<WebhookSecurityRule | null>(null)
  const [loading, setLoading] = useState(true)
  const [ipAllowlist, setIpAllowlist] = useState('')
  const [timeout, setTimeout_] = useState(10)
  const [maxRetries, setMaxRetries] = useState(3)
  const [requireAck, setRequireAck] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [keyTotpOpen, setKeyTotpOpen] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [keyCopied, setKeyCopied] = useState(false)

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
    } catch { }
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
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
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
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost' }}>
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
                      <Typography sx={{ flex: 1, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: '#00288e', wordBreak: 'break-all' }}>
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
                          '&:hover': { bgcolor: keyCopied ? '#10b981' : '#1e293b' },
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
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost' }}>
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
              '&:hover': { bgcolor: '#1e293b' },
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
  const [expanded, setExpanded] = useState(false)
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [dlLoading, setDlLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testNote, setTestNote] = useState<string | null>(null)

  const [totpOpen, setTotpOpen] = useState(false)
  const [totpAction, setTotpAction] = useState<RowAction | null>(null)
  const [secRulesOpen, setSecRulesOpen] = useState(false)

  const total = ep.successCount + ep.failureCount
  const rate = total === 0 ? 100 : Math.round((ep.successCount / total) * 1000) / 10

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
    } catch { }
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
          <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#00288e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        <Box onClick={handleTest} sx={{ px: 2, py: 1.25, cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Jost', fontWeight: 500, color: '#00288e', '&:hover': { bgcolor: '#f8fafc' } }}>
          {testing ? 'Sending…' : 'Send test event'}
        </Box>
        <Box
          onClick={() => { setMenuAnchor(null); setSecRulesOpen(true) }}
          sx={{ px: 2, py: 1.25, cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Jost', fontWeight: 500, color: '#00288e', '&:hover': { bgcolor: '#f8fafc' }, borderTop: '1px solid #f4f5f7', display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <SecurityOutlinedIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
          Security rules
        </Box>
        <Box
          onClick={() => openTotp(ep.status === 'active' ? 'pause' : 'resume')}
          sx={{ px: 2, py: 1.25, cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Jost', fontWeight: 500, color: '#00288e', '&:hover': { bgcolor: '#f8fafc' }, borderTop: '1px solid #f4f5f7' }}
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
    case 'sar.filed':
      recordSar(event.data)
      break
    case 'kyc.verified':
      // event.data.customer_id, event.data.bvn_received, event.data.nin_received
      handleKycVerified(event.data)
      break
    case 'kyc.partial':
      // event.data.customer_id, event.data.bvn_received, event.data.nin_received
      handleKycPartial(event.data)
      break
    case 'kyc.flagged':
      // event.data.customer_id, event.data.risk_reason, event.data.pep_match
      handleKycFlagged(event.data)
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
        'sar.filed':     record_sar,
        'kyc.verified':  handle_kyc_verified,
        'kyc.partial':   handle_kyc_partial,
        'kyc.flagged':   handle_kyc_flagged,
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
    case "kyc.verified":
        handleKycVerified(event["data"])
    case "kyc.partial":
        handleKycPartial(event["data"])
    case "kyc.flagged":
        handleKycFlagged(event["data"])
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
            case "sar.filed"     -> recordSar(payload.get("data"));
            case "kyc.verified"  -> handleKycVerified(payload.get("data"));
            case "kyc.partial"   -> handleKycPartial(payload.get("data"));
            case "kyc.flagged"   -> handleKycFlagged(payload.get("data"));
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
    case 'sar.filed':
        recordSar($event['data']);
        break;
    case 'kyc.verified':
        handleKycVerified($event['data']);
        break;
    case 'kyc.partial':
        handleKycPartial($event['data']);
        break;
    case 'kyc.flagged':
        handleKycFlagged($event['data']);
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
        "kyc.verified" => HandleKycVerified(payload),
        "kyc.partial"  => HandleKycPartial(payload),
        "kyc.flagged"  => HandleKycFlagged(payload),
        _              => Results.Ok(new { received = true }),
    };
});

app.Run();`,
}

// ── VerifyButton ──────────────────────────────────────────────────────────────

function VerifyButton({ url, type }: { url: string; type: 'notification' }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const [ms, setMs] = useState<number | null>(null)

  const run = async () => {
    if (!url || !url.startsWith('https://')) return
    setState('loading')
    try {
      const r = await webhookApi.verify(url, type)
      setMs(r.durationMs)
      setState(r.ok ? 'ok' : 'fail')
    } catch {
      setState('fail')
    }
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
      <Button
        size="small"
        startIcon={state === 'loading'
          ? <CircularProgress size={12} sx={{ color: colorPalette.primary }} />
          : <LinkOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
        onClick={run}
        disabled={state === 'loading' || !url.startsWith('https://')}
        sx={{
          bgcolor: '#f8fafc', color: '#475569', border: '1px solid #e5e7eb',
          px: 1.75, py: 0.75, fontSize: '0.75rem', fontWeight: 600,
          fontFamily: 'Jost', borderRadius: 0, textTransform: 'none',
          '&:hover': { bgcolor: '#f1f5f9' },
        }}
      >
        Verify URL
      </Button>
      {state === 'ok' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CheckCircleOutlineRoundedIcon sx={{ fontSize: '0.875rem', color: '#10b981' }} />
          <Typography sx={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
            Reachable {ms != null ? `· ${ms}ms` : ''}
          </Typography>
        </Box>
      )}
      {state === 'fail' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ErrorOutlineRoundedIcon sx={{ fontSize: '0.875rem', color: '#dc2626' }} />
          <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
            Unreachable — check the URL and CORS
          </Typography>
        </Box>
      )}
    </Box>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  // Endpoints view state
  const [secret, setSecret] = useState<WebhookSecret | null>(null)
  const [secretLoading, setSecretLoading] = useState(true)
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [epLoading, setEpLoading] = useState(true)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['tx.flagged', 'case.opened'])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [tabValue, setTabValue] = useState(0)

  // KYC fetch webhook config state
  const [kycConfig, setKycConfig] = useState<KycFetchConfig | null>(null)
  const [kycConfigLoading, setKycConfigLoading] = useState(true)
  const [kycLookupUrl, setKycLookupUrl] = useState('')
  const [kycTimeout, setKycTimeout] = useState(10)
  const [kycSaving, setKycSaving] = useState(false)
  const [kycMsg, setKycMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Secrets tab state
  const [revealOpen, setRevealOpen] = useState(false)
  const [notifSampleLang, setNotifSampleLang] = useState('Node.js')
  const [fetchSampleLang, setFetchSampleLang] = useState('Node.js')

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

  const loadKycConfig = useCallback(async () => {
    setKycConfigLoading(true)
    try {
      const res = await kycApi.getFetchConfig()
      const cfg = res.config
      setKycConfig(cfg)
      if (cfg) {
        setKycLookupUrl(cfg.lookupUrl ?? '')
        setKycTimeout(cfg.lookupTimeout ?? 10)
      }

    } catch { }
    finally { setKycConfigLoading(false) }
  }, [])

  useEffect(() => { loadSecret(); loadEndpoints(); loadKycConfig() }, [loadSecret, loadEndpoints, loadKycConfig])

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
    } catch { }
  }

  const handleAutoRotateChange = async (checked: boolean) => {
    try { setSecret((await webhookApi.updateSecret(checked)).secret) } catch { }
  }

  const handleKycSave = async () => {
    setKycSaving(true)
    setKycMsg(null)
    try {
      const res = await kycApi.saveFetchConfig(kycLookupUrl.trim() || null, kycTimeout)
      setKycConfig(res.config)
      setKycMsg({ ok: true, text: 'Customer fetch webhook saved successfully.' })
    } catch {
      setKycMsg({ ok: false, text: 'Failed to save — please try again.' })
    } finally { setKycSaving(false) }
  }

  const handleRevealConfirm = () => {
    setRevealOpen(false)
    setShowSecret(true)
  }

  const rotationDays = secret ? daysUntil(secret.nextRotation) : null
  const rotationOverdue = rotationDays !== null && rotationDays <= 0

  return (
    <>
      <Box sx={{ p: 4 }}>

        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Configure
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Webhooks
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Stream OpenIV events to your SIEM, case-management, or core banking systems in real time
          </Typography>
        </Box>

        {/* Tab switcher */}
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          sx={{
            borderBottom: '1px solid #eef0f4', mb: 3, minHeight: 36,
            '& .MuiTabs-indicator': { bgcolor: colorPalette.primary, height: 2 },
            '& .MuiTab-root': {
              fontFamily: 'Jost', fontSize: '0.75rem', fontWeight: 600,
              textTransform: 'none', minHeight: 36, py: 0, px: 2.5,
              color: '#94a3b8',
              '&.Mui-selected': { color: colorPalette.primary },
            },
          }}
        >
          <Tab label="Notification Webhooks" />
          <Tab label="Customer Fetch Webhook" />
          <Tab label="Secrets" />
        </Tabs>

        {/* Tab 0: Notification Webhooks ────────────────────────────────────── */}
        {tabValue === 0 && (
          <Box>
            <Box sx={{ mb: 2.5, px: 2.5, py: 1.75, bgcolor: '#f8fafc', border: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <LockOutlinedIcon sx={{ fontSize: '0.875rem', color: '#64748b', flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.8125rem', color: '#475569' }}>
                Every delivery is signed with <strong>HMAC-SHA256</strong> using the shared signing secret.
                Manage the secret and see integration guides in the{' '}
                <Box component="span" onClick={() => setTabValue(2)}
                  sx={{ color: colorPalette.primary, fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                  Secrets tab
                </Box>.
              </Typography>
            </Box>
            <Stack gap={3}>
              {/* New endpoint form */}
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
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
                      {url && <VerifyButton url={url} type="notification" />}
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
                                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost' }}>
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
                        disabled={submitting || !url.trim() || !url.startsWith('https://') || selectedEvents.length === 0}
                        startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important', color: '#ffffff' }} />}
                        sx={{
                          bgcolor: colorPalette.primary, color: '#ffffff',
                          px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
                          borderRadius: 0, textTransform: 'none', boxShadow: 'none',
                          '& .MuiButton-startIcon': { color: '#ffffff' },
                          '&:hover': { bgcolor: '#1e293b' },
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
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
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
          </Box>
        )}

        {/* Tab 1: Customer Fetch Webhook ───────────────────────────────────── */}
        {tabValue === 1 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '480px 1fr' }, gap: 3, alignItems: 'start' }}>

            {/* Left: Config card */}
            <Stack gap={3}>
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 34, height: 34, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PersonSearchOutlinedIcon sx={{ fontSize: '1.125rem', color: '#1d4ed8' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                      Customer Lookup
                    </Typography>
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mt: 0.125 }}>
                      Customer Fetch Webhook
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ p: 3 }}>
                  {kycConfigLoading ? (
                    <Stack gap={2}>
                      {[1, 2, 3].map(i => <Skeleton key={i} variant="rectangular" height={44} />)}
                    </Stack>
                  ) : (
                    <Stack gap={2.5}>
                      <Box sx={{ px: 2.5, py: 2, bgcolor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#1e40af', lineHeight: 1.6 }}>
                          When a transaction is beamed for an <strong>unknown customer</strong>, OpenIV calls this endpoint
                          to fetch their profile. Requests are signed with <strong>HMAC-SHA256</strong> using the shared
                          signing secret from the{' '}
                          <Box component="span" onClick={() => setTabValue(2)}
                            sx={{ fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                            Secrets tab
                          </Box>.
                        </Typography>
                      </Box>

                      <Box>
                        <Typography sx={labelSx}>Lookup URL</Typography>
                        <TextField
                          fullWidth
                          value={kycLookupUrl}
                          onChange={e => setKycLookupUrl(e.target.value)}
                          placeholder="https://api.yourbank.com/customers"
                          sx={inputSx}
                        />
                        <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>
                          OpenIV will call <code style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>GET {'{your_url}/{customerId}'}</code> when a customer is not on file.
                          Must be HTTPS.
                        </Typography>
                      </Box>

                      <Box>
                        <Typography sx={labelSx}>Request timeout (seconds)</Typography>
                        <TextField
                          fullWidth type="number"
                          value={kycTimeout}
                          onChange={e => setKycTimeout(Math.max(1, Math.min(30, Number(e.target.value))))}
                          inputProps={{ min: 1, max: 30 }}
                          sx={inputSx}
                        />
                        <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>
                          1–30 seconds. If your endpoint doesn't respond in time, the transaction is rejected.
                        </Typography>
                      </Box>

                      {kycMsg && (
                        <Box sx={{ px: 2, py: 1.25, bgcolor: kycMsg.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${kycMsg.ok ? '#bbf7d0' : '#fecaca'}` }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: kycMsg.ok ? '#10b981' : '#dc2626' }}>
                            {kycMsg.text}
                          </Typography>
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          onClick={handleKycSave}
                          disabled={kycSaving}
                          startIcon={<SaveOutlinedIcon sx={{ fontSize: '1rem !important', color: '#ffffff' }} />}
                          sx={{
                            bgcolor: colorPalette.primary, color: '#ffffff',
                            px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
                            borderRadius: 0, textTransform: 'none', boxShadow: 'none',
                            '& .MuiButton-startIcon': { color: '#ffffff' },
                            '&:hover': { bgcolor: '#1e293b' },
                            '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
                          }}
                        >
                          {kycSaving ? 'Saving…' : 'Save Configuration'}
                        </Button>
                      </Box>
                    </Stack>
                  )}
                </Box>
              </Box>
            </Stack>

            {/* Right: Documentation */}
            <Stack gap={3}>
              {/* How it works */}
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoOutlinedIcon sx={{ fontSize: '1rem', color: colorPalette.primary }} />
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                    How it works
                  </Typography>
                </Box>
                <Box sx={{ p: 3 }}>
                  <Stack gap={2}>
                    {[
                      { icon: <WebhookOutlinedIcon sx={{ fontSize: '1rem', color: '#7c3aed' }} />, title: 'Transaction beamed for unknown customer', body: 'A transaction arrives via the Beam API with a customer_id that OpenIV has no KYC record for.' },
                      { icon: <PersonSearchOutlinedIcon sx={{ fontSize: '1rem', color: '#1d4ed8' }} />, title: 'OpenIV calls your lookup webhook', body: 'OpenIV sends a signed GET request to {your_url}/{customerId}. The request is authenticated with an HMAC-SHA256 signature — no Bearer token, no session cookie.' },
                      { icon: <TaskAltOutlinedIcon sx={{ fontSize: '1rem', color: '#10b981' }} />, title: 'Customer found — transaction proceeds', body: 'If your endpoint returns a valid 200 response with the customer\'s KYC payload, OpenIV registers the customer and processes the transaction normally.' },
                      { icon: <BlockOutlinedIcon sx={{ fontSize: '1rem', color: '#dc2626' }} />, title: 'Customer not found — transaction rejected', body: 'If your endpoint returns 404, times out, or returns an error, the transaction is immediately rejected with recommended_action: "REJECTED". Nothing is stored.' },
                    ].map((step, i) => (
                      <Box key={i} sx={{ display: 'flex', gap: 1.5 }}>
                        <Box sx={{ width: 28, height: 28, bgcolor: '#f8fafc', border: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.125 }}>
                          {step.icon}
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>{step.title}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25, lineHeight: 1.5 }}>{step.body}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>

              {/* Request format */}
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4' }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                    Request OpenIV sends to your endpoint
                  </Typography>
                </Box>
                <Box sx={{ p: 3 }}>
                  <Stack gap={2.5}>
                    <Box>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>Method & URL</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                        <Box sx={{ px: 1, py: 0.25, bgcolor: '#dcfce7', flexShrink: 0 }}>
                          <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: '#15803d', letterSpacing: '0.06em' }}>GET</Typography>
                        </Box>
                        <Typography sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: '#00288e' }}>
                          {'{your_lookup_url}'}/
                          <Box component="span" sx={{ color: '#7c3aed' }}>{'{customerId}'}</Box>
                        </Typography>
                      </Box>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>Headers</Typography>
                      <CodeBlock
                        content={`X-OpenIV-Timestamp: 1748908440          // Unix epoch seconds\nX-OpenIV-Signature: a3f9d2...c1e8b4    // HMAC-SHA256 hex (see below)\nX-OpenIV-Request:   customer-lookup\nAccept:             application/json`}
                        highlight
                      />
                    </Box>
                    <Box sx={{ px: 2.5, py: 2, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 1 }}>
                        Signature construction
                      </Typography>
                      <Stack gap={1}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.6 }}>
                          The signed payload is the concatenation of the Unix timestamp and the customer ID, separated by a dot:
                        </Typography>
                        <CodeBlock content={`signed_payload = "{timestamp}.{customerId}"\nsignature      = HMAC-SHA256(signing_secret, signed_payload)`} highlight />
                        <Typography sx={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.6 }}>
                          Reject the request if the timestamp is more than <strong>5 minutes</strong> old — this prevents replay attacks.
                          Always use a constant-time comparison when verifying the signature.
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              </Box>

              {/* Expected response */}
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4' }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                    Expected response from your endpoint
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    Identical to the KYC beam payload — the same format your core banking system uses to beam customer data
                  </Typography>
                </Box>
                <Box sx={{ p: 3 }}>
                  <Stack gap={2.5}>
                    <CodeBlock
                      content={`{\n  "customer_id": "CUS-00123",\n  "name": "Adebayo Okafor",\n  "bvn": "22234567890",\n  "nin": "12345678901",\n  "customer_kyc_tier": 2,\n  "photo": "<base64-encoded JPEG selfie>",  // optional\n  "occurred_at": "2026-05-22T09:14:00Z"\n}`}
                      highlight
                      copyLabel="Copy schema"
                    />

                    <Box>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>Field Reference</Typography>
                      <Box sx={{ border: '1px solid #eef0f4', overflow: 'hidden' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '130px 80px 60px 1fr', px: 2, py: 1, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
                          {['Field', 'Type', 'Required', 'Description'].map(h => (
                            <Typography key={h} sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</Typography>
                          ))}
                        </Box>
                        {[
                          { field: 'customer_id', type: 'string', req: true, desc: 'Your unique customer reference — must match the ID from the transaction beam' },
                          { field: 'name', type: 'string', req: false, desc: 'Full legal name of the customer' },
                          { field: 'bvn', type: 'string', req: false, desc: '11-digit Bank Verification Number. Providing BVN or NIN (or both) unlocks higher trust levels' },
                          { field: 'nin', type: 'string', req: false, desc: '11-digit National Identification Number' },
                          { field: 'customer_kyc_tier', type: 'number', req: false, desc: 'Your institution\'s KYC tier for this customer (e.g. 1, 2, 3). Stored and surfaced in the risk dashboard alongside the system-assessed knowledge level' },
                          { field: 'photo', type: 'string', req: false, desc: 'Base64-encoded JPEG or PNG selfie for liveness check. Omit if not available' },
                          { field: 'occurred_at', type: 'string', req: true, desc: 'ISO-8601 timestamp when this KYC data was collected by your institution' },
                        ].map((row, i, arr) => (
                          <Box key={row.field} sx={{ display: 'grid', gridTemplateColumns: '130px 80px 60px 1fr', px: 2, py: 1.25, alignItems: 'flex-start', borderBottom: i < arr.length - 1 ? '1px solid #f4f5f7' : 'none' }}>
                            <Typography sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary }}>{row.field}</Typography>
                            <Typography sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', color: '#f59e0b' }}>{row.type}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Typography sx={{ fontSize: '0.6875rem', color: row.req ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                                {row.req ? 'Yes' : 'No'}
                              </Typography>
                            </Box>
                            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', lineHeight: 1.5 }}>{row.desc}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>

                    <Box sx={{ px: 2.5, py: 2, bgcolor: '#fff7ed', border: '1px solid #fed7aa' }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', mb: 0.5 }}>
                        HTTP status codes
                      </Typography>
                      <Stack gap={0.75}>
                        {[
                          { code: '200', color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0', msg: 'Customer found — OpenIV will parse the body and register the customer' },
                          { code: '404', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', msg: 'Customer not found — transaction is rejected immediately' },
                          { code: '4xx / 5xx', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', msg: 'Error — transaction is rejected immediately' },
                          { code: 'Timeout', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', msg: 'No response within the configured timeout — transaction is rejected' },
                        ].map(e => (
                          <Box key={e.code} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, px: 1.5, py: 1, bgcolor: e.bg, border: `1px solid ${e.border}` }}>
                            <Typography sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', fontWeight: 800, color: e.color, flexShrink: 0, mt: 0.1 }}>{e.code}</Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#475569' }}>{e.msg}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              </Box>

              {/* Code samples */}
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4' }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                    Implementation example
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    Sample endpoint your core banking system should expose
                  </Typography>
                </Box>
                <Box sx={{ p: 3 }}>
                  <Stack gap={2}>
                    <Box>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>Node.js / Express</Typography>
                      <CodeBlock
                        highlight
                        copyLabel="Copy"
                        content={`const crypto  = require('crypto')
const express = require('express')
const app     = express()

const SIGNING_SECRET = process.env.OPENIV_LOOKUP_SECRET

function verifySignature(req, customerId) {
  const ts  = req.headers['x-openiv-timestamp']
  const sig = req.headers['x-openiv-signature']
  if (!ts || !sig) return false

  // Reject requests older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false

  const expected = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(\`\${ts}.\${customerId}\`)
    .digest('hex')

  // Always use timingSafeEqual to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(sig,      'hex'),
    Buffer.from(expected, 'hex'),
  )
}

app.get('/customers/:customerId', async (req, res) => {
  if (!verifySignature(req, req.params.customerId)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const customer = await db.customers.findById(req.params.customerId)
  if (!customer) return res.status(404).json({ error: 'Not found' })

  return res.json({
    customer_id:       customer.id,
    name:              customer.fullName,
    bvn:               customer.bvn ?? undefined,
    nin:               customer.nin ?? undefined,
    customer_kyc_tier: customer.kycTier ?? undefined,
    occurred_at:       customer.kycDate ?? new Date().toISOString(),
  })
})`}
                      />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>Python / FastAPI</Typography>
                      <CodeBlock
                        highlight
                        copyLabel="Copy"
                        content={`import hashlib, hmac, os, time
from fastapi import FastAPI, Header, HTTPException, Request

app = FastAPI()
SIGNING_SECRET = os.environ["OPENIV_LOOKUP_SECRET"].encode()

def verify_signature(customer_id: str, timestamp: str, signature: str) -> bool:
    # Reject requests older than 5 minutes
    if abs(time.time() - float(timestamp)) > 300:
        return False
    expected = hmac.new(
        SIGNING_SECRET,
        f"{timestamp}.{customer_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    # hmac.compare_digest is constant-time
    return hmac.compare_digest(expected, signature)

@app.get("/customers/{customer_id}")
async def fetch_customer(
    customer_id: str,
    x_openiv_timestamp: str = Header(...),
    x_openiv_signature: str = Header(...),
):
    if not verify_signature(customer_id, x_openiv_timestamp, x_openiv_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    customer = await db.get_customer(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Not found")

    return {
        "customer_id":       customer.id,
        "name":              customer.full_name,
        "bvn":               customer.bvn,
        "nin":               customer.nin,
        "customer_kyc_tier": customer.kyc_tier,
        "occurred_at":       customer.kyc_date.isoformat() + "Z",
    }`}
                      />
                    </Box>
                  </Stack>
                </Box>
              </Box>
            </Stack>
          </Box>
        )}

        {/* ── Tab 2: Secrets ───────────────────────────────────────────────── */}
        {tabValue === 2 && (
          <Stack gap={3}>

            {/* ── Secret card ───────────────────────────────────────────────── */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ width: 34, height: 34, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <KeyOutlinedIcon sx={{ fontSize: '1.125rem', color: '#1d4ed8' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                    Shared Signing Secret
                  </Typography>
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mt: 0.125 }}>
                    One secret authenticates all webhook types
                  </Typography>
                </Box>
                <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 0.625 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.1em' }}>ACTIVE</Typography>
                </Box>
              </Box>

              <Box sx={{ p: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 320px' }, gap: 3 }}>
                {/* Left: secret value + actions */}
                <Stack gap={2.5}>
                  {/* Value */}
                  <Box>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.875 }}>
                      Signing Secret
                    </Typography>
                    <Box sx={{
                      bgcolor: '#0f172a', p: 2, fontFamily: 'SF Mono, Monaco, monospace',
                      fontSize: '0.8125rem', color: showSecret ? '#c3e88d' : '#64748b',
                      wordBreak: 'break-all', lineHeight: 1.6, letterSpacing: showSecret ? '0.02em' : '0.15em',
                      minHeight: 56, display: 'flex', alignItems: 'center',
                    }}>
                      {secretLoading
                        ? <Skeleton variant="text" width="80%" sx={{ bgcolor: '#1e293b' }} />
                        : showSecret ? (secret?.secret ?? '—') : '•'.repeat(48)
                      }
                    </Box>
                    <Stack direction="row" gap={1} sx={{ mt: 1.25 }}>
                      <Button
                        startIcon={<LockOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                        onClick={() => showSecret ? setShowSecret(false) : setRevealOpen(true)}
                        sx={{
                          flex: 1, bgcolor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0',
                          px: 1.75, py: 0.875, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost',
                          borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#f1f5f9' },
                          '& .MuiButton-startIcon': { mr: 0.5 },
                        }}
                      >
                        {showSecret ? 'Hide secret' : 'Reveal (TOTP required)'}
                      </Button>
                      <Button
                        startIcon={copied
                          ? <CheckRoundedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />
                          : <ContentCopyOutlinedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />}
                        onClick={handleCopy}
                        disabled={!showSecret || !secret}
                        sx={{
                          flex: 1, bgcolor: copied ? '#10b981' : colorPalette.primary, color: '#ffffff',
                          px: 1.75, py: 0.875, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost',
                          borderRadius: 0, textTransform: 'none', boxShadow: 'none',
                          '& .MuiButton-startIcon': { color: '#ffffff', mr: 0.5 },
                          '&:hover': { bgcolor: copied ? '#10b981' : '#1e293b' },
                          '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
                        }}
                      >
                        <Box component="span" sx={{ color: '#ffffff' }}>{copied ? 'Copied!' : 'Copy secret'}</Box>
                      </Button>
                    </Stack>
                  </Box>

                  {/* Rotation */}
                  <Box sx={{ pt: 2, borderTop: '1px solid #f1f5f9' }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
                      Rotation
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5, gap: 2 }}>
                      <Box>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost' }}>
                          Auto-rotate every 90 days
                        </Typography>
                        {secretLoading
                          ? <Skeleton variant="text" width={200} sx={{ mt: 0.5 }} />
                          : secret && (
                            <Box sx={{ mt: 0.625, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, bgcolor: rotationOverdue ? '#dc2626' : secret.autoRotate ? '#10b981' : '#94a3b8' }} />
                              <Typography sx={{ fontSize: '0.75rem', color: rotationOverdue ? '#dc2626' : '#64748b', fontWeight: rotationOverdue ? 600 : 400 }}>
                                {rotationOverdue
                                  ? 'Rotation overdue — will run on next check'
                                  : `Next rotation ${new Date(secret.nextRotation).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${rotationDays} day${rotationDays === 1 ? '' : 's'} away`}
                              </Typography>
                            </Box>
                          )}
                      </Box>
                      <Switch
                        checked={secret?.autoRotate ?? true}
                        onChange={e => handleAutoRotateChange(e.target.checked)}
                        disabled={secretLoading}
                        size="small"
                        sx={{
                          flexShrink: 0,
                          '& .MuiSwitch-track': { borderRadius: 8 },
                          '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                          '& .Mui-checked .MuiSwitch-thumb': { color: '#ffffff' },
                        }}
                      />
                    </Box>
                    <Button
                      onClick={() => setRotateOpen(true)}
                      startIcon={<AutorenewOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
                      sx={{
                        bgcolor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                        px: 1.75, py: 0.75, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost',
                        borderRadius: 0, textTransform: 'none',
                        '& .MuiButton-startIcon': { mr: 0.5 },
                        '&:hover': { bgcolor: '#fee2e2' },
                      }}
                    >
                      Rotate now (TOTP required)
                    </Button>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 1 }}>
                      Rotating immediately invalidates the current secret. Update all your endpoints before rotating.
                    </Typography>
                  </Box>
                </Stack>

                {/* Right: usage summary */}
                <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #eef0f4', p: 2.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 1.5, letterSpacing: '0.05em' }}>
                    Used by
                  </Typography>
                  <Stack gap={1.25}>
                    {[
                      { label: 'Notification Webhooks', sub: 'Signs the raw POST body — verify with X-OpenIV-Signature', color: '#7c3aed', bg: '#f5f3ff' },
                      { label: 'Customer Fetch Webhook', sub: 'Signs {timestamp}.{customerId} — verify X-OpenIV-Signature + X-OpenIV-Timestamp', color: '#1d4ed8', bg: '#eff6ff' },
                    ].map(item => (
                      <Box key={item.label} sx={{ px: 1.5, py: 1.25, bgcolor: item.bg, border: `1px solid ${item.color}20` }}>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: item.color, fontFamily: 'Jost' }}>{item.label}</Typography>
                        <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.25, lineHeight: 1.5 }}>{item.sub}</Typography>
                      </Box>
                    ))}
                  </Stack>
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e2e8f0' }}>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', lineHeight: 1.6 }}>
                      The same secret signs every outbound request OpenIV makes to your infrastructure.
                      Store it as an environment variable — never hard-code it.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* ── Integration guide ─────────────────────────────────────────── */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>

              {/* Notification webhooks verification */}
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.375 }}>
                    <Box sx={{ px: 1, py: 0.25, bgcolor: '#f5f3ff' }}>
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: '#7c3aed', letterSpacing: '0.08em' }}>POST</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                      Verifying notification webhooks
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                    OpenIV POSTs signed JSON to your endpoint. Compute HMAC-SHA256 over the raw request body and compare to <code style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>X-OpenIV-Signature</code>.
                  </Typography>
                </Box>
                <Box sx={{ borderBottom: '1px solid #eef0f4' }}>
                  <Box sx={{ display: 'flex', overflowX: 'auto' }}>
                    {Object.keys(codeSamples).map(lang => (
                      <Box
                        key={lang}
                        onClick={() => setNotifSampleLang(lang)}
                        sx={{
                          px: 2, py: 1.25, cursor: 'pointer', flexShrink: 0,
                          borderBottom: notifSampleLang === lang ? `2px solid ${colorPalette.primary}` : '2px solid transparent',
                          color: notifSampleLang === lang ? colorPalette.primary : '#94a3b8',
                          fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost',
                          '&:hover': { color: notifSampleLang === lang ? colorPalette.primary : '#475569' },
                        }}
                      >
                        {lang}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <CodeBlock content={codeSamples[notifSampleLang] ?? ''} highlight copyLabel={`Copy ${notifSampleLang}`} fixedHeight={400} />
              </Box>

              {/* Customer fetch verification */}
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.375 }}>
                    <Box sx={{ px: 1, py: 0.25, bgcolor: '#eff6ff' }}>
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.08em' }}>GET</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                      Verifying customer fetch requests
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                    OpenIV GETs customer data from your endpoint. Compute HMAC-SHA256 over <code style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>"{'{timestamp}.{customerId}'}"</code> and compare to <code style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>X-OpenIV-Signature</code>. Reject requests older than 5 minutes.
                  </Typography>
                </Box>
                <Box sx={{ borderBottom: '1px solid #eef0f4' }}>
                  <Box sx={{ display: 'flex', overflowX: 'auto' }}>
                    {['Node.js', 'Python', 'Go', 'Java'].map(lang => (
                      <Box
                        key={lang}
                        onClick={() => setFetchSampleLang(lang)}
                        sx={{
                          px: 2, py: 1.25, cursor: 'pointer', flexShrink: 0,
                          borderBottom: fetchSampleLang === lang ? `2px solid ${colorPalette.primary}` : '2px solid transparent',
                          color: fetchSampleLang === lang ? colorPalette.primary : '#94a3b8',
                          fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost',
                          '&:hover': { color: fetchSampleLang === lang ? colorPalette.primary : '#475569' },
                        }}
                      >
                        {lang}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <CodeBlock content={{
                  'Node.js': `const crypto = require('crypto')

// Middleware: verify every incoming OpenIV GET request
function verifyOpenIVSignature(req, res, next) {
  const ts  = req.headers['x-openiv-timestamp']
  const sig = req.headers['x-openiv-signature']
  const id  = req.params.customerId

  if (!ts || !sig) return res.status(401).json({ error: 'Missing signature headers' })

  // Reject requests older than 5 minutes (replay attack protection)
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300)
    return res.status(401).json({ error: 'Request timestamp expired' })

  const expected = crypto
    .createHmac('sha256', process.env.OPENIV_SIGNING_SECRET)
    .update(\`\${ts}.\${id}\`)
    .digest('hex')

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(sig,      'hex'),
      Buffer.from(expected, 'hex'),
    )
    if (!valid) return res.status(401).json({ error: 'Invalid signature' })
  } catch {
    return res.status(401).json({ error: 'Invalid signature' })
  }
  next()
}

app.get('/customers/:customerId', verifyOpenIVSignature, async (req, res) => {
  const customer = await db.findById(req.params.customerId)
  if (!customer) return res.status(404).json({ error: 'Not found' })
  res.json({
    customer_id:       customer.id,
    name:              customer.fullName,
    bvn:               customer.bvn,
    nin:               customer.nin,
    customer_kyc_tier: customer.kycTier,
    occurred_at:       new Date().toISOString(),
  })
})`,
                  'Python': `import hashlib, hmac, os, time
from fastapi import FastAPI, Header, HTTPException

app     = FastAPI()
SECRET  = os.environ["OPENIV_SIGNING_SECRET"].encode()

def verify(customer_id: str, timestamp: str, signature: str) -> bool:
    # Reject requests older than 5 minutes
    if abs(time.time() - float(timestamp)) > 300:
        return False
    expected = hmac.new(SECRET, f"{timestamp}.{customer_id}".encode(),
                        hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

@app.get("/customers/{customer_id}")
async def fetch_customer(
    customer_id: str,
    x_openiv_timestamp: str = Header(...),
    x_openiv_signature: str = Header(...),
):
    if not verify(customer_id, x_openiv_timestamp, x_openiv_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    customer = await db.get(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "customer_id":       customer.id,
        "name":              customer.full_name,
        "bvn":               customer.bvn,
        "nin":               customer.nin,
        "customer_kyc_tier": customer.kyc_tier,
        "occurred_at":       customer.kyc_date.isoformat() + "Z",
    }`,
                  'Go': `package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "math"
    "net/http"
    "os"
    "strconv"
    "time"
)

var signingSecret = []byte(os.Getenv("OPENIV_SIGNING_SECRET"))

func verifySignature(r *http.Request, customerId string) bool {
    ts  := r.Header.Get("X-OpenIV-Timestamp")
    sig := r.Header.Get("X-OpenIV-Signature")
    if ts == "" || sig == "" { return false }

    epoch, err := strconv.ParseFloat(ts, 64)
    if err != nil || math.Abs(float64(time.Now().Unix())-epoch) > 300 {
        return false
    }

    sigBytes, err := hex.DecodeString(sig)
    if err != nil { return false }

    mac := hmac.New(sha256.New, signingSecret)
    mac.Write([]byte(fmt.Sprintf("%s.%s", ts, customerId)))
    return hmac.Equal(mac.Sum(nil), sigBytes)
}

func handleCustomer(w http.ResponseWriter, r *http.Request) {
    customerId := r.PathValue("customerId")
    if !verifySignature(r, customerId) {
        http.Error(w, \`{"error":"Invalid signature"}\`, 401); return
    }
    // ... return customer JSON
}`,
                  'Java': `import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;

@RestController
public class CustomerController {

    private final String secret = System.getenv("OPENIV_SIGNING_SECRET");

    private boolean verifySignature(String customerId,
            String timestamp, String signature) {
        try {
            // Reject requests older than 5 minutes
            long ts = Long.parseLong(timestamp);
            if (Math.abs(Instant.now().getEpochSecond() - ts) > 300) return false;

            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String payload  = timestamp + "." + customerId;
            byte[] computed = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : computed) sb.append(String.format("%02x", b));

            // Constant-time comparison
            return MessageDigest.isEqual(
                sb.toString().getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) { return false; }
    }

    @GetMapping("/customers/{customerId}")
    public ResponseEntity<?> fetchCustomer(
            @PathVariable String customerId,
            @RequestHeader("X-OpenIV-Timestamp") String ts,
            @RequestHeader("X-OpenIV-Signature") String sig) {

        if (!verifySignature(customerId, ts, sig))
            return ResponseEntity.status(401).build();

        Customer c = db.findById(customerId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return ResponseEntity.ok(Map.of(
            "customer_id",       c.getId(),
            "name",              c.getFullName(),
            "bvn",               c.getBvn(),
            "nin",               c.getNin(),
            "customer_kyc_tier", c.getKycTier(),
            "occurred_at",       c.getKycDate().toString()
        ));
    }
}`
                }[fetchSampleLang] ?? ''} highlight copyLabel={`Copy ${fetchSampleLang}`} fixedHeight={400} />
              </Box>

            </Box>
          </Stack>
        )}


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

      {/* TOTP — reveal signing secret */}
      <TOTPConfirmation
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        onConfirm={handleRevealConfirm}
        operation="update"
        title="Reveal signing secret"
        description="Verify your identity to view the signing secret in plain text. The secret will be visible only for this session."
        resourceType="Signing secret"
        resourceName="Webhook signing secret"
      />
    </>
  )
}
