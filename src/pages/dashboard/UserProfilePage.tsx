import { Box, Typography, Stack, Button, Chip } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SmartphoneOutlinedIcon from '@mui/icons-material/SmartphoneOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hours = Array.from({ length: 24 }, (_, i) => i)

// Per-user heatmap data — Adamu Ibrahim's 90-day activity pattern
function genUserHeatmap(seed: number) {
  const grid: number[][] = []
  for (let d = 0; d < 7; d++) {
    grid[d] = []
    for (let h = 0; h < 24; h++) {
      // Personal: works 9-5 weekdays, occasionally weekend morning
      const businessFactor = h >= 9 && h <= 17 && d > 0 && d < 6 ? 1 : 0
      const lunch = h >= 12 && h <= 13 && d > 0 && d < 6 ? 0.4 : 0
      const morningCheck = h >= 7 && h <= 8 ? 0.3 : 0
      const noise = Math.sin(seed * (d + 1) * (h + 1) * 0.7) * 0.2 + 0.3
      const anomaly = (d === 2 && h === 3) || (d === 6 && h === 1) ? 0.95 : 0
      grid[d][h] = Math.max(0, Math.min(1, businessFactor * 0.7 + lunch + morningCheck + noise * 0.2 + anomaly))
    }
  }
  return grid
}

const userHeatmap = genUserHeatmap(7.2)

const colorScale = (v: number) => {
  if (v < 0.05) return '#f4f5f7'
  const opacity = Math.max(0.1, Math.min(1, v))
  return `rgba(30, 64, 175, ${opacity})`
}

