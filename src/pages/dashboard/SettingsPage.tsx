import { Box, Typography, Stack, TextField, Switch, Button, Chip } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import GeoFenceDialog from '@/components/dashboard/GeoFenceDialog'
import { useState } from 'react'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import ChevronRightIcon   from '@mui/icons-material/ChevronRight'

const labelSx = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#475569',
  mb: 0.875,
  fontFamily: 'Jost',
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#f5f3fb',
    borderRadius: 0,
    '& fieldset': { border: '1px solid transparent' },
    '&:hover fieldset': { borderColor: '#e4dff2' },
    '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
    '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
  },
  '& .MuiOutlinedInput-input': {
    fontSize: '0.875rem',
    fontFamily: 'Jost',
    py: '14px',
    px: '14px',
    color: '#0f172a',
  },
}

const settingsSections = [
  {
    title: 'Organization',
    desc: 'Profile and contact details for your institution',
    fields: [
      { label: 'Institution name', value: 'First City Monument Bank' },
      { label: 'Regulator code (CBN)', value: '058' },
      { label: 'Compliance contact email', value: 'compliance@fcmb.com' },
      { label: 'NFIU reporting officer', value: 'Adaeze Chukwu' },
    ],
  },
]

const toggles = [
  { label: 'Auto-file STRs above risk score 90', desc: 'Eureka files NFIU reports without manual review when risk is unambiguous', enabled: true },
  { label: 'Require dual approval for rule changes', desc: 'Threshold modifications need a second senior officer to confirm', enabled: true },
  { label: 'Email digest at 08:00 daily', desc: 'Adaeze receives a morning briefing summarizing overnight activity', enabled: true },
  { label: 'Slack alerts for critical events', desc: 'Send #fraud-ops a notification on any risk-90+ event', enabled: false },
  { label: 'NDIC quarterly auto-export', desc: 'Push deposit risk profile to NDIC compliance portal each quarter', enabled: true },
]

export default function SettingsPage() {
  const [saveOpen,     setSaveOpen]     = useState(false)
  const [geoFenceOpen, setGeoFenceOpen] = useState(false)
  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Manage
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Settings
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Organization profile, automation rules, and notification preferences
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
          {/* Organization */}
          {settingsSections.map((section) => (
            <Box key={section.title} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  {section.title}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  {section.desc}
                </Typography>
              </Box>
              <Stack sx={{ p: 3 }} gap={2.5}>
                {section.fields.map((f) => (
                  <Box key={f.label}>
                    <Typography sx={labelSx}>{f.label}</Typography>
                    <TextField fullWidth defaultValue={f.value} sx={inputSx} />
                  </Box>
                ))}
                <Button
                  onClick={() => setSaveOpen(true)}
                  sx={{
                    alignSelf: 'flex-start',
                    bgcolor: colorPalette.primary,
                    color: '#ffffff',
                    px: 2.25,
                    py: 1.125,
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#1a3896' },
                  }}
                >
                  Save Changes
                </Button>
              </Stack>
            </Box>
          ))}

          {/* Automation toggles */}
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Automation & Notifications
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                Configure what runs automatically and what alerts go where
              </Typography>
            </Box>
            <Stack>
              {toggles.map((t, i) => (
                <Box
                  key={t.label}
                  sx={{
                    px: 3,
                    py: 2.25,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 2,
                    borderBottom: i === toggles.length - 1 ? 'none' : '1px solid #f4f5f7',
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost', mb: 0.25 }}>
                      {t.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                      {t.desc}
                    </Typography>
                  </Box>
                  <Switch
                    defaultChecked={t.enabled}
                    size="small"
                    sx={{
                      mt: 0.5,
                      '& .MuiSwitch-track': { borderRadius: 8 },
                      '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                    }}
                  />
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Security */}
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', gridColumn: { xs: '1', lg: '1 / -1' } }}>
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <ShieldOutlinedIcon sx={{ fontSize: '1.1rem', color: colorPalette.primary }} />
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  Security
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  Access control and physical security boundaries
                </Typography>
              </Box>
            </Box>
            <Box
              onClick={() => setGeoFenceOpen(true)}
              sx={{
                px: 3, py: 2.25,
                display: 'flex', alignItems: 'center', gap: 2,
                cursor: 'pointer',
                '&:hover': { bgcolor: '#f8fafc' },
                transition: 'background 0.15s',
              }}
            >
              <Box sx={{
                width: 40, height: 40, borderRadius: '8px', flexShrink: 0,
                bgcolor: `${colorPalette.primary}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PublicOutlinedIcon sx={{ fontSize: '1.25rem', color: colorPalette.primary }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    Geographical Access Fence
                  </Typography>
                  <Chip label="Super Admin" size="small" sx={{ bgcolor: '#f0fdf4', color: '#10b981', fontWeight: 700, fontSize: '0.625rem', letterSpacing: '0.06em', borderRadius: '3px', height: 18 }} />
                </Stack>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25, lineHeight: 1.5 }}>
                  Draw a polygon on OpenStreetMap and restrict specific users to that zone. Calibrate for GPS drift. Real-time admin approval for out-of-zone login attempts.
                </Typography>
              </Box>
              <ChevronRightIcon sx={{ color: '#94a3b8', flexShrink: 0 }} />
            </Box>
          </Box>
        </Box>
      </Box>

      <TOTPConfirmation
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onConfirm={() => setSaveOpen(false)}
        operation="update"
        title="Save organization settings"
        description="Organization profile changes propagate to all NFIU and CBN report templates immediately. Confirm with your authenticator code."
        resourceType="Organization"
        resourceName="First City Monument Bank"
      />

      <GeoFenceDialog open={geoFenceOpen} onClose={() => setGeoFenceOpen(false)} />
    </DashboardLayout>
  )
}
