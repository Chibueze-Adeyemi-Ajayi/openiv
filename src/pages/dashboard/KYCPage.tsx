import {
  Box, Typography, Stack, Button, InputBase,
  TextField, CircularProgress, Alert, Tooltip, Checkbox,
} from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import { kycApi, type KycConfig, type KycConfigInput, type KycLookupLog, type KycLookupResult } from '@/api/kyc'

// ── Advisory logic ────────────────────────────────────────────────────────────
// OpenIV pulls KYC from the bank, cross-references against PEP/sanctions,
// and issues an advisory on what action to take.

type Advisory = 'clear' | 'review' | 'restricted' | 'high-risk' | 'unverifiable'

function getAdvisory(log: KycLookupLog): Advisory {
  if (log.status !== 'success') return 'unverifiable'
  const s = (log.kycStatus ?? '').toLowerCase()
  if (log.kycTier === 3 && (s.includes('verif') || s.includes('clear') || s === '')) return 'clear'
  if (log.kycTier === 3) return 'review'
  if (log.kycTier === 2) return 'restricted'
  if (log.kycTier === 1) return 'high-risk'
  return 'unverifiable'
}

const ADVISORY_CFG: Record<Advisory, { label: string; color: string; bg: string; description: string }> = {
  'clear': { label: 'Clear', color: '#10b981', bg: '#f0fdf4', description: 'Full access — Tier 3 verified' },
  'review': { label: 'Review', color: colorPalette.primary, bg: `${colorPalette.primary}0f`, description: 'Manual review recommended' },
  'restricted': { label: 'Restricted', color: '#f59e0b', bg: '#fffbeb', description: 'Tier 2 — reduced transaction limits apply' },
  'high-risk': { label: 'High Risk', color: '#dc2626', bg: '#fef2f2', description: 'Tier 1 — minimal access per CBN rules' },
  'unverifiable': { label: 'Unverifiable', color: '#94a3b8', bg: '#f8fafc', description: 'Lookup failed or timed out' },
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function LookupStatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
    success: { icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: '0.75rem' }} />, color: '#10b981', bg: '#f0fdf4', label: 'SUCCESS' },
    failed: { icon: <CancelOutlinedIcon sx={{ fontSize: '0.75rem' }} />, color: '#dc2626', bg: '#fef2f2', label: 'FAILED' },
    timeout: { icon: <HourglassEmptyOutlinedIcon sx={{ fontSize: '0.75rem' }} />, color: '#f59e0b', bg: '#fffbeb', label: 'TIMEOUT' },
  }
  const cfg = map[status] ?? map.failed
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      bgcolor: cfg.bg, color: cfg.color, px: 0.875, py: 0.375,
      fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em'
    }}>
      {cfg.icon}{cfg.label}
    </Box>
  )
}

function AdvisoryBadge({ advisory }: { advisory: Advisory }) {
  const cfg = ADVISORY_CFG[advisory]
  return (
    <Tooltip title={cfg.description} placement="top">
      <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5,
        bgcolor: cfg.bg, color: cfg.color, px: 0.875, py: 0.375,
        fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', cursor: 'default'
      }}>
        <ShieldOutlinedIcon sx={{ fontSize: '0.75rem' }} />
        {cfg.label.toUpperCase()}
      </Box>
    </Tooltip>
  )
}

function fmtTs(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function TierBars({ tier }: { tier: number | null }) {
  if (tier == null) return <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</Typography>
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
      {[1, 2, 3].map((t) => (
        <Box key={t} sx={{ width: 8, height: 16, bgcolor: t <= tier ? colorPalette.primary : '#e5e7eb' }} />
      ))}
      <Typography sx={{ fontSize: '0.75rem', color: '#64748b', ml: 0.5 }}>T{tier}</Typography>
    </Box>
  )
}

// ── Customers view ────────────────────────────────────────────────────────────

type AdvisoryFilter = 'All' | 'Clear' | 'Review' | 'Restricted' | 'High Risk' | 'Unverifiable'
const ADVISORY_FILTERS: AdvisoryFilter[] = ['All', 'Clear', 'Review', 'Restricted', 'High Risk', 'Unverifiable']
const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual', tx_flag: 'Tx Flag', aml_case: 'AML Case',
}

