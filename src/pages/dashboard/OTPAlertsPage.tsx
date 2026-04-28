import { Box, Typography, Stack, Button, Chip } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { useState, useEffect, useRef } from 'react'
import { useDashboardEvents, type OtpAlertItem } from '@/contexts/DashboardEventsContext'
import { otpAlertsApi } from '@/api/otpAlerts'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import WifiTetheringRoundedIcon from '@mui/icons-material/WifiTetheringRounded'
import WifiTetheringOffRoundedIcon from '@mui/icons-material/WifiTetheringOffRounded'

// ── TTL countdown ─────────────────────────────────────────────────────────────

function useTtlSeconds(expiresAt: string | null): number {
  const [ttl, setTtl] = useState(() => calcTtl(expiresAt))
  useEffect(() => {
    const id = setInterval(() => setTtl(calcTtl(expiresAt)), 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return ttl
}

function calcTtl(expiresAt: string | null): number {
  if (!expiresAt) return 0
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── Alert row (renders its own TTL countdown) ─────────────────────────────────

function AlertRow({ alert, selected, onClick }: {
  alert: OtpAlertItem
  selected: boolean
  onClick: () => void
}) {
  const ttl = useTtlSeconds(alert.expiresAt)
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 2.5, py: 2, cursor: 'pointer',
        bgcolor: selected ? `${colorPalette.primary}06` : 'transparent',
        borderLeft: selected ? `3px solid ${colorPalette.primary}` : '3px solid transparent',
        transition: 'all 0.15s',
        '&:hover': { bgcolor: selected ? `${colorPalette.primary}0a` : '#fafbfc' },
        borderBottom: '1px solid #f4f5f7',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
        <Box>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
            {alert.customerName ?? alert.customerId ?? 'Unknown customer'}
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'SF Mono, Monaco, monospace' }}>
            {ruleLabel(alert.rule)}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          {alert.amount != null && (
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
              ₦{(alert.amount / 1_000_000).toFixed(1)}M
            </Typography>
          )}
          {alert.status === 'pending' && ttl > 0 && (
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: ttl < 120 ? '#dc2626' : '#f59e0b' }}>
              {formatTime(ttl)}
            </Typography>
          )}
        </Box>
      </Box>
      <Stack direction="row" gap={0.75} alignItems="center">
        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: severityColor(alert.severity, alert.riskScore) }} />
        <Typography sx={{ fontSize: '0.6875rem', color: '#475569', fontWeight: 600 }}>
          Risk {alert.riskScore}
          {alert.distanceKm != null ? ` · ${alert.distanceKm} km gap` : ''}
        </Typography>
        <StatusChip status={alert.status} />
      </Stack>
    </Box>
  )
}

function StatusChip({ status }: { status: OtpAlertItem['status'] }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: '#fef2f2', color: '#dc2626', label: 'Pending' },
    held:     { bg: '#fff7ed', color: '#ea580c', label: 'Held' },
    released: { bg: '#f0fdf4', color: '#16a34a', label: 'Released' },
    declined: { bg: '#f8fafc', color: '#475569', label: 'Declined' },
  }
  const c = cfg[status] ?? cfg.pending
  return (
    <Box sx={{ ml: 'auto', px: 0.75, py: 0.25, bgcolor: c.bg }}>
      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: c.color, letterSpacing: '0.08em' }}>
        {c.label.toUpperCase()}
      </Typography>
    </Box>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ruleLabel(rule: OtpAlertItem['rule']): string {
  const labels = {
    FAILED_CASCADE:        'Failed cascade',
    OTP_BOMBING:           'OTP bombing',
    VELOCITY_SPIKE:        'Velocity spike',
    NEW_DEVICE_SUSPICIOUS: 'New device',
  }
  return labels[rule] ?? rule
}

function severityColor(severity: string, score: number): string {
  if (score >= 90) return '#dc2626'
  if (score >= 70) return '#f59e0b'
  return colorPalette.primary
}

