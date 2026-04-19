import { Box, Typography, Stack, Button, Chip, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SmartphoneOutlinedIcon from '@mui/icons-material/SmartphoneOutlined'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'

interface Pattern {
  id: string
  name: string
  category: 'Geo' | 'Device' | 'Velocity' | 'Network' | 'Temporal'
  affected: number
  emergence: string
  severity: 'critical' | 'high' | 'medium'
  description: string
  example: string
  recommendedActions: { label: string; primary?: boolean }[]
  matchedTypology: string
}

const patterns: Pattern[] = [
  {
    id: 'pat-1',
    name: 'Same-IP cluster across unrelated accounts',
    category: 'Network',
    affected: 4,
    emergence: '2 hours ago',
    severity: 'critical',
    description: 'Four customer accounts — none with prior relationship — all initiated wire transfers from the same IP block (102.89.32.0/24) within 18 minutes of each other.',
    example: 'Adamu I., Folake A., Bashir M., Tunde B. — all moved between ₦8M and ₦14M to recently-added beneficiaries.',
    matchedTypology: 'Mule herding · NFIU Typology #SST-12',
    recommendedActions: [
      { label: 'Freeze all 4 accounts', primary: true },
      { label: 'Open joint case' },
      { label: 'File NFIU STR' },
    ],
  },
  {
    id: 'pat-2',
    name: 'Geographically impossible login',
    category: 'Geo',
    affected: 1,
    emergence: '14 min ago',
    severity: 'high',
    description: 'Customer logged in from Lagos at 13:42 and Abuja at 14:08 — physically impossible without supersonic travel. One session is using stolen credentials.',
    example: 'Folake Adesanya · ACC-2840',
    matchedTypology: 'Account takeover · CBN Risk Code R-09',
    recommendedActions: [
      { label: 'Force re-authentication', primary: true },
      { label: 'Lock newer session' },
      { label: 'Notify customer via SMS' },
    ],
  },
  {
    id: 'pat-3',
    name: 'Device shared across customers',
    category: 'Device',
    affected: 7,
    emergence: '6 hours ago',
    severity: 'high',
    description: 'Single device fingerprint (DVC-8b32a1) authenticated as 7 different customers in the past 24 hours — pattern matches credential-stuffing operation.',
    example: 'iPhone 14 Pro · IP rotated through 3 Lagos data centers',
    matchedTypology: 'Credential stuffing · NFIU Typology #SST-04',
    recommendedActions: [
      { label: 'Block device fingerprint', primary: true },
      { label: 'Force MFA on affected accounts' },
      { label: 'Alert all 7 customers' },
    ],
  },
  {
    id: 'pat-4',
    name: 'Off-pattern activity bursts',
    category: 'Temporal',
    affected: 23,
    emergence: '8 hours ago',
    severity: 'medium',
    description: '23 customers transacted between 02:00-04:00 — outside their personal baseline of activity. Pattern often precedes coordinated cash-out.',
    example: 'Avg ticket: ₦1.8M · 18 of 23 to first-time beneficiaries',
    matchedTypology: 'Coordinated cash-out · CBN Watch List W-22',
    recommendedActions: [
      { label: 'Tighten night-window threshold', primary: true },
      { label: 'Add to enhanced monitoring' },
    ],
  },
  {
    id: 'pat-5',
    name: 'Velocity ring — same beneficiary',
    category: 'Velocity',
    affected: 14,
    emergence: '12 hours ago',
    severity: 'high',
    description: '14 different customers sent funds to the same Kuda wallet (••• 4029) within 4 hours. Sub-threshold structuring — each transaction below ₦1M to avoid manual review.',
    example: 'Total flow: ₦9.4M · all marked as "personal gift" in narration',
    matchedTypology: 'Smurfing · NFIU Typology #SST-07',
    recommendedActions: [
      { label: 'Freeze beneficiary wallet', primary: true },
      { label: 'Investigate source customers' },
      { label: 'File aggregated SAR' },
    ],
  },
]

const categoryConfig: Record<Pattern['category'], { color: string; icon: React.ReactNode }> = {
  Geo: { color: '#7c3aed', icon: <LocationOnOutlinedIcon sx={{ fontSize: '1rem' }} /> },
  Device: { color: '#0891b2', icon: <SmartphoneOutlinedIcon sx={{ fontSize: '1rem' }} /> },
  Velocity: { color: '#ea580c', icon: <ScheduleRoundedIcon sx={{ fontSize: '1rem' }} /> },
  Network: { color: '#dc2626', icon: <GroupsOutlinedIcon sx={{ fontSize: '1rem' }} /> },
  Temporal: { color: colorPalette.primary, icon: <ScheduleRoundedIcon sx={{ fontSize: '1rem' }} /> },
}

const severityConfig: Record<Pattern['severity'], { bg: string; color: string }> = {
  critical: { bg: '#fef2f2', color: '#dc2626' },
  high: { bg: '#fffbeb', color: '#f59e0b' },
  medium: { bg: `${colorPalette.primary}10`, color: colorPalette.primary },
}

export default function BehavioralPatternsPage() {
  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <PsychologyOutlinedIcon sx={{ fontSize: '0.875rem', color: colorPalette.primary }} />
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Behavioral Intelligence
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Pattern Detection
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', maxWidth: 720 }}>
            Eureka continuously hunts for patterns that span multiple customers, devices, and channels — surfacing fraud rings before they can scale.
          </Typography>
        </Box>

        {/* Eureka summary banner */}
        <Box
          sx={{
            bgcolor: colorPalette.primary,
            color: '#ffffff',
            p: 3,
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-30%',
              right: '-5%',
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
            },
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              bgcolor: 'rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.5rem' }} />
          </Box>
          <Box sx={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85, mb: 0.5 }}>
              Eureka's overnight finding
            </Typography>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, mb: 0.875, fontFamily: 'Jost', letterSpacing: '-0.01em' }}>
              {patterns.length} active patterns affect {patterns.reduce((sum, p) => sum + p.affected, 0)} customers
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', opacity: 0.9, lineHeight: 1.55, maxWidth: '85%' }}>
              The most urgent — a same-IP cluster across 4 unrelated accounts — matches NFIU Typology #SST-12 for mule herding. Recommend freezing all 4 accounts pending investigation.
            </Typography>
          </Box>
          <Stack direction="row" gap={1.25}>
            <Button
              sx={{
                bgcolor: 'rgba(255,255,255,0.12)',
                color: '#ffffff',
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                border: '1px solid rgba(255,255,255,0.2)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              }}
            >
              Dismiss
            </Button>
            <Button
              sx={{
                bgcolor: '#ffffff',
                color: colorPalette.primary,
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 700,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: '#f8fafc' },
              }}
            >
              Action All Critical
            </Button>
          </Stack>
        </Box>

        {/* Filter pills */}
        <Stack direction="row" gap={1} sx={{ mb: 3 }}>
          {['All patterns', 'Critical', 'High', 'Medium', 'Geo', 'Device', 'Network', 'Velocity'].map((f, i) => (
            <Box
              key={f}
              sx={{
                px: 1.75,
                py: 0.75,
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                cursor: 'pointer',
                color: i === 0 ? '#ffffff' : '#475569',
                bgcolor: i === 0 ? colorPalette.primary : '#ffffff',
                border: '1px solid',
                borderColor: i === 0 ? colorPalette.primary : '#e5e7eb',
                transition: 'all 0.15s',
                '&:hover': { borderColor: colorPalette.primary, color: i === 0 ? '#ffffff' : colorPalette.primary },
              }}
            >
              {f}
            </Box>
          ))}
        </Stack>

        {/* Patterns list */}
        <Stack gap={2}>
          {patterns.map((p) => {
            const cat = categoryConfig[p.category]
            const sev = severityConfig[p.severity]
            return (
              <Box key={p.id} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', overflow: 'hidden' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 0 }}>
                  {/* Severity strip */}
                  <Box
                    sx={{
                      bgcolor: sev.color,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      py: 2.5,
                      px: 1,
                    }}
                  >
                    <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, fontFamily: 'Jost', lineHeight: 1 }}>
                      {p.affected}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        mt: 0.75,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                      }}
                    >
                      Affected
                    </Typography>
                  </Box>

                  {/* Body */}
                  <Box sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, color: cat.color }}>
                            {cat.icon}
                            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                              {p.category}
                            </Typography>
                          </Box>
                          <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#cbd5e1' }} />
                          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8' }}>
                            Detected {p.emergence}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.75 }}>
                          {p.name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6, mb: 1 }}>
                          {p.description}
                        </Typography>
                        <Box sx={{ bgcolor: '#fafbfc', border: '1px solid #f4f5f7', p: 1.25, mb: 1.5 }}>
                          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.375 }}>
                            Example
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                            {p.example}
                          </Typography>
                        </Box>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Chip
                            label={p.severity.toUpperCase()}
                            size="small"
                            sx={{
                              bgcolor: sev.bg,
                              color: sev.color,
                              fontWeight: 700,
                              fontSize: '0.625rem',
                              letterSpacing: '0.1em',
                              borderRadius: 0,
                              height: 20,
                            }}
                          />
                          <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>
                            Matched: {p.matchedTypology}
                          </Typography>
                        </Stack>
                      </Box>
                    </Box>

                    {/* Recommended actions */}
                    <Box sx={{ borderTop: '1px solid #f4f5f7', mt: 2, pt: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
                          <AutoAwesomeOutlinedIcon sx={{ fontSize: '0.875rem', color: colorPalette.primary }} />
                          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                            Recommended actions
                          </Typography>
                        </Box>
                        <Stack direction="row" gap={1}>
                          {p.recommendedActions.map((a) => (
                            <Button
                              key={a.label}
                              startIcon={
                                a.primary ? <LockOutlinedIcon sx={{ fontSize: '0.875rem !important' }} /> : a.label.includes('alert') || a.label.includes('Notify') ? null : null
                              }
                              sx={{
                                bgcolor: a.primary ? sev.color : '#ffffff',
                                color: a.primary ? '#ffffff' : '#475569',
                                border: a.primary ? 'none' : '1px solid #e5e7eb',
                                px: 1.75,
                                py: 0.875,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                fontFamily: 'Jost',
                                borderRadius: 0,
                                textTransform: 'none',
                                boxShadow: 'none',
                                '&:hover': { bgcolor: a.primary ? sev.color : '#f8fafc', opacity: a.primary ? 0.9 : 1 },
                              }}
                            >
                              {a.label}
                            </Button>
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )
          })}
        </Stack>
      </Box>
    </DashboardLayout>
  )
}