function CustomersView() {
  const [logs, setLogs] = useState<KycLookupLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AdvisoryFilter>('All')

  useEffect(() => {
    kycApi.listLogs()
      .then(d => setLogs(d.logs))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  const withAdvisory = logs.map(l => ({ log: l, advisory: getAdvisory(l) }))

  const stats = {
    total: logs.length,
    clear: withAdvisory.filter(x => x.advisory === 'clear').length,
    restricted: withAdvisory.filter(x => x.advisory === 'restricted' || x.advisory === 'high-risk').length,
    unverifiable: withAdvisory.filter(x => x.advisory === 'unverifiable').length,
  }

  const filtered = withAdvisory.filter(({ log, advisory }) => {
    if (filter !== 'All' && advisory !== filter.toLowerCase().replace(' ', '-')) return false
    if (search && !log.customerRef.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <>
      {/* Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
        {[
          { label: 'Total lookups', value: stats.total, sub: 'customers checked' },
          { label: 'Clear', value: stats.clear, sub: 'full access advised' },
          { label: 'Restricted', value: stats.restricted, sub: 'limited access' },
          { label: 'Unverifiable', value: stats.unverifiable, sub: 'lookup failed or timeout' },
        ].map((s) => (
          <Box
            key={s.label}
            data-ai-analyzable="true"
            data-ai-description={`KYC Performance Stat: ${s.label} is currently ${s.value}. ${s.sub}`}
            sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.25 }}
          >
            <Typography sx={{
              fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.75
            }}>{s.label}</Typography>
            <Typography sx={{
              fontSize: '1.625rem', fontWeight: 700, color: '#0f172a',
              fontFamily: 'Jost', lineHeight: 1.1, mb: 0.5
            }}>
              {loading ? '—' : s.value.toLocaleString()}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{s.sub}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
        {/* Table header bar */}
        <Box sx={{
          px: 3, py: 2.25, borderBottom: '1px solid #eef0f4',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              KYC lookup history
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              OpenIV fetches KYC from your bank, cross-checks against PEP/sanctions, and issues an advisory
            </Typography>
          </Box>
        </Box>

        {/* Filter + search bar */}
        <Box sx={{
          px: 2, py: 1.5, borderBottom: '1px solid #eef0f4',
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap'
        }}>
          <Stack direction="row" gap={0.5}>
            {ADVISORY_FILTERS.map((f) => (
              <Box key={f} onClick={() => setFilter(f)} sx={{
                px: 1.375, py: 0.625, fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Jost',
                color: filter === f ? colorPalette.primary : '#64748b',
                bgcolor: filter === f ? `${colorPalette.primary}0a` : 'transparent',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: filter === f ? `${colorPalette.primary}0f` : '#f8fafc' },
              }}>{f}</Box>
            ))}
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f8fafc',
            px: 1.5, height: 32, minWidth: 260, border: '1px solid transparent',
            transition: 'all 0.18s', '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary }
          }}>
            <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
            <InputBase value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer reference…"
              sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a' }} />
          </Box>
        </Box>

        {/* Column headers */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '2fr 90px 130px 90px 90px 110px 150px',
          gap: 2, px: 3, py: 1.5, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4'
        }}>
          {['Customer ref', 'Tier', 'Advisory', 'Lookup', 'Duration', 'Source', 'Performed at'].map((h) => (
            <Typography key={h} sx={{
              fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.1em'
            }}>{h}</Typography>
          ))}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={26} sx={{ color: colorPalette.primary }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            {logs.length === 0 ? (
              <>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0f172a', mb: 0.75 }}>
                  No lookups yet
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  Configure your KYC lookup endpoint in the Integration tab, then run a manual lookup to get started.
                </Typography>
              </>
            ) : (
              <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                No results match the current filter.
              </Typography>
            )}
          </Box>
        ) : (
          filtered.map(({ log, advisory }, i) => (
            <Box
              key={log.id}
              data-ai-analyzable="true"
              data-ai-description={`KYC Audit Log for customer ${log.customerRef}. Advisory: ${advisory}. Bank status: ${log.kycStatus || 'N/A'}. Performed at: ${fmtTs(log.performedAt)}.`}
              sx={{
                display: 'grid',
                gridTemplateColumns: '2fr 90px 130px 90px 90px 110px 150px',
                gap: 2, px: 3, py: 1.625, alignItems: 'center',
                borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #f4f5f7',
                '&:hover': { bgcolor: '#fafbfc' },
              }}
            >
              <Box>
                <Typography sx={{
                  fontSize: '0.875rem', fontWeight: 600, color: '#0f172a',
                  fontFamily: 'SF Mono, Monaco, monospace',
                }}>
                  {log.customerRef}
                </Typography>
                {log.kycStatus && (
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25 }}>
                    Bank status: {log.kycStatus}
                  </Typography>
                )}
              </Box>
              <TierBars tier={log.kycTier} />
              <AdvisoryBadge advisory={advisory} />
              <LookupStatusBadge status={log.status} />
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                {log.durationMs != null ? `${log.durationMs}ms` : '—'}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                {TRIGGER_LABELS[log.triggerSource] ?? log.triggerSource}
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                {fmtTs(log.performedAt)}
              </Typography>
            </Box>
          ))
        )}
      </Box>
    </>
  )
}