function eurekaSummary(alert: OtpAlertItem): string {
  switch (alert.rule) {
    case 'FAILED_CASCADE':
      return `Pattern matches ${alert.eventCount} OTP failures — consistent with SIM-swap precursor activity. Call the customer on their BVN-registered number, NOT the device originating this OTP.`
    case 'OTP_BOMBING':
      return `${alert.eventCount} OTP requests detected — possible automated bombing attack. Recommend locking the account temporarily and verifying the customer's identity before re-enabling OTP.`
    case 'VELOCITY_SPIKE':
      return `Institution-wide failure rate spike detected. This may indicate a coordinated attack across multiple customers. Review the top failing customers and consider a temporary OTP cooldown.`
    case 'NEW_DEVICE_SUSPICIOUS':
      return `Never-before-seen device for this customer. Combined with any geo anomaly, this is a strong SIM-swap indicator. Verify via voice call on the customer's registered MSISDN.`
  }
}

// ── Detail panel TTL banner (needs its own hook call) ────────────────────────

function DetailTtlBanner({ alert }: { alert: OtpAlertItem }) {
  const ttl = useTtlSeconds(alert.expiresAt)
  if (alert.status !== 'pending' && alert.status !== 'held') return null
  return (
    <Box sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ width: 44, height: 44, bgcolor: '#dc2626', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <LockOutlinedIcon />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.25 }}>
          Transaction held — call customer to verify
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: '#7f1d1d' }}>
          {ttl > 0
            ? <>Auto-decline in <strong>{formatTime(ttl)}</strong> if no action. Customer will be SMS'd if unreachable.</>
            : 'Hold window expired — transaction auto-declined.'}
        </Typography>
      </Box>
      <Button
        startIcon={<PhoneInTalkRoundedIcon sx={{ fontSize: '1rem !important' }} />}
        sx={{ bgcolor: '#dc2626', color: '#ffffff', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#b91c1c' }, flexShrink: 0 }}
      >
        Call Customer
      </Button>
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OTPAlertsPage() {
  const { otpAlerts, connected } = useDashboardEvents()
  // Local status overrides (optimistic updates while server confirms)
  const [statusOverrides, setStatusOverrides] = useState<Record<number, OtpAlertItem['status']>>({})
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [pendingAction, setPendingAction] = useState<{ id: number; status: 'released' | 'declined' } | null>(null)

  // Select the first pending alert by default
  const prevAlertsLen = useRef(0)
  useEffect(() => {
    if (otpAlerts.length > 0 && (selectedId === null || prevAlertsLen.current === 0)) {
      const first = otpAlerts.find(a => (statusOverrides[a.id] ?? a.status) === 'pending') ?? otpAlerts[0]
      setSelectedId(first.id)
    }
    prevAlertsLen.current = otpAlerts.length
  }, [otpAlerts, selectedId, statusOverrides])

  const alertsWithStatus = otpAlerts.map(a =>
    statusOverrides[a.id] ? { ...a, status: statusOverrides[a.id] } : a
  )
  const pending  = alertsWithStatus.filter(a => a.status === 'pending' || a.status === 'held')
  const selected = alertsWithStatus.find(a => a.id === selectedId) ?? alertsWithStatus[0] ?? null

  const doAction = async (id: number, status: 'released' | 'declined') => {
    setStatusOverrides(p => ({ ...p, [id]: status }))
    try {
      await otpAlertsApi.updateStatus(id, status)
    } catch {
      // revert on failure
      setStatusOverrides(p => { const n = { ...p }; delete n[id]; return n })
    }
    setPendingAction(null)
  }

  const pendingCount = pending.length
  const heldToday    = alertsWithStatus.filter(a => a.status !== 'pending').length
  const confirmedFraud = alertsWithStatus.filter(a => a.status === 'declined').length
  const releaseRate  = heldToday > 0
    ? Math.round((alertsWithStatus.filter(a => a.status === 'released').length / heldToday) * 100)
    : 0

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: connected ? '#dc2626' : '#94a3b8',
                animation: connected ? 'pulse 1.5s infinite' : 'none',
                '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: connected ? '#dc2626' : '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {connected ? 'Live OTP Defense' : 'Connecting…'}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Real-time OTP Alerts
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              Suspicious OTPs that withhold transactions until your team verifies the customer by call
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, px: 1.5, py: 0.875, border: '1px solid #eef0f4', bgcolor: '#ffffff' }}>
            {connected
              ? <WifiTetheringRoundedIcon sx={{ fontSize: '1rem', color: '#10b981' }} />
              : <WifiTetheringOffRoundedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />}
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: connected ? '#10b981' : '#94a3b8', fontFamily: 'Jost' }}>
              {connected ? 'SSE Live' : 'Offline'}
            </Typography>
          </Box>
        </Box>

        {/* KPI strip */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Active holds',            value: String(pendingCount),   color: '#dc2626' },
            { label: 'Actioned today',           value: String(heldToday),      color: '#f59e0b' },
            { label: 'Confirmed fraud',          value: String(confirmedFraud), color: colorPalette.primary },
            { label: 'Customer release rate',    value: `${releaseRate}%`,      color: '#10b981' },
          ].map(s => (
            <Box key={s.label} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mb: 0.625 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.color }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {s.label}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                {s.value}
              </Typography>
            </Box>
          ))}
        </Box>

        {alertsWithStatus.length === 0 ? (
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 6, textAlign: 'center' }}>
            <LockOpenOutlinedIcon sx={{ fontSize: '2.5rem', color: '#94a3b8', mb: 1.5 }} />
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#475569', fontFamily: 'Jost', mb: 0.5 }}>
              No OTP alerts
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
              {connected ? 'All clear — no suspicious OTP patterns detected.' : 'Connecting to live stream…'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '380px 1fr' }, gap: 3 }}>
            {/* Alert queue */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', alignSelf: 'start' }}>
              <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Alert queue</Typography>
                <Chip label={`${pendingCount} pending`} size="small" sx={{ bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '0.625rem', letterSpacing: '0.08em', borderRadius: 0, height: 20 }} />
              </Box>
              {alertsWithStatus.map(a => (
                <AlertRow key={a.id} alert={a} selected={a.id === selectedId} onClick={() => setSelectedId(a.id)} />
              ))}
            </Box>

            {/* Detail */}
            {selected && (
              <Stack gap={3}>
                <DetailTtlBanner alert={selected} />

                {/* Location mismatch */}
                {(selected.txnLat != null || selected.distanceKm != null) && (
                  <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                    <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Location mismatch</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                        Where the customer usually transacts vs where this OTP was triggered
                      </Typography>
                    </Box>
                    <Box sx={{ p: 3 }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 3, alignItems: 'center' }}>
                        <Box sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 1 }}>
                            <LocationOnOutlinedIcon sx={{ fontSize: '1rem', color: '#10b981' }} />
                            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Usual location</Typography>
                          </Box>
                          {selected.customerLat != null
                            ? <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#0f172a' }}>{selected.customerLat.toFixed(4)}°N, {selected.customerLng?.toFixed(4)}°E</Typography>
                            : <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No history</Typography>}
                        </Box>
                        <Box sx={{ textAlign: 'center', px: 2 }}>
                          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>Gap</Typography>
                          <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#dc2626', fontFamily: 'Jost', lineHeight: 1 }}>
                            {selected.distanceKm ?? '—'}
                          </Typography>
                          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#dc2626', letterSpacing: '0.1em' }}>KM</Typography>
                        </Box>
                        <Box sx={{ p: 2, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 1 }}>
                            <LocationOnOutlinedIcon sx={{ fontSize: '1rem', color: '#dc2626' }} />
                            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.1em' }}>OTP triggered from</Typography>
                          </Box>
                          {selected.txnLat != null
                            ? <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#0f172a' }}>{selected.txnLat.toFixed(4)}°N, {selected.txnLng?.toFixed(4)}°E</Typography>
                            : <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No coordinates</Typography>}
                          {selected.ip && <Typography sx={{ fontSize: '0.75rem', color: '#475569', mt: 0.375 }}>IP: {selected.ip}</Typography>}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Transaction details + reasons */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                  <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5 }}>
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 2 }}>Transaction details</Typography>
                    <Stack gap={0}>
                      {[
                        ['Customer',      selected.customerName ?? selected.customerId ?? '—'],
                        ['Phone',         selected.msisdn ?? '—'],
                        ['Amount',        selected.amount != null ? `₦${selected.amount.toLocaleString()}` : '—'],
                        ['Beneficiary',   selected.beneficiaryAccount ?? '—'],
                        ['Device',        selected.deviceModel ?? selected.deviceId ?? '—'],
                        ['Channel',       selected.channel ?? '—'],
                        ['OTP type',      selected.otpType ?? '—'],
                        ['Alert fired',   new Date(selected.firedAt).toLocaleTimeString()],
                      ].map(([label, value]) => (
                        <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.875, borderBottom: '1px solid #f4f5f7', '&:last-child': { borderBottom: 'none' } }}>
                          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{label}</Typography>
                          <Typography sx={{ fontSize: '0.8125rem', color: '#0f172a', fontWeight: 600, fontFamily: 'Jost' }}>{value}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>

                  <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Why this was flagged</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: severityColor(selected.severity, selected.riskScore), fontFamily: 'Jost', lineHeight: 1 }}>
                          {selected.riskScore}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>/100</Typography>
                      </Box>
                    </Box>
                    <Stack gap={0}>
                      {(selected.reasons.length > 0 ? selected.reasons : [selected.detail]).map((r, i) => (
                        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', py: 0.875, borderBottom: i === (selected.reasons.length || 1) - 1 ? 'none' : '1px solid #f4f5f7' }}>
                          <Box sx={{ width: 16, height: 16, bgcolor: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.125 }}>
                            <Typography sx={{ fontSize: '0.625rem', color: '#ffffff', fontWeight: 700 }}>{i + 1}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>{r}</Typography>
                        </Box>
                      ))}
                    </Stack>
                    <Box sx={{ mt: 2, bgcolor: `${colorPalette.primary}06`, border: `1px solid ${colorPalette.primary}15`, p: 1.5, display: 'flex', gap: 1 }}>
                      <AutoAwesomeOutlinedIcon sx={{ fontSize: '0.9375rem', color: colorPalette.primary, mt: 0.125, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.55 }}>
                        <strong style={{ color: colorPalette.primary }}>Eureka:</strong>{' '}
                        {eurekaSummary(selected)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Action bar */}
                {(selected.status === 'pending' || selected.status === 'held') && (
                  <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5, display: 'flex', gap: 1.5 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>Verification result</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Once you've spoken with the customer on their registered line, choose an outcome below.
                      </Typography>
                    </Box>
                    <Stack direction="row" gap={1}>
                      <Button startIcon={<SmsOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
                        sx={{ bgcolor: '#ffffff', color: '#475569', border: '1px solid #e5e7eb', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#f8fafc' } }}>
                        SMS Customer
                      </Button>
                      <Button startIcon={<CloseRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                        onClick={() => setPendingAction({ id: selected.id, status: 'declined' })}
                        sx={{ bgcolor: '#fef2f2', color: '#dc2626', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#fee2e2' } }}>
                        Decline & File STR
                      </Button>
                      <Button startIcon={<LockOpenOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
                        onClick={() => setPendingAction({ id: selected.id, status: 'released' })}
                        sx={{ bgcolor: colorPalette.primary, color: '#ffffff', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#1a3896' } }}>
                        Release Transaction
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}
          </Box>
        )}
      </Box>

      <TOTPConfirmation
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={() => pendingAction && doAction(pendingAction.id, pendingAction.status)}
        operation={pendingAction?.status === 'released' ? 'update' : 'delete'}
        title={pendingAction?.status === 'released' ? 'Release held transaction' : 'Decline & file STR'}
        description={
          pendingAction?.status === 'released'
            ? 'Releasing this transaction sends the funds immediately. You confirm you have spoken with the customer on their registered MSISDN.'
            : 'Declining this transaction will refund the customer and auto-file an NFIU Suspicious Transaction Report. Funds remain frozen pending NFIU review.'
        }
        resourceType={pendingAction?.status === 'released' ? 'Transaction' : 'STR filing'}
        resourceName={selected
          ? `Alert #${selected.id} · ${selected.customerName ?? selected.customerId ?? '—'}${selected.amount != null ? ` · ₦${selected.amount.toLocaleString()}` : ''}`
          : ''}
        changes={pendingAction?.status === 'released'
          ? [{ field: 'Status', from: 'Held', to: 'Released' }]
          : undefined}
        itemsAffected={pendingAction?.status === 'declined'
          ? [`Alert #${selected?.id} declined`, 'STR filed to NFIU (auto-generated)', `Customer ${selected?.customerName ?? selected?.customerId ?? ''} notified by SMS`]
          : undefined}
      />
    </DashboardLayout>
  )
}
