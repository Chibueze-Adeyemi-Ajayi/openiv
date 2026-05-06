import {
  Box, Typography, Stack, InputBase,
  CircularProgress, Tooltip, Button, Tabs, Tab,
} from '@mui/material'
import { colorPalette } from '@/theme'
// import { colorPalette } from '@/theme'
import { useState, useEffect } from 'react'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import { useNavigate } from 'react-router-dom'
import { kycApi, type KycLookupLog, type KycConfig } from '@/api/kyc'

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
                  Configure your KYC webhook endpoint in Webhooks → KYC Data Source, then run a manual lookup to get started.
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

function IntegrationView() {
  const [config, setConfig] = useState<KycConfig | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    kycApi.getConfig()
      .then(r => setConfig(r.config))
      .catch(() => { })
  }, [])

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ bgcolor: '#fff8f0', border: '1px solid #fed7aa', p: 2.5, mb: 3 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#c2410c', mb: 0.5 }}>
          Customer database integration
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: '#475569', mb: 1.5 }}>
          Connect your customer database endpoint under Webhooks → KYC Data Source
          to enable automatic verification during fraud investigations.
        </Typography>
        <Button
          variant="outlined" size="small"
          onClick={() => navigate('/dashboard/webhooks')}
          sx={{
            borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontSize: '0.8125rem',
            borderColor: '#c2410c', color: '#c2410c', '&:hover': { bgcolor: '#fff8f0' }
          }}
        >
          Configure in Webhooks →
        </Button>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, border: '1px solid #eef0f4', bgcolor: '#fff' }}>
        {config?.lookupUrl
          ? <>
            <CheckCircleOutlineRoundedIcon sx={{ color: '#10b981' }} />
            <Box>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Customer database connected</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>{config.lookupUrl}</Typography>
            </Box>
          </>
          : <>
            <CancelOutlinedIcon sx={{ color: '#94a3b8' }} />
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>No customer database connected</Typography>
          </>
        }
      </Box>
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KYCPage() {
  const [tabValue, setTabValue] = useState(0)

  return (
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
          Connect your customer database to verify customer identity during fraud investigations and maintain compliance
        </Typography>
      </Box>

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
        <Tab label="Lookup History" />
        <Tab label="Webhook Integration" />
      </Tabs>

      {tabValue === 0 && <CustomersView />}
      {tabValue === 1 && <IntegrationView />}
    </Box>
  )
}