// ── Integration view ──────────────────────────────────────────────────────────

const EXPECTED_FORMAT = `{
  "customerId": "CUS-22148273920",
  "ref": "22148273920",
  "tier": 3,
  "status": "verified",
  "bvn": "22148273920",
  "name": "Adamu Ibrahim",
  "dob": "1985-03-15",
  "nin": "12345678901",
  "address": "14 Broad Street, Lagos",
  "pepFlag": false,
  "verifiedAt": "2024-01-15T10:30:00Z"
}`

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Box sx={{ position: 'relative', bgcolor: '#0f172a' }}>
      <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
        <Tooltip title={copied ? 'Copied!' : 'Copy'} placement="left">
          <Box onClick={copy} sx={{
            cursor: 'pointer', color: copied ? '#10b981' : '#64748b',
            transition: 'color 0.15s', '&:hover': { color: '#94a3b8' }
          }}>
            <ContentCopyOutlinedIcon sx={{ fontSize: '0.875rem' }} />
          </Box>
        </Tooltip>
      </Box>
      <Typography component="pre" sx={{
        fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem',
        color: '#e2e8f0', m: 0, p: 2, whiteSpace: 'pre', overflowX: 'auto',
        lineHeight: 1.7,
      }}>
        {code}
      </Typography>
    </Box>
  )
}

