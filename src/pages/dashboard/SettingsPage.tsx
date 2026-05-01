import { Box, Typography, Stack, TextField, Switch, Button, Chip, InputBase, Grid } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import GeoFenceDialog from '@/components/dashboard/GeoFenceDialog'
import EurekaLearnMoreModal from '@/components/dashboard/EurekaLearnMoreModal'
import { useState } from 'react'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import { useEureka } from '@/contexts/EurekaContext'
import { useSandbox } from '@/contexts/SandboxContext'

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

function EurekaCompanionSection() {
  const { eurekaEnabled, setEurekaEnabled } = useEureka()
  const [eurekaLearnOpen, setEurekaLearnOpen] = useState(false)

  return (
    <>
      <Box
        data-ai-analyzable="true"
        data-ai-description="Eureka Companion: Master configuration for the AI analytical cursor. Toggle the wave-glow interaction and contextual tooltip system across the entire dashboard."
        sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', gridColumn: { xs: '1', lg: '1 / -1' } }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.1rem', color: colorPalette.primary }} />
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              Eureka Companion
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              AI-powered realtime intelligence buddy embedded in your workflow
            </Typography>
          </Box>
        </Box>
        <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '8px',
              flexShrink: 0,
              bgcolor: `${colorPalette.primary}12`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.375rem', color: colorPalette.primary }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Eureka Realtime Buddy
              </Typography>
              <Chip
                label={eurekaEnabled ? 'Active' : 'Inactive'}
                size="small"
                sx={{
                  bgcolor: eurekaEnabled ? '#f0fdf4' : '#f8fafc',
                  color: eurekaEnabled ? '#10b981' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: '0.625rem',
                  letterSpacing: '0.06em',
                  borderRadius: '3px',
                  height: 18,
                }}
              />
            </Stack>
            <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.6, mb: 1.5 }}>
              When enabled, hover any sidebar item for 2 seconds to trigger a contextual AI bubble explaining what that module does, surface smart suggestions, and open a chat panel — all without leaving your workflow. Your cursor will display a subtle wave-glow effect while this feature is active.
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                onClick={() => {
                  console.log('Eureka toggle clicked, current state:', eurekaEnabled)
                  setEurekaEnabled(!eurekaEnabled)
                }}
                sx={{
                  width: 34,
                  height: 18,
                  borderRadius: 10,
                  bgcolor: eurekaEnabled ? colorPalette.primary : '#e2e8f0',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  flexShrink: 0,
                  pointerEvents: 'auto',
                  zIndex: 10,
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 2,
                    left: eurekaEnabled ? 18 : 2,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    bgcolor: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }
                }}
              />
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', fontFamily: 'Jost' }}>
                {eurekaEnabled ? 'Enabled' : 'Disabled'}
              </Typography>
              <Button
                onClick={() => setEurekaLearnOpen(true)}
                disableRipple
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontFamily: 'Jost',
                  color: colorPalette.primary,
                  textTransform: 'none',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 0,
                  border: `1px solid ${colorPalette.primary}30`,
                  bgcolor: `${colorPalette.primary}07`,
                  '&:hover': { bgcolor: `${colorPalette.primary}12` },
                }}
              >
                Learn more about Eureka
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>
      <EurekaLearnMoreModal open={eurekaLearnOpen} onClose={() => setEurekaLearnOpen(false)} />
    </>
  )
}

function DeveloperSandboxSection() {
  const { sandboxEnabled, setSandboxEnabled, sandboxUrl, setSandboxUrl, isDevOrAdmin, isLoading } = useSandbox()
  const [localUrl, setLocalUrl] = useState(sandboxUrl)
  const [isApplying, setIsApplying] = useState(false)

  console.log('DeveloperSandboxSection: isLoading=', isLoading, 'isDevOrAdmin=', isDevOrAdmin)

  if (isLoading || !isDevOrAdmin) return null

  const handleApply = () => {
    setIsApplying(true)
    setSandboxUrl(localUrl)
    setSandboxEnabled(true)

    // Smooth transition: give it a moment to save before refreshing
    setTimeout(() => {
      window.location.reload()
    }, 800)
  }

  return (
    <Box
      data-ai-analyzable="true"
      data-ai-description="Developer Sandbox: Isolated environment configuration. Redirect all API traffic to a custom development URL. Changes require a page reload to re-initialize the network client."
      sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', gridColumn: { xs: '1', lg: '1 / -1' } }}>
      <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <ScienceOutlinedIcon sx={{ fontSize: '1.1rem', color: '#c2410c' }} />
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
            Developer Sandbox
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Redirect application traffic to an isolated development environment
          </Typography>
        </Box>
      </Box>
      <Box sx={{ px: 3, py: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', mb: 1, fontFamily: 'Jost' }}>
              Sandbox Environment URL
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <InputBase
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                placeholder="e.g. http://localhost:8081"
                sx={{
                  flex: 1,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  px: 1.5,
                  height: 42,
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  '&:focus-within': { borderColor: colorPalette.primary, bgcolor: '#fff' }
                }}
              />
              <Button
                onClick={handleApply}
                disabled={isApplying}
                sx={{
                  bgcolor: colorPalette.primary,
                  color: '#fff',
                  height: 24,
                  px: 3,
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 0,
                  '&:hover': { bgcolor: '#1a3896' }
                }}
              >
                {isApplying ? 'Applying...' : 'Apply & Reload'}
              </Button>
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 1.5 }}>
              Enter the target OpenIV API endpoint. All subsequent requests will be routed here.
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ p: 2, bgcolor: sandboxEnabled ? '#fff7ed' : '#f8fafc', border: `1px solid ${sandboxEnabled ? '#ffedd5' : '#e2e8f0'}`, height: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: sandboxEnabled ? '#c2410c' : '#64748b', fontFamily: 'Jost' }}>
                    Sandbox Redirection
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>
                    Currently routing to {sandboxEnabled ? 'Sandbox' : 'Production'}
                  </Typography>
                </Box>
                <Box
                  onClick={() => {
                    if (sandboxEnabled) {
                      setSandboxEnabled(false)
                      window.location.reload()
                    } else {
                      handleApply()
                    }
                  }}
                  sx={{
                    width: 34,
                    height: 18,
                    borderRadius: 10,
                    bgcolor: sandboxEnabled ? '#c2410c' : '#e2e8f0',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 2,
                      left: sandboxEnabled ? 18 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }
                  }}
                />
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
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
  const [saveOpen, setSaveOpen] = useState(false)
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
                  <Box
                    key={f.label}
                    data-ai-analyzable="true"
                    data-ai-description={`Organization Setting: ${f.label}. current value: ${f.value}. This information is used as metadata in regulatory NFIU filings.`}>
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
                  data-ai-analyzable="true"
                  data-ai-description={`Automation Rule: ${t.label}. status: ${t.enabled ? 'Enabled' : 'Disabled'}. description: ${t.desc}.`}
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

          {/* Eureka Companion */}
          <EurekaCompanionSection />

          {/* Developer Sandbox */}
          <DeveloperSandboxSection />

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
              data-ai-analyzable="true"
              data-ai-description="Geographical Access Fence: Advanced spatial security. Restrict dashboard access to specific coordinates or polygons using GPS calibration."
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