export default function UserProfilePage() {
  const [freezeOpen, setFreezeOpen] = useState(false)
  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        {/* Breadcrumb */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Link to="/dashboard/kyc" style={{ textDecoration: 'none' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', transition: 'color 0.15s', '&:hover': { color: colorPalette.primary } }}>
              <ArrowBackRoundedIcon sx={{ fontSize: '1rem' }} />
              Back to KYC
            </Box>
          </Link>
        </Box>

        {/* Header card */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3, p: 3, display: 'flex', alignItems: 'flex-start', gap: 3 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: colorPalette.primary,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              fontWeight: 700,
              fontFamily: 'Jost',
              flexShrink: 0,
            }}
          >
            AI
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em' }}>
                Adamu Ibrahim
              </Typography>
              <Chip
                icon={<VerifiedOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                label="TIER 3 VERIFIED"
                size="small"
                sx={{
                  bgcolor: '#f0fdf4',
                  color: '#10b981',
                  fontWeight: 700,
                  fontSize: '0.625rem',
                  letterSpacing: '0.1em',
                  borderRadius: 0,
                  height: 22,
                  '& .MuiChip-icon': { color: '#10b981', ml: 0.875 },
                }}
              />
              <Chip
                label="HIGH RISK"
                size="small"
                sx={{
                  bgcolor: '#fef2f2',
                  color: '#dc2626',
                  fontWeight: 700,
                  fontSize: '0.625rem',
                  letterSpacing: '0.1em',
                  borderRadius: 0,
                  height: 22,
                }}
              />
            </Box>
            <Stack direction="row" gap={3}>
              {[
                { label: 'BVN', value: '22148273920' },
                { label: 'Account', value: 'ACC-1729' },
                { label: 'Customer since', value: 'Mar 2021' },
                { label: 'Home location', value: 'Sokoto, Sokoto' },
              ].map((d) => (
                <Box key={d.label}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
                    {d.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: d.label === 'BVN' || d.label === 'Account' ? 'SF Mono, Monaco, monospace' : 'Jost' }}>
                    {d.value}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Stack direction="row" gap={1}>
            <Button
              startIcon={<PhoneInTalkRoundedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                bgcolor: '#ffffff',
                color: '#475569',
                border: '1px solid #e5e7eb',
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: '#f8fafc' },
              }}
            >
              Call Customer
            </Button>
            <Button
              onClick={() => setFreezeOpen(true)}
              startIcon={<LockOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                bgcolor: '#dc2626',
                color: '#ffffff',
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#b91c1c' },
              }}
            >
              Freeze Account
            </Button>
          </Stack>
        </Box>

        {/* Risk + Eureka strip */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 3, mb: 3 }}>
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1 }}>
              Live Risk Score
            </Typography>
            <Typography sx={{ fontSize: '3.5rem', fontWeight: 700, color: '#dc2626', fontFamily: 'Jost', lineHeight: 1, mb: 1 }}>
              92
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 1 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}>↑ +28 in 24h</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.55 }}>
              Recalculated 2 sec ago · driven by 3 new behavioral signals today
            </Typography>
          </Box>

          <Box sx={{ bgcolor: colorPalette.primary, color: '#ffffff', p: 3, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
              <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.125rem' }} />
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Eureka's read
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.55, mb: 1.5, fontFamily: 'Jost', maxWidth: '88%' }}>
              Adamu's behavioral pattern broke this morning. He's transacting 1,098 km from his usual location, on a new device, at a time-of-day he's never been active in 36 months of history.
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', opacity: 0.9, lineHeight: 1.55, maxWidth: '88%' }}>
              Three independent signals stack up. Suggested: hold all transactions until verified by a phone call to his registered MSISDN — not the device originating the OTP.
            </Typography>
          </Box>
        </Box>

        {/* Personal Heatmap */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3 }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Adamu's behavioral fingerprint
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                When this customer is normally active · 90-day pattern
              </Typography>
            </Box>
            <Stack direction="row" gap={1.25} alignItems="center">
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8' }}>Less</Typography>
              <Stack direction="row" gap={0.25}>
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                  <Box key={v} sx={{ width: 12, height: 12, bgcolor: colorScale(v) }} />
                ))}
              </Stack>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8' }}>More</Typography>
            </Stack>
          </Box>
          <Box sx={{ p: 3, overflowX: 'auto' }}>
            <Box sx={{ minWidth: '100%', position: 'relative' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 0.375, mb: 0.5 }}>
                <Box />
                {hours.map((h) => (
                  <Typography key={h} sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', textAlign: 'center' }}>
                    {h % 3 === 0 ? `${h}` : ''}
                  </Typography>
                ))}
              </Box>
              {days.map((d, di) => (
                <Box key={d} sx={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 0.375, mb: 0.375 }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center' }}>
                    {d}
                  </Typography>
                  {hours.map((h) => {
                    const v = userHeatmap[di][h]
                    const isAnomaly = (di === 2 && h === 3) || (di === 6 && h === 1)
                    return (
                      <Box
                        key={h}
                        sx={{
                          aspectRatio: '1',
                          bgcolor: isAnomaly ? '#dc2626' : colorScale(v),
                          border: isAnomaly ? '1px solid #ffffff' : 'none',
                          position: 'relative',
                          ...(isAnomaly && {
                            '&::after': {
                              content: '""',
                              position: 'absolute',
                              inset: -2,
                              border: '1px solid #dc2626',
                              animation: 'pulseDot 2s infinite',
                            },
                            '@keyframes pulseDot': {
                              '0%,100%': { opacity: 0.6 },
                              '50%': { opacity: 0 },
                            },
                          }),
                        }}
                      />
                    )
                  })}
                </Box>
              ))}
            </Box>

            {/* Anomaly callout */}
            <Box sx={{ mt: 3, bgcolor: '#fef2f2', border: '1px solid #fecaca', p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <FlagOutlinedIcon sx={{ fontSize: '1.125rem', color: '#dc2626', mt: 0.25, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>
                  2 cells outside this customer's pattern
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#7f1d1d', lineHeight: 1.55 }}>
                  Tuesday 03:00 and Saturday 01:00 — Adamu has <strong>never</strong> transacted at these times in 36 months. Both events are tied to the new device fingerprint detected today.
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Recent activity timeline */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' }, gap: 3 }}>
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Activity timeline
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                Last 24 hours
              </Typography>
            </Box>
            <Stack>
              {[
                { time: '14:22', icon: <ReceiptLongOutlinedIcon />, color: '#dc2626', title: 'High-value wire attempted', detail: '₦14.2M to GT Bank ••• 8821 — held by OTP defense' },
                { time: '14:18', icon: <SmartphoneOutlinedIcon />, color: '#dc2626', title: 'New device registered', detail: 'Samsung A54 from IP 102.89.32.18' },
                { time: '14:15', icon: <LocationOnOutlinedIcon />, color: '#f59e0b', title: 'Location anomaly', detail: 'Lagos · 1,098 km from registered home (Sokoto)' },
                { time: '14:14', icon: <LoginRoundedIcon />, color: '#f59e0b', title: 'Login from new IP', detail: '102.89.32.18 · 4 OTP retries within 90 sec' },
                { time: '11:42', icon: <ReceiptLongOutlinedIcon />, color: colorPalette.primary, title: 'Routine transfer', detail: '₦80k to known beneficiary · cleared' },
                { time: 'Yesterday 16:20', icon: <LoginRoundedIcon />, color: '#10b981', title: 'Normal login', detail: 'Sokoto · known device' },
              ].map((e, i, arr) => (
                <Box
                  key={i}
                  sx={{
                    px: 3,
                    py: 1.75,
                    display: 'flex',
                    gap: 1.5,
                    borderBottom: i === arr.length - 1 ? 'none' : '1px solid #f4f5f7',
                    '&:hover': { bgcolor: '#fafbfc' },
                  }}
                >
                  <Box sx={{ minWidth: 90 }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                      {e.time}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: `${e.color}15`,
                      color: e.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      '& > svg': { fontSize: '1rem' },
                    }}
                  >
                    {e.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost', mb: 0.25 }}>
                      {e.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {e.detail}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Right rail */}
          <Stack gap={3}>
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5 }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 1.5 }}>
                Devices on file
              </Typography>
              <Stack gap={1.5}>
                {[
                  { device: 'iPhone 13', os: 'iOS 17.4', lastSeen: 'Yesterday', trusted: true },
                  { device: 'Tecno Camon 19', os: 'Android 13', lastSeen: '5 days ago', trusted: true },
                  { device: 'Samsung A54', os: 'Android 14', lastSeen: 'Today, 14:18', trusted: false },
                ].map((d, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, borderBottom: i === 2 ? 'none' : '1px solid #f4f5f7' }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                        {d.device}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>
                        {d.os} · {d.lastSeen}
                      </Typography>
                    </Box>
                    <Chip
                      label={d.trusted ? 'TRUSTED' : 'NEW'}
                      size="small"
                      sx={{
                        bgcolor: d.trusted ? '#f0fdf4' : '#fef2f2',
                        color: d.trusted ? '#10b981' : '#dc2626',
                        fontWeight: 700,
                        fontSize: '0.6rem',
                        letterSpacing: '0.1em',
                        borderRadius: 0,
                        height: 18,
                        '& .MuiChip-label': { px: 0.625 },
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5 }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 1.5 }}>
                Sanctions & PEP screening
              </Typography>
              <Stack gap={1}>
                {[
                  { list: 'OFAC SDN', status: 'clear', date: 'Today' },
                  { list: 'UN Consolidated', status: 'clear', date: 'Today' },
                  { list: 'NFIU Domestic PEP', status: 'clear', date: 'Today' },
                  { list: 'EU Sanctions', status: 'clear', date: 'Yesterday' },
                  { list: 'Adverse Media', status: 'clear', date: 'Today' },
                ].map((s) => (
                  <Box key={s.list} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#475569' }}>
                      {s.list}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <VerifiedOutlinedIcon sx={{ fontSize: '0.875rem', color: '#10b981' }} />
                      <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>{s.date}</Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>

      <TOTPConfirmation
        open={freezeOpen}
        onClose={() => setFreezeOpen(false)}
        onConfirm={() => setFreezeOpen(false)}
        operation="delete"
        title="Freeze customer account"
        description="Freezing will immediately block all transactions and login attempts. The customer will be notified by SMS. This action is reversible by a senior officer."
        resourceType="Customer account"
        resourceName="Adamu Ibrahim · ACC-1729"
        itemsAffected={[
          'All inbound transfers blocked',
          'All outbound transfers blocked',
          'Mobile and web login disabled',
          'Customer notified via SMS to registered MSISDN',
          'Audit log entry created',
        ]}
      />
    </DashboardLayout>
  )
}