function IntegrationView() {
  const navigate = useNavigate()

  const [config, setConfig] = useState<KycConfig | null>(null)
  const [logs, setLogs] = useState<KycLookupLog[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [lookupUrl, setLookupUrl] = useState('')
  const [lookupApiKey, setLookupApiKey] = useState('')
  const [lookupTimeout, setLookupTimeout] = useState('10')

  const [lookupRef, setLookupRef] = useState('')
  const [openCase, setOpenCase] = useState(false)
  const [lookupResult, setLookupResult] = useState<KycLookupResult | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      const data = await kycApi.getConfig()
      if (data.config) {
        setConfig(data.config)
        setLookupUrl(data.config.lookupUrl ?? '')
        setLookupTimeout(String(data.config.lookupTimeout))
      }
    } catch {
      setError('Failed to load KYC configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    try {
      const data = await kycApi.listLogs()
      setLogs(data.logs)
    } catch {
      // silent
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadLogs()
  }, [loadConfig, loadLogs])

  const handleSave = async () => {
    setSaveLoading(true)
    setSaveSuccess(false)
    setError(null)
    try {
      const payload: KycConfigInput = {
        lookupUrl: lookupUrl || null,
        lookupTimeout: parseInt(lookupTimeout) || 10,
      }
      if (lookupApiKey) payload.lookupApiKey = lookupApiKey
      const data = await kycApi.saveConfig(payload)
      setConfig(data.config)
      setSaveSuccess(true)
      setLookupApiKey('')
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save configuration')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleLookup = async () => {
    if (!lookupRef.trim()) return
    setLookupLoading(true)
    setLookupResult(null)
    setLookupError(null)
    try {
      const data = await kycApi.lookup(lookupRef.trim(), openCase)
      setLookupResult(data)
      loadLogs()
    } catch (e: any) {
      setLookupError(e?.message ?? 'Lookup failed')
    } finally {
      setLookupLoading(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} sx={{ color: colorPalette.primary }} />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5, alignItems: 'start' }}>

      {/* ── Left column ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 0 }}>{error}</Alert>}
        {saveSuccess && <Alert severity="success" sx={{ borderRadius: 0 }}>Configuration saved.</Alert>}

        {/* Lookup endpoint config */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 32, height: 32, bgcolor: `${colorPalette.primary}0f`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <LinkOutlinedIcon sx={{ fontSize: '1rem', color: colorPalette.primary }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                KYC Lookup Endpoint
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                OpenIV calls <code style={{ fontSize: '0.6875rem' }}>GET &#123;url&#125;/&#123;ref&#125;</code> when it needs to assess a customer
              </Typography>
            </Box>
          </Box>
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 0.75 }}>
                Lookup URL
              </Typography>
              <TextField fullWidth size="small" value={lookupUrl}
                onChange={(e) => setLookupUrl(e.target.value)}
                placeholder="https://api.yourbank.com/kyc/customers"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, fontFamily: 'Jost', fontSize: '0.875rem' } }} />
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>
                OpenIV appends the customer reference — e.g. <code style={{ fontSize: '0.6875rem' }}>/22148273920</code>
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 0.75 }}>
                Authorization Key
                {config?.hasLookupApiKey && (
                  <Box component="span" sx={{
                    ml: 1, px: 0.75, py: 0.25, bgcolor: '#f0fdf4', color: '#10b981',
                    fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', verticalAlign: 'middle'
                  }}>
                    CONFIGURED
                  </Box>
                )}
              </Typography>
              <TextField fullWidth size="small" type="password" value={lookupApiKey}
                onChange={(e) => setLookupApiKey(e.target.value)}
                placeholder={config?.hasLookupApiKey
                  ? '••••••••  (leave blank to keep current)'
                  : 'Sent as Authorization: Bearer <key> on every request'}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, fontFamily: 'Jost', fontSize: '0.875rem' } }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 0.75 }}>
                Timeout (seconds)
              </Typography>
              <TextField size="small" type="number" value={lookupTimeout}
                onChange={(e) => setLookupTimeout(e.target.value)}
                inputProps={{ min: 1, max: 60 }}
                sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: 0, fontFamily: 'Jost', fontSize: '0.875rem' } }} />
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleSave} disabled={saveLoading}
            sx={{
              bgcolor: colorPalette.primary, color: '#ffffff', px: 3, py: 1.125,
              fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0,
              textTransform: 'none', boxShadow: 'none', minWidth: 150,
              '&:hover': { bgcolor: '#1a3896' }, '&:disabled': { bgcolor: '#94a3b8' }
            }}>
            {saveLoading
              ? <CircularProgress size={16} sx={{ color: '#ffffff' }} />
              : 'Save Configuration'}
          </Button>
        </Box>

        {/* Expected response format */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4' }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              Expected Response Format
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              Your endpoint should return a JSON object with these fields. Only <code style={{ fontSize: '0.6875rem' }}>tier</code> and <code style={{ fontSize: '0.6875rem' }}>status</code> are required.
            </Typography>
          </Box>
          <CodeBlock code={EXPECTED_FORMAT} />
          <Box sx={{ px: 3, py: 2, borderTop: '1px solid #eef0f4', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { field: 'customerId', type: 'string', required: true, note: 'Your internal customer identifier — echoed back in every lookup response' },
              { field: 'tier', type: 'number', required: true, note: '1 · 2 · 3 — CBN tier level' },
              { field: 'status', type: 'string', required: true, note: '"verified" · "pending" · "suspended"' },
              { field: 'pepFlag', type: 'boolean', required: false, note: 'Set true if customer is a politically exposed person' },
              { field: 'bvn / nin', type: 'string', required: false, note: 'Included in PEP cross-reference lookup' },
              { field: 'verifiedAt', type: 'string', required: false, note: 'ISO 8601 — used to detect stale KYC' },
            ].map((row) => (
              <Box key={row.field} sx={{ display: 'grid', gridTemplateColumns: '100px 60px 40px 1fr', gap: 1.5, alignItems: 'center' }}>
                <Typography sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: '#0f172a' }}>
                  {row.field}
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'Jost' }}>
                  {row.type}
                </Typography>
                <Box sx={{
                  px: 0.625, py: 0.25,
                  bgcolor: row.required ? '#fef2f2' : '#f1f5f9',
                  color: row.required ? '#dc2626' : '#64748b',
                  fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center'
                }}>
                  {row.required ? 'REQ' : 'OPT'}
                </Box>
                <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{row.note}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Right column ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

        {/* Manual lookup */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4' }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              Manual Lookup
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              Trigger a one-off lookup — OpenIV fetches the customer's KYC and returns an advisory
            </Typography>
          </Box>
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField fullWidth size="small" value={lookupRef}
                onChange={(e) => setLookupRef(e.target.value)}
                placeholder="BVN, NIN, account number, or customer ID"
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, fontFamily: 'Jost', fontSize: '0.875rem' } }} />
              <Button onClick={handleLookup} disabled={lookupLoading || !lookupRef.trim()}
                sx={{
                  bgcolor: colorPalette.primary, color: '#ffffff', px: 2.5, minWidth: 80,
                  fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0,
                  textTransform: 'none', boxShadow: 'none', flexShrink: 0, height: 14,
                  '&:hover': { bgcolor: '#1a3896' }, '&:disabled': { bgcolor: '#94a3b8' }
                }}>
                {lookupLoading ? <CircularProgress size={16} sx={{ color: '#ffffff' }} /> : 'Lookup'}
              </Button>
            </Box>

            {/* Open case toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: -0.5 }}>
              <Checkbox
                size="small"
                checked={openCase}
                onChange={(e) => setOpenCase(e.target.checked)}
                sx={{ p: 0, color: '#cbd5e1', '&.Mui-checked': { color: colorPalette.primary } }}
              />
              <Typography sx={{
                fontSize: '0.8125rem', color: '#475569', fontFamily: 'Jost', cursor: 'pointer',
                userSelect: 'none'
              }} onClick={() => setOpenCase(v => !v)}>
                Open a KYC review case for this customer
              </Typography>
            </Box>

            {lookupError && (
              <Alert severity="error" sx={{ borderRadius: 0, fontSize: '0.8125rem' }}>{lookupError}</Alert>
            )}
            {lookupResult && (
              <>
                {/* Customer ID */}
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 1.75, py: 1.25, bgcolor: '#f8fafc', border: '1px solid #eef0f4'
                }}>
                  <Typography sx={{
                    fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
                    textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0
                  }}>
                    Customer ID
                  </Typography>
                  <Typography sx={{
                    fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.8125rem',
                    fontWeight: 600, color: '#0f172a'
                  }}>
                    {lookupResult.customerId}
                  </Typography>
                </Box>

                {/* Advisory */}
                {(() => {
                  const tier = typeof lookupResult.kyc.tier === 'number' ? lookupResult.kyc.tier : null
                  const status = typeof lookupResult.kyc.status === 'string' ? lookupResult.kyc.status : ''
                  const synthLog = { status: 'success', kycTier: tier, kycStatus: status } as KycLookupLog
                  const adv = getAdvisory(synthLog)
                  const cfg = ADVISORY_CFG[adv]
                  return (
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1.5, bgcolor: cfg.bg, border: `1px solid ${cfg.color}22`
                    }}>
                      <ShieldOutlinedIcon sx={{ fontSize: '1.125rem', color: cfg.color }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: cfg.color, fontFamily: 'Jost' }}>
                          Advisory: {cfg.label}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {cfg.description}
                        </Typography>
                      </Box>
                    </Box>
                  )
                })()}

                {/* Case opened banner */}
                {lookupResult.case && (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: 1.75, py: 1.25, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <FolderOpenOutlinedIcon sx={{ fontSize: '1.125rem', color: '#10b981' }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#065f46', fontFamily: 'Jost' }}>
                          Case opened — {lookupResult.case.id}
                        </Typography>
                        <Typography sx={{ fontSize: '0.6875rem', color: '#047857' }}>
                          Priority: {lookupResult.case.priority} · Risk score: {lookupResult.case.riskScore}
                        </Typography>
                      </Box>
                    </Box>
                    <Button onClick={() => navigate('/dashboard/aml')}
                      sx={{
                        fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', color: '#065f46',
                        bgcolor: 'transparent', border: '1px solid #86efac', borderRadius: 0,
                        textTransform: 'none', px: 1.5, py: 0.5, flexShrink: 0,
                        '&:hover': { bgcolor: '#dcfce7' }
                      }}>
                      View in AML
                    </Button>
                  </Box>
                )}

                {/* KYC raw response */}
                <Box sx={{ bgcolor: '#0f172a' }}>
                  <Typography component="pre" sx={{
                    fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem',
                    color: '#e2e8f0', m: 0, p: 1.75, whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word', maxHeight: 220, overflowY: 'auto', lineHeight: 1.6,
                  }}>
                    {JSON.stringify(lookupResult.kyc, null, 2)}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </Box>

        {/* Lookup log */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4' }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              Lookup Log
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              All KYC lookups OpenIV has performed for your institution
            </Typography>
          </Box>

          {logsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={22} sx={{ color: colorPalette.primary }} />
            </Box>
          ) : logs.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                No lookups yet — configure the lookup URL above and run a test.
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{
                display: 'grid', gridTemplateColumns: '1fr 80px 100px 70px 140px',
                gap: 1.5, px: 2.5, py: 1.25, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4'
              }}>
                {['Customer ref', 'Status', 'Advisory', 'Duration', 'Time'].map((h) => (
                  <Typography key={h} sx={{
                    fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8',
                    textTransform: 'uppercase', letterSpacing: '0.1em'
                  }}>{h}</Typography>
                ))}
              </Box>
              {logs.slice(0, 50).map((l, i) => (
                <Box key={l.id} sx={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 100px 70px 140px',
                  gap: 1.5, px: 2.5, py: 1.125, alignItems: 'center',
                  borderBottom: i === Math.min(logs.length, 50) - 1 ? 'none' : '1px solid #f4f5f7',
                }}>
                  <Typography sx={{
                    fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem',
                    color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {l.customerRef}
                  </Typography>
                  <LookupStatusBadge status={l.status} />
                  <AdvisoryBadge advisory={getAdvisory(l)} />
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    {l.durationMs != null ? `${l.durationMs}ms` : '—'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                    {fmtTs(l.performedAt)}
                  </Typography>
                </Box>
              ))}
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type PageView = 'customers' | 'integration'

export default function KYCPage() {
  const [view, setView] = useState<PageView>('customers')

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography sx={{
            fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary,
            letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75
          }}>
            Customer Due Diligence
          </Typography>
          <Typography sx={{
            fontSize: '1.625rem', fontWeight: 700, color: '#0f172a',
            fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5
          }}>
            KYC
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Pull customer KYC from your bank, cross-check against PEP/sanctions lists, and receive a compliance advisory
          </Typography>
        </Box>

        {/* Tab switcher */}
        <Box sx={{ display: 'flex', mb: 3, borderBottom: '1px solid #eef0f4' }}>
          {(['customers', 'integration'] as PageView[]).map((v) => {
            const label = v === 'customers' ? 'Customers' : 'Integration'
            const active = view === v
            return (
              <Box key={v} onClick={() => setView(v)} sx={{
                px: 2.5, py: 1.5, cursor: 'pointer', position: 'relative',
                fontSize: '0.875rem', fontWeight: active ? 700 : 500,
                fontFamily: 'Jost', color: active ? colorPalette.primary : '#64748b',
                transition: 'color 0.15s', '&:hover': { color: colorPalette.primary },
                '&::after': active ? {
                  content: '""', position: 'absolute', bottom: -1, left: 0, right: 0,
                  height: '2px', bgcolor: colorPalette.primary,
                } : {},
              }}>{label}</Box>
            )
          })}
        </Box>

        {view === 'customers' ? <CustomersView /> : <IntegrationView />}
      </Box>
    </DashboardLayout>
  )
}
