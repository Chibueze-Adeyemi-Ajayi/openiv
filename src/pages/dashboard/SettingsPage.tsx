import { Box, Typography, Stack, TextField, Button, Chip, InputBase, Grid, Slider, RadioGroup, Radio, Alert, Tooltip } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useRbac } from '@/contexts/RbacContext'
import { colorPalette } from '@/theme'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import GeoFenceDialog from '@/components/dashboard/GeoFenceDialog'
import EurekaLearnMoreModal from '@/components/dashboard/EurekaLearnMoreModal'
import { useState, useEffect, useRef } from 'react'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import { useEureka } from '@/contexts/EurekaContext'
import { useSandbox } from '@/contexts/SandboxContext'
import { amlApi, type AmlSettings } from '@/api/aml'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import { institutionApi, type SigningCredentials } from '@/api/institution'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { kycApi, type KycEvaluationConfig } from '@/api/kyc'

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
    color: '#00288e',
  },
}

function TimezoneSection() {
  const { can } = useRbac()
  const canEdit = can('aml.settings')
  const [currentTz, setCurrentTz] = useState<string>('Africa/Lagos')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedTz, setSavedTz] = useState<string>('Africa/Lagos')

  const timezones = [
    { label: 'Lagos, Nigeria (WAT)', value: 'Africa/Lagos' },
    { label: 'Accra, Ghana (GMT)', value: 'Africa/Accra' },
    { label: 'Nairobi, Kenya (EAT)', value: 'Africa/Nairobi' },
    { label: 'Johannesburg, SA (SAST)', value: 'Africa/Johannesburg' },
    { label: 'London, UK (GMT/BST)', value: 'Europe/London' },
    { label: 'New York, USA (EST/EDT)', value: 'America/New_York' },
    { label: 'Dubai, UAE (GST)', value: 'Asia/Dubai' },
    { label: 'Singapore (SGT)', value: 'Asia/Singapore' },
  ]

  useEffect(() => {
    amlApi.getSettings()
      .then(res => {
        const tz = res.settings?.timezone || 'Africa/Lagos'
        setCurrentTz(tz)
        setSavedTz(tz)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await amlApi.updateTimezone(currentTz)
      setSavedTz(currentTz)
    } catch (err) {
      console.error('Failed to update timezone:', err)
      alert('Failed to update timezone')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  const isDirty = currentTz !== savedTz

  return (
    <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', gridColumn: { xs: '1', lg: '1 / -1' } }}>
      <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <LanguageOutlinedIcon sx={{ fontSize: '1.1rem', color: colorPalette.primary }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            Institution Timezone
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Configure the default timezone for your institution's transaction reporting and analysis
          </Typography>
        </Box>
        {!canEdit && <Chip icon={<LockOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />} label="View only" size="small" sx={{ bgcolor: '#f8fafc', color: '#94a3b8', fontWeight: 600, fontSize: '0.625rem', borderRadius: '3px', height: 20 }} />}
      </Box>
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3} alignItems="flex-end">
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography sx={labelSx}>Preferred Timezone</Typography>
            <TextField
              select
              fullWidth
              value={currentTz}
              onChange={(e) => canEdit && setCurrentTz(e.target.value)}
              SelectProps={{ native: true }}
              inputProps={{ disabled: !canEdit }}
              sx={{ ...inputSx, ...(canEdit ? {} : { pointerEvents: 'none', opacity: 0.7 }) }}
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                onClick={handleSave}
                disabled={!isDirty || saving || !canEdit}
                sx={{
                  bgcolor: colorPalette.primary,
                  color: '#fff',
                  px: 3,
                  py: 1.25,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  fontFamily: 'Jost',
                  borderRadius: 0,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#1e293b' },
                  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' }
                }}
              >
                {saving ? 'Saving...' : 'Update Timezone'}
              </Button>
              {!isDirty && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#10b981' }}>
                  <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1rem' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost' }}>Up to date</Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 2, lineHeight: 1.5 }}>
          <Box component="span" sx={{ fontWeight: 700, color: '#64748b' }}>Note:</Box> Changing the timezone affects how transaction timestamps are interpreted during ingestion and how they are displayed across the dashboard. Existing transactions will be re-aligned to this zone in the UI.
        </Typography>
      </Box>
    </Box>
  )
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
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
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
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
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

function AmlSettingsSection() {
  const { can } = useRbac()
  const canEdit = can('aml.settings')
  const [settings, setSettings] = useState<AmlSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoOpenCase, setAutoOpenCase] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [isAddingEmail, setIsAddingEmail] = useState(false)
  const [emails, setEmails] = useState<string[]>([])

  useEffect(() => {
    amlApi.getSettings()
      .then(res => {
        if (res.settings) {
          setSettings(res.settings)
          setAutoOpenCase(res.settings.autoOpenCase)
          setEmails(res.settings.caseNotificationEmails || [])
        }
      })
      .catch(err => console.error('Failed to load AML settings:', err))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async () => {
    setIsSaving(true)
    try {
      const res = await amlApi.updateSettings({ autoOpenCase: !autoOpenCase })
      setSettings(res.settings)
      setAutoOpenCase(res.settings.autoOpenCase)
      setEmails(res.settings.caseNotificationEmails || [])
    } catch (err) {
      console.error('Failed to update AML settings:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleAddEmail = async () => {
    if (!newEmail.trim()) return
    if (!isValidEmail(newEmail)) {
      alert('Please enter a valid email address')
      return
    }
    if (emails.includes(newEmail.trim())) {
      alert('This email is already added')
      return
    }

    setIsAddingEmail(true)
    try {
      const res = await amlApi.addNotificationEmail(newEmail.trim())
      setSettings(res.settings)
      setEmails(res.settings.caseNotificationEmails || [])
      setNewEmail('')
    } catch (err) {
      console.error('Failed to add email:', err)
      alert('Failed to add email. Please try again.')
    } finally {
      setIsAddingEmail(false)
    }
  }

  const handleRemoveEmail = async (emailToRemove: string) => {
    setIsAddingEmail(true)
    try {
      const res = await amlApi.removeNotificationEmail(emailToRemove)
      setSettings(res.settings)
      setEmails(res.settings.caseNotificationEmails || [])
    } catch (err) {
      console.error('Failed to remove email:', err)
      alert('Failed to remove email. Please try again.')
    } finally {
      setIsAddingEmail(false)
    }
  }

  if (loading) return null

  return (
    <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', gridColumn: { xs: '1', lg: '1 / -1' } }}>
      <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            AML Case Settings
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Configure automatic case creation behavior and notifications for fraud detection
          </Typography>
        </Box>
        {!canEdit && <Chip icon={<LockOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />} label="View only" size="small" sx={{ bgcolor: '#f8fafc', color: '#94a3b8', fontWeight: 600, fontSize: '0.625rem', borderRadius: '3px', height: 20 }} />}
      </Box>

      {/* Auto-open cases toggle */}
      <Box
        sx={{
          px: 3,
          py: 2.25,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          borderBottom: '1px solid #f4f5f7',
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost', mb: 0.25 }}>
            Auto-open investigation cases
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
            When enabled, fraud detection automatically creates investigation cases for transactions above the risk threshold.
          </Typography>
        </Box>
        <Box
          onClick={canEdit ? handleToggle : undefined}
          sx={{
            width: 34,
            height: 18,
            borderRadius: 10,
            bgcolor: autoOpenCase ? colorPalette.primary : '#e2e8f0',
            position: 'relative',
            cursor: !canEdit ? 'not-allowed' : isSaving ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
            opacity: !canEdit ? 0.5 : isSaving ? 0.6 : 1,
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 2,
              left: autoOpenCase ? 18 : 2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              bgcolor: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }
          }}
        />
      </Box>

      {/* Email notifications section */}
      <Box sx={{ px: 3, py: 2.5 }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost', mb: 1 }}>
          Send case notifications to
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5, mb: 2 }}>
          When a case is raised for review, send notifications to these team members' email addresses.
        </Typography>

        {/* Email input */}
        <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
          <TextField
            size="small"
            placeholder="name@company.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddEmail()
              }
            }}
            disabled={isAddingEmail || !canEdit}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': {
                bgcolor: '#f5f3fb',
                borderRadius: 0,
                fontSize: '0.875rem',
                fontFamily: 'Jost',
                '& fieldset': { border: '1px solid transparent' },
                '&:hover fieldset': { borderColor: '#e4dff2' },
                '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
              },
              '& .MuiOutlinedInput-input': {
                py: '10px',
                px: '14px',
              }
            }}
          />
          <Button
            onClick={handleAddEmail}
            disabled={isAddingEmail || !newEmail.trim() || !canEdit}
            sx={{
              bgcolor: colorPalette.primary,
              color: '#fff',
              px: 2,
              py: 1,
              fontSize: '0.8125rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 0,
              fontFamily: 'Jost',
              '&:hover': { bgcolor: '#1e293b' },
              '&:disabled': { bgcolor: '#cbd5e1', color: '#94a3b8' }
            }}
          >
            {isAddingEmail ? 'Adding...' : 'Add'}
          </Button>
        </Stack>

        {/* Email list */}
        {emails.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {emails.map((email) => (
              <Chip
                key={email}
                label={email}
                onDelete={canEdit ? () => handleRemoveEmail(email) : undefined}
                sx={{
                  bgcolor: '#f0f9ff',
                  borderColor: '#bae6fd',
                  border: '1px solid #bae6fd',
                  color: '#0369a1',
                  fontWeight: 500,
                  fontSize: '0.8125rem',
                  fontFamily: 'Jost',
                  '& .MuiChip-deleteIcon': {
                    color: '#0369a1',
                    '&:hover': { color: '#0c4a6e' }
                  }
                }}
              />
            ))}
          </Box>
        )}
        {emails.length === 0 && (
          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
            No email addresses added yet
          </Typography>
        )}
      </Box>
    </Box>
  )
}

// ── Beam Window widget constants ──────────────────────────────────────────────

const BEAM_PRESETS = [
  { seconds: 30,    display: '30 seconds',  short: '30s',  major: true  },
  { seconds: 60,    display: '1 minute',    short: '1m',   major: false },
  { seconds: 120,   display: '2 minutes',   short: '2m',   major: false },
  { seconds: 180,   display: '3 minutes',   short: '3m',   major: true  },
  { seconds: 300,   display: '5 minutes',   short: '5m',   major: false },
  { seconds: 600,   display: '10 minutes',  short: '10m',  major: true  },
  { seconds: 900,   display: '15 minutes',  short: '15m',  major: false },
  { seconds: 1800,  display: '30 minutes',  short: '30m',  major: true  },
  { seconds: 3600,  display: '1 hour',      short: '1h',   major: true  },
  { seconds: 7200,  display: '2 hours',     short: '2h',   major: false },
  { seconds: 21600, display: '6 hours',     short: '6h',   major: true  },
  { seconds: 43200, display: '12 hours',    short: '12h',  major: false },
  { seconds: 86400, display: '24 hours',    short: '24h',  major: true  },
] as const

function secondsToIdx(s: number): number {
  return BEAM_PRESETS.reduce((best, p, i) =>
    Math.abs(p.seconds - s) < Math.abs(BEAM_PRESETS[best].seconds - s) ? i : best, 0)
}

const QUICK_PICKS = [0, 3, 5, 7, 8] as const

interface BeamProfile {
  level: string; bars: number; color: string
  bgColor: string; borderColor: string; label: string; desc: string
  implications: Array<{ type: 'good' | 'warn' | 'bad'; text: string }>
}

function getBeamProfile(idx: number): BeamProfile {
  if (idx <= 1) return {
    level: 'MAXIMUM', bars: 5, color: '#059669', bgColor: '#ecfdf5', borderColor: '#6ee7b7',
    label: 'Maximum Security',
    desc: 'Extremely tight. Only transactions arriving almost instantly after their recorded time are accepted.',
    implications: [
      { type: 'good', text: 'Replay window under 1 minute — best-in-class protection' },
      { type: 'warn', text: 'Source systems must maintain near-perfect clock synchronisation' },
      { type: 'warn', text: 'High-latency or batch integrations may trigger false positives' },
    ],
  }
  if (idx <= 3) return {
    level: 'HIGH', bars: 4, color: '#16a34a', bgColor: '#f0fdf4', borderColor: '#86efac',
    label: 'High Security',
    desc: 'Strong protection with practical tolerance. Recommended default for real-time financial APIs.',
    implications: [
      { type: 'good', text: 'Transactions older than 3 min on arrival are flagged automatically' },
      { type: 'good', text: 'Normal API latency (< 30 seconds) always passes through' },
      { type: 'warn', text: 'Batch imports with old timestamps will be flagged as anomalies' },
    ],
  }
  if (idx <= 5) return {
    level: 'STANDARD', bars: 3, color: '#2563eb', bgColor: '#eff6ff', borderColor: '#93c5fd',
    label: 'Standard',
    desc: 'Balanced window for integrations with minor clock drift. Provides reasonable protection for most environments.',
    implications: [
      { type: 'good', text: 'Replay attacks older than 10 minutes are blocked automatically' },
      { type: 'good', text: 'Tolerates moderate clock drift in source systems' },
      { type: 'warn', text: 'Wider window extends the potential replay abuse period slightly' },
    ],
  }
  if (idx <= 7) return {
    level: 'LENIENT', bars: 2, color: '#d97706', bgColor: '#fffbeb', borderColor: '#fcd34d',
    label: 'Lenient',
    desc: 'Wide tolerance for high-latency or legacy systems. Fix source clock sync rather than widening this window.',
    implications: [
      { type: 'bad',  text: 'Replay attacks up to 30 minutes old may go undetected' },
      { type: 'good', text: 'Tolerates high API latency or significant clock drift' },
      { type: 'warn', text: 'Review source system clock accuracy and consider tightening' },
    ],
  }
  if (idx <= 9) return {
    level: 'WEAK', bars: 1, color: '#ea580c', bgColor: '#fff7ed', borderColor: '#fdba74',
    label: 'Weak Security',
    desc: 'A 1–2 hour window significantly weakens replay protection — attackers have more time to reuse transactions.',
    implications: [
      { type: 'bad', text: 'Replay attacks up to 2 hours old will NOT be detected' },
      { type: 'bad', text: 'Time anomaly detection is substantially weakened' },
      { type: 'warn', text: 'Use only as a temporary measure while resolving clock issues' },
    ],
  }
  return {
    level: 'CRITICAL', bars: 0, color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fca5a5',
    label: 'Critical Risk',
    desc: 'Extremely wide window. Transactions many hours old will not be flagged — your institution is highly exposed.',
    implications: [
      { type: 'bad', text: 'Transactions up to 24 hours old bypass all time anomaly checks' },
      { type: 'bad', text: 'High vulnerability to fraud via transaction replay attacks' },
      { type: 'bad', text: 'Not recommended for any production financial environment' },
    ],
  }
}

function BeamWindowSection() {
  const { can } = useRbac()
  const canEdit = can('aml.settings')
  const [savedSeconds, setSavedSeconds] = useState(180)
  const [draftIdx, setDraftIdx]         = useState(secondsToIdx(180))
  const [loading, setLoading]           = useState(true)
  const [totpOpen, setTotpOpen]         = useState(false)
  const [saving, setSaving]             = useState(false)

  useEffect(() => {
    amlApi.getSettings()
      .then(res => {
        const s = res.settings?.beamWindowSeconds ?? 180
        setSavedSeconds(s)
        setDraftIdx(secondsToIdx(s))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const savedIdx   = secondsToIdx(savedSeconds)
  const isDirty    = draftIdx !== savedIdx
  const preset     = BEAM_PRESETS[draftIdx]
  const profile    = getBeamProfile(draftIdx)

  const doSave = async () => {
    setSaving(true)
    try {
      const res = await amlApi.updateBeamWindow(preset.seconds)
      const newSeconds = res.settings.beamWindowSeconds
      setSavedSeconds(newSeconds)
      setDraftIdx(secondsToIdx(newSeconds))
    } catch { /* value stays at draft, user can retry */ }
    finally {
      setSaving(false)
      setTotpOpen(false)
    }
  }

  if (loading) return null

  const impIcon = (type: 'good' | 'warn' | 'bad') =>
    type === 'good' ? '✓' : type === 'warn' ? '⚠' : '✕'
  const impColors = {
    good: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    warn: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    bad:  { bg: '#fef2f2', border: '#fecaca', text: '#7f1d1d' },
  }

  return (
    <Box
      data-ai-analyzable="true"
      data-ai-description="Beam Time Window: Interactive security tuner for transaction timestamp tolerance. Drag the slider to set how wide the acceptance window is. Security strength indicator updates in real time."
      sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', gridColumn: { xs: '1', lg: '1 / -1' } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <TimerOutlinedIcon sx={{ fontSize: '1.1rem', color: colorPalette.primary }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            Beam Time Window
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Set how closely a transaction's recorded date must match its arrival time — tighter means stronger fraud protection
          </Typography>
        </Box>
        {!canEdit && <Chip icon={<LockOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />} label="View only" size="small" sx={{ bgcolor: '#f8fafc', color: '#94a3b8', fontWeight: 600, fontSize: '0.625rem', borderRadius: '3px', height: 20 }} />}
        {savedIdx !== secondsToIdx(180) && (
          <Box
            onClick={() => setDraftIdx(secondsToIdx(180))}
            sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', cursor: 'pointer', '&:hover': { color: colorPalette.primary } }}
          >
            Reset to default
          </Box>
        )}
      </Box>

      {/* Body */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 340px' }, gap: 0 }}>

        {/* ── LEFT: slider zone ── */}
        <Box sx={{ px: 4, pt: 4, pb: isDirty ? 0 : 4, borderRight: { lg: '1px solid #eef0f4' } }}>

          {/* Large time display */}
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Typography
              sx={{
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                fontWeight: 800,
                fontFamily: 'Jost',
                color: profile.color,
                lineHeight: 1,
                transition: 'color 0.35s ease',
                letterSpacing: '-0.02em',
              }}
            >
              {preset.display}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, mt: 0.75, letterSpacing: '0.06em' }}>
              {preset.seconds.toLocaleString()} seconds · drag slider to adjust
            </Typography>
          </Box>

          {/* Slider */}
          <Box sx={{ px: 1.5 }}>
            <Box
              sx={{
                '& .MuiSlider-root': { color: profile.color, transition: 'color 0.35s ease', pb: '28px' },
                '& .MuiSlider-rail': {
                  background: 'linear-gradient(to right, #059669 0%, #16a34a 17%, #2563eb 33%, #d97706 50%, #ea580c 67%, #dc2626 83%, #991b1b 100%)',
                  opacity: 0.2,
                  height: 10,
                  borderRadius: '2px',
                },
                '& .MuiSlider-track': {
                  background: `linear-gradient(to right, #059669 0%, ${profile.color} 100%)`,
                  border: 'none',
                  height: 10,
                  borderRadius: '2px',
                  transition: 'background 0.35s ease',
                },
                '& .MuiSlider-thumb': {
                  width: 30,
                  height: 30,
                  bgcolor: '#fff',
                  border: `3px solid ${profile.color}`,
                  boxShadow: `0 0 0 5px ${profile.color}22, 0 4px 16px rgba(0,0,0,0.12)`,
                  transition: 'border-color 0.35s ease, box-shadow 0.35s ease',
                  '&:hover': { boxShadow: `0 0 0 8px ${profile.color}28, 0 4px 16px rgba(0,0,0,0.15)` },
                  '&::after': { width: 10, height: 10, bgcolor: profile.color, borderRadius: '50%', transition: 'background-color 0.35s ease' },
                },
                '& .MuiSlider-mark': { display: 'none' },
                '& .MuiSlider-markLabel': {
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  fontFamily: 'Jost, sans-serif',
                  color: '#94a3b8',
                  top: '34px',
                  transition: 'color 0.2s ease',
                },
                [`& .MuiSlider-markLabel[data-index="${draftIdx}"]`]: {
                  color: profile.color,
                  fontWeight: 800,
                },
              }}
            >
              <Slider
                min={0}
                max={12}
                step={1}
                value={draftIdx}
                disabled={!canEdit}
                onChange={(_, v) => canEdit && setDraftIdx(v as number)}
                marks={BEAM_PRESETS.map((p, i) => ({ value: i, label: p.major ? p.short : '' }))}
              />
            </Box>

            {/* Security scale labels */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25, px: 0.25 }}>
              <Typography sx={{ fontSize: '0.625rem', color: '#059669', fontWeight: 700, letterSpacing: '0.08em' }}>
                ← TIGHTER · MORE SECURE
              </Typography>
              <Typography sx={{ fontSize: '0.625rem', color: '#dc2626', fontWeight: 700, letterSpacing: '0.08em' }}>
                MORE PERMISSIVE · LOOSER →
              </Typography>
            </Box>
          </Box>

          {/* Quick-pick chips */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 3.5 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', alignSelf: 'center', mr: 0.5 }}>
              Quick:
            </Typography>
            {QUICK_PICKS.map(idx => {
              const p = BEAM_PRESETS[idx]
              const active = draftIdx === idx
              const qProfile = getBeamProfile(idx)
              return (
                <Box
                  key={idx}
                  onClick={() => canEdit && setDraftIdx(idx)}
                  sx={{
                    px: 1.5,
                    py: 0.625,
                    cursor: 'pointer',
                    border: `1px solid ${active ? qProfile.color : '#e4dff2'}`,
                    bgcolor: active ? qProfile.color : '#fafbfc',
                    color: active ? '#fff' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    fontFamily: 'Jost',
                    borderRadius: '3px',
                    transition: 'all 0.18s ease',
                    userSelect: 'none',
                    '&:hover': { bgcolor: active ? qProfile.color : qProfile.bgColor, borderColor: qProfile.color, color: active ? '#fff' : qProfile.color },
                  }}
                >
                  {p.short}
                  {idx === secondsToIdx(180) && (
                    <Box component="span" sx={{ fontSize: '0.5625rem', ml: 0.5, opacity: 0.7 }}>default</Box>
                  )}
                </Box>
              )
            })}
          </Box>

          {/* Save bar */}
          {isDirty && (
            <Box
              sx={{
                mt: 3,
                mx: -4,
                px: 4,
                py: 2,
                borderTop: '1px solid #eef0f4',
                bgcolor: '#fafbfc',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                animation: 'slideUp 0.2s ease',
                '@keyframes slideUp': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                  Unsaved change:&nbsp;
                  <Box component="span" sx={{ textDecoration: 'line-through', color: '#94a3b8' }}>
                    {BEAM_PRESETS[savedIdx].display}
                  </Box>
                  &nbsp;→&nbsp;
                  <Box component="span" sx={{ color: profile.color, fontWeight: 800 }}>
                    {preset.display}
                  </Box>
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25 }}>
                  Requires Google Authenticator confirmation
                </Typography>
              </Box>
              <Button
                onClick={() => setDraftIdx(savedIdx)}
                sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', px: 1.5, py: 0.75, borderRadius: 0 }}
              >
                Discard
              </Button>
              <Button
                onClick={() => setTotpOpen(true)}
                disabled={saving || !canEdit}
                sx={{
                  bgcolor: profile.color,
                  color: '#fff',
                  px: 2.5,
                  py: 0.875,
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  fontFamily: 'Jost',
                  borderRadius: 0,
                  textTransform: 'none',
                  boxShadow: 'none',
                  transition: 'background-color 0.35s ease',
                  '&:hover:not(:disabled)': { opacity: 0.88 },
                  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
                }}
              >
                Save Window
              </Button>
            </Box>
          )}
        </Box>

        {/* ── RIGHT: security profile ── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', p: 3, gap: 2.5 }}>

          {/* Level card */}
          <Box
            sx={{
              bgcolor: profile.bgColor,
              border: `1px solid ${profile.borderColor}`,
              p: 2.5,
              transition: 'background-color 0.35s ease, border-color 0.35s ease',
            }}
          >
            {/* Header row: label + signal bars */}
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 1.75 }}>
              <Box>
                <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: profile.color, letterSpacing: '0.18em', textTransform: 'uppercase', transition: 'color 0.35s ease' }}>
                  Security level
                </Typography>
                <Typography sx={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'Jost', color: profile.color, mt: 0.25, transition: 'color 0.35s ease' }}>
                  {profile.label}
                </Typography>
              </Box>

              {/* Signal bars (ascending height) */}
              {profile.bars > 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', pb: 0.25 }}>
                  {[12, 17, 22, 27, 32].map((h, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 7,
                        height: h,
                        bgcolor: i < profile.bars ? profile.color : `${profile.color}25`,
                        borderRadius: '2px',
                        transition: 'background-color 0.35s ease',
                      }}
                    />
                  ))}
                </Box>
              ) : (
                <Box
                  sx={{
                    fontSize: '1.5rem',
                    lineHeight: 1,
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
                  }}
                >
                  ⚠
                </Box>
              )}
            </Box>

            <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.65 }}>
              {profile.desc}
            </Typography>
          </Box>

          {/* Implications */}
          <Box>
            <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 1.25 }}>
              What this means
            </Typography>
            <Stack gap={0.75}>
              {profile.implications.map((imp, i) => {
                const c = impColors[imp.type]
                return (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.25,
                      px: 1.5,
                      py: 1.125,
                      bgcolor: c.bg,
                      border: `1px solid ${c.border}`,
                      animation: `fadeSlide 0.25s ease ${i * 0.05}s both`,
                      '@keyframes fadeSlide': {
                        from: { opacity: 0, transform: 'translateX(6px)' },
                        to: { opacity: 1, transform: 'none' },
                      },
                    }}
                  >
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: c.text, flexShrink: 0, lineHeight: 1.5 }}>
                      {impIcon(imp.type)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: c.text, lineHeight: 1.6 }}>
                      {imp.text}
                    </Typography>
                  </Box>
                )
              })}
            </Stack>
          </Box>

          {/* Current saved value note */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 0.5, mt: 'auto' }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>
              Active:&nbsp;
              <Box component="span" sx={{ color: '#00288e', fontWeight: 700 }}>
                {BEAM_PRESETS[savedIdx].display}
              </Box>
              {isDirty && (
                <Box component="span" sx={{ color: '#94a3b8', fontWeight: 400 }}>
                  &nbsp;(unsaved changes)
                </Box>
              )}
            </Typography>
          </Box>
        </Box>
      </Box>

      <TOTPConfirmation
        open={totpOpen}
        onClose={() => setTotpOpen(false)}
        onConfirm={doSave}
        operation="update"
        title="Update Beam Time Window"
        description="Changing the beam window affects which transactions are flagged as time anomalies. Confirm your identity to proceed."
        resourceType="Beam Window"
        resourceName={`${BEAM_PRESETS[savedIdx].display} → ${preset.display}`}
        changes={[{
          field: 'Window',
          from: `${BEAM_PRESETS[savedIdx].display} (${BEAM_PRESETS[savedIdx].seconds}s)`,
          to: `${preset.display} (${preset.seconds}s)`,
        }]}
      />
    </Box>
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
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
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
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#00288e', mb: 1, fontFamily: 'Jost' }}>
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
                  '&:hover': { bgcolor: '#1e293b' }
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

function FilingCredentialsSection() {
  const { can } = useRbac()
  const canEdit = can('institution.modify')
  const [credentials, setCredentials] = useState<SigningCredentials>({ officialStamp: null, officialSignature: null })
  const [loading, setLoading] = useState(true)
  const [totpOpen, setTotpOpen] = useState(false)
  const [pendingField, setPendingField] = useState<'officialStamp' | 'officialSignature' | null>(null)
  const [pendingData, setPendingData] = useState<string | null>(null)
  const [isRemoval, setIsRemoval] = useState(false)
  const [saving, setSaving] = useState(false)
  const stampInputRef = useRef<HTMLInputElement>(null)
  const sigInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    institutionApi.getSigningCredentials()
      .then(res => setCredentials(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleFileChange = (field: 'officialStamp' | 'officialSignature') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (credentials[field]) {
        setPendingField(field)
        setPendingData(dataUrl)
        setIsRemoval(false)
        setTotpOpen(true)
      } else {
        doSave(field, dataUrl)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const doSave = async (field: 'officialStamp' | 'officialSignature', dataUrl: string | null) => {
    setSaving(true)
    try {
      await institutionApi.updateSigningCredentials({ [field]: dataUrl })
      setCredentials(prev => ({ ...prev, [field]: dataUrl }))
    } catch {
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
      setTotpOpen(false)
      setPendingField(null)
      setPendingData(null)
      setIsRemoval(false)
    }
  }

  const handleRemove = (field: 'officialStamp' | 'officialSignature') => {
    setPendingField(field)
    setPendingData(null)
    setIsRemoval(true)
    setTotpOpen(true)
  }

  const handleTotpConfirm = () => {
    if (!pendingField) return
    doSave(pendingField, isRemoval ? null : pendingData)
  }

  const renderCard = (field: 'officialStamp' | 'officialSignature', label: string) => {
    const inputRef = field === 'officialStamp' ? stampInputRef : sigInputRef
    const value = credentials[field]
    return (
      <Box key={field} sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#00288e', mb: 1.25, fontFamily: 'Jost' }}>
          {label}
        </Typography>
        <Box
          sx={{
            height: 144,
            border: value ? '1px solid #e4dff2' : '2px dashed #cbd5e1',
            bgcolor: '#fafbfc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1.5,
            overflow: 'hidden',
            backgroundImage: value
              ? 'linear-gradient(45deg, #ebebeb 25%, transparent 25%), linear-gradient(-45deg, #ebebeb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ebebeb 75%), linear-gradient(-45deg, transparent 75%, #ebebeb 75%)'
              : 'none',
            backgroundSize: value ? '16px 16px' : 'auto',
            backgroundPosition: value ? '0 0, 0 8px, 8px -8px, -8px 0px' : 'auto',
          }}
        >
          {value ? (
            <Box
              component="img"
              src={value}
              alt={label}
              sx={{ maxHeight: 128, maxWidth: '100%', objectFit: 'contain' }}
            />
          ) : (
            <Box sx={{ textAlign: 'center', color: '#94a3b8' }}>
              <CloudUploadOutlinedIcon sx={{ fontSize: '2rem', mb: 0.5 }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: 'Jost' }}>
                No {label.toLowerCase()} uploaded
              </Typography>
            </Box>
          )}
        </Box>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange(field)}
        />
        {canEdit && (
          <Stack direction="row" spacing={1}>
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={saving}
              sx={{
                bgcolor: value ? '#f5f3fb' : colorPalette.primary,
                color: value ? colorPalette.primary : '#fff',
                border: `1px solid ${value ? colorPalette.primary + '40' : 'transparent'}`,
                px: 2,
                py: 0.75,
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 0,
                fontFamily: 'Jost',
                '&:hover': { bgcolor: value ? `${colorPalette.primary}12` : '#1e293b' },
                '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
              }}
            >
              {value ? 'Replace' : 'Upload'}
            </Button>
            {value && (
              <Button
                onClick={() => handleRemove(field)}
                disabled={saving}
                sx={{
                  color: '#ef4444',
                  border: '1px solid #fecaca',
                  bgcolor: '#fef2f2',
                  px: 1.75,
                  py: 0.75,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 0,
                  fontFamily: 'Jost',
                  '&:hover': { bgcolor: '#fee2e2' },
                  '&:disabled': { bgcolor: '#fef2f2', color: '#fca5a5' },
                }}
              >
                Remove
              </Button>
            )}
          </Stack>
        )}
      </Box>
    )
  }

  if (loading) return null

  const fieldLabel = pendingField === 'officialStamp' ? 'Official Stamp' : 'Official Signature'

  return (
    <>
      <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', gridColumn: { xs: '1', lg: '1 / -1' } }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <GavelOutlinedIcon sx={{ fontSize: '1.1rem', color: colorPalette.primary }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
              Filing Credentials
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              Official stamp and signature embedded in NFIU report filings and compliance documents
            </Typography>
          </Box>
          {!canEdit && <Chip icon={<LockOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />} label="View only" size="small" sx={{ bgcolor: '#f8fafc', color: '#94a3b8', fontWeight: 600, fontSize: '0.625rem', borderRadius: '3px', height: 20 }} />}
        </Box>
        <Box sx={{ p: 3 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={3}
            divider={<Box sx={{ width: '1px', bgcolor: '#eef0f4', display: { xs: 'none', md: 'block' } }} />}
            sx={{ mb: 3 }}
          >
            {renderCard('officialStamp', 'Official Stamp')}
            {renderCard('officialSignature', 'Official Signature')}
          </Stack>

          <Box sx={{ display: 'flex', gap: 1.5, p: 2, bgcolor: '#f0f9ff', border: '1px solid #bae6fd' }}>
            <Typography sx={{ fontSize: '1rem', lineHeight: 1, pt: 0.25, flexShrink: 0 }}>💡</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0369a1', mb: 0.375, fontFamily: 'Jost' }}>
                Use PNG with transparent background
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#0369a1', lineHeight: 1.6 }}>
                Images with a white background will obscure document content when placed on a report. Export or scan as{' '}
                <Box component="span" sx={{ fontWeight: 700 }}>PNG with transparency</Box> so they blend cleanly onto the filing letterhead.
                Tools like Photoshop, GIMP, or Remove.bg can strip the background in seconds.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <TOTPConfirmation
        open={totpOpen}
        onClose={() => { setTotpOpen(false); setPendingField(null); setPendingData(null); setIsRemoval(false) }}
        onConfirm={handleTotpConfirm}
        operation={isRemoval ? 'delete' : 'update'}
        title={isRemoval ? `Remove ${fieldLabel}` : `Replace ${fieldLabel}`}
        description={
          isRemoval
            ? `You are about to permanently remove the ${fieldLabel.toLowerCase()} from all future report filings. Confirm your identity to proceed.`
            : `You are replacing the existing ${fieldLabel.toLowerCase()} that appears on official NFIU filings. Confirm your identity to proceed.`
        }
        resourceType="Filing Credentials"
        resourceName={fieldLabel}
      />
    </>
  )
}

function KycReEvaluationSection() {
  const { can } = useRbac()
  const canEdit = can('kyc.config')
  const [evalConfig, setEvalConfig] = useState<KycEvaluationConfig | null>(null)
  const [evalEnabled, setEvalEnabled] = useState(true)
  const [evalInterval, setEvalInterval] = useState<7 | 14 | 21 | 31>(31)
  const [evalSaving, setEvalSaving] = useState(false)
  const [evalSaveStatus, setEvalSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [evalSaveError, setEvalSaveError] = useState<string | null>(null)

  useEffect(() => {
    kycApi.getEvaluationConfig().then(res => {
      if (res.config) {
        setEvalConfig(res.config)
        setEvalEnabled(res.config.enabled)
        setEvalInterval(res.config.intervalDays)
      }
    }).catch(() => {})
  }, [])

  return (
    <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', gridColumn: { xs: '1', lg: '1 / -1' } }}>
      <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <RefreshRoundedIcon sx={{ fontSize: '1.1rem', color: colorPalette.primary }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            Customer Re-evaluation Schedule
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Configure when the KYC pipeline should automatically re-run for existing customers
          </Typography>
        </Box>
        {!canEdit && <Chip icon={<LockOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />} label="View only" size="small" sx={{ bgcolor: '#f8fafc', color: '#94a3b8', fontWeight: 600, fontSize: '0.625rem', borderRadius: '3px', height: 20 }} />}
      </Box>

      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6, mb: 2.5, p: 2, bgcolor: '#f0f9ff', border: '1px solid #bae6fd' }}>
          After every transaction beam, if a customer's last KYC evaluation is older than the selected interval, the system will automatically re-run the full KYC pipeline and update their risk scores.
        </Typography>

        {/* Enable toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, p: 2, border: '1px solid #eef0f4', bgcolor: '#fafbfc' }}>
          <Box>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost', mb: 0.25 }}>
              Enable automatic re-evaluation
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              When enabled, customers are re-evaluated based on the interval below
            </Typography>
          </Box>
          <Box
            onClick={canEdit ? () => setEvalEnabled(v => !v) : undefined}
            sx={{
              width: 34, height: 18, borderRadius: 10,
              bgcolor: evalEnabled ? colorPalette.primary : '#e2e8f0',
              position: 'relative', cursor: canEdit ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', flexShrink: 0,
              opacity: canEdit ? 1 : 0.5,
              '&::after': {
                content: '""', position: 'absolute', top: 2,
                left: evalEnabled ? 18 : 2, width: 14, height: 14,
                borderRadius: '50%', bgcolor: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }
            }}
          />
        </Box>

        {/* Interval picker */}
        <Box sx={{ mb: 2.5, opacity: !canEdit ? 0.5 : evalEnabled ? 1 : 0.4, transition: 'opacity 0.2s', pointerEvents: (!canEdit || !evalEnabled) ? 'none' : 'auto' }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.25 }}>
            Re-evaluation Interval
          </Typography>
          <RadioGroup
            row
            value={String(evalInterval)}
            onChange={e => setEvalInterval(Number(e.target.value) as 7 | 14 | 21 | 31)}
            sx={{ gap: 1, flexWrap: 'wrap' }}
          >
            {([7, 14, 21, 31] as const).map(days => (
              <Box
                key={days}
                onClick={() => evalEnabled && setEvalInterval(days)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  px: 1.75, py: 1, cursor: 'pointer', border: '1px solid',
                  borderColor: evalInterval === days ? colorPalette.primary : '#e2e8f0',
                  bgcolor: evalInterval === days ? `${colorPalette.primary}08` : '#ffffff',
                  transition: 'all 0.15s',
                  '&:hover': evalEnabled ? { borderColor: colorPalette.primary } : {},
                }}
              >
                <Radio
                  value={String(days)}
                  size="small"
                  sx={{ p: 0, color: '#94a3b8', '&.Mui-checked': { color: colorPalette.primary } }}
                />
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: evalInterval === days ? 700 : 500, color: evalInterval === days ? colorPalette.primary : '#475569', fontFamily: 'Jost' }}>
                  {days} days
                </Typography>
              </Box>
            ))}
          </RadioGroup>
        </Box>

        {/* Current config display */}
        {evalConfig && (
          <Box sx={{ mb: 2.5, px: 2, py: 1.25, bgcolor: '#f8fafc', border: '1px solid #eef0f4', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>Current setting</Typography>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost' }}>
                {evalConfig.enabled ? `Every ${evalConfig.intervalDays} days` : 'Disabled'}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>Last updated</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>{new Date(evalConfig.updatedAt).toLocaleDateString()}</Typography>
            </Box>
          </Box>
        )}

        {evalSaveStatus === 'success' && (
          <Alert severity="success" sx={{ mb: 1.5, borderRadius: 0, fontSize: '0.8125rem' }}>
            Re-evaluation schedule saved successfully.
          </Alert>
        )}
        {evalSaveStatus === 'error' && (
          <Alert severity="error" sx={{ mb: 1.5, borderRadius: 0, fontSize: '0.8125rem' }}>
            {evalSaveError ?? 'Failed to save. Please try again.'}
          </Alert>
        )}

        <Button
          disabled={!canEdit || evalSaving}
          onClick={async () => {
            setEvalSaving(true)
            setEvalSaveStatus('idle')
            setEvalSaveError(null)
            try {
              const res = await kycApi.saveEvaluationConfig(evalInterval, evalEnabled)
              setEvalConfig(res.config)
              setEvalSaveStatus('success')
              setTimeout(() => setEvalSaveStatus('idle'), 4000)
            } catch (err) {
              setEvalSaveStatus('error')
              setEvalSaveError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
              setEvalSaving(false)
            }
          }}
          sx={{
            bgcolor: colorPalette.primary, color: '#ffffff',
            px: 3, py: 1.25, fontSize: '0.875rem', fontWeight: 700,
            fontFamily: 'Jost', borderRadius: 0, textTransform: 'none',
            boxShadow: 'none',
            '&:hover': { bgcolor: '#1e293b' },
            '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
          }}
        >
          {evalSaving ? 'Saving…' : 'Save Schedule'}
        </Button>
      </Box>
    </Box>
  )
}

function OrganizationSection() {
  const { can } = useRbac()
  const canEdit = can('institution.modify')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')
  const [cbnCode, setCbnCode] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [savedState, setSavedState] = useState({ cbnCode: '', contactPhone: '', address: '' })

  useEffect(() => {
    institutionApi.getProfile()
      .then(p => {
        setName(p.name ?? '')
        setCbnCode(p.cbnCode ?? '')
        setContactPhone(p.contactPhone ?? '')
        setAddress(p.address ?? '')
        setSavedState({ cbnCode: p.cbnCode ?? '', contactPhone: p.contactPhone ?? '', address: p.address ?? '' })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isDirty = cbnCode !== savedState.cbnCode || contactPhone !== savedState.contactPhone || address !== savedState.address

  const doSave = async () => {
    setSaving(true)
    try {
      const p = await institutionApi.updateProfile({ cbnCode: cbnCode || undefined, contactPhone: contactPhone || undefined, address: address || undefined })
      setName(p.name ?? name)
      setCbnCode(p.cbnCode ?? '')
      setContactPhone(p.contactPhone ?? '')
      setAddress(p.address ?? '')
      setSavedState({ cbnCode: p.cbnCode ?? '', contactPhone: p.contactPhone ?? '', address: p.address ?? '' })
    } catch {
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
      setSaveOpen(false)
    }
  }

  if (loading) return null

  return (
    <>
      <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', gridColumn: { xs: '1', lg: '1 / -1' } }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
              Organization
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              Profile and contact details for your institution
            </Typography>
          </Box>
          {!canEdit && <Chip icon={<LockOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />} label="View only" size="small" sx={{ bgcolor: '#f8fafc', color: '#94a3b8', fontWeight: 600, fontSize: '0.625rem', borderRadius: '3px', height: 20 }} />}
        </Box>
        <Stack sx={{ p: 3 }} gap={2.5}>
          <Box data-ai-analyzable="true" data-ai-description={`Organization Setting: Institution name. current value: ${name}.`}>
            <Typography sx={labelSx}>Institution name</Typography>
            <TextField fullWidth value={name} disabled sx={inputSx} />
          </Box>
          <Box data-ai-analyzable="true" data-ai-description={`Organization Setting: Regulator code (CBN). current value: ${cbnCode}.`}>
            <Typography sx={labelSx}>Regulator code (CBN)</Typography>
            <TextField fullWidth value={cbnCode} disabled={!canEdit} onChange={e => setCbnCode(e.target.value)} sx={inputSx} />
          </Box>
          <Box data-ai-analyzable="true" data-ai-description={`Organization Setting: Contact phone. current value: ${contactPhone}.`}>
            <Typography sx={labelSx}>Contact phone</Typography>
            <TextField fullWidth value={contactPhone} disabled={!canEdit} onChange={e => setContactPhone(e.target.value)} sx={inputSx} />
          </Box>
          <Box data-ai-analyzable="true" data-ai-description={`Organization Setting: Address. current value: ${address}.`}>
            <Typography sx={labelSx}>Address</Typography>
            <TextField fullWidth value={address} disabled={!canEdit} onChange={e => setAddress(e.target.value)} sx={inputSx} />
          </Box>
          {canEdit && isDirty && (
            <Button
              onClick={() => setSaveOpen(true)}
              disabled={saving}
              sx={{
                alignSelf: 'flex-start',
                bgcolor: colorPalette.primary, color: '#ffffff',
                px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600,
                fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none',
                '&:hover': { bgcolor: '#1e293b' },
                '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
              }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </Stack>
      </Box>

      <TOTPConfirmation
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onConfirm={doSave}
        operation="update"
        title="Save organization settings"
        description="Organization profile changes propagate to all NFIU and CBN report templates immediately. Confirm with your authenticator code."
        resourceType="Organization"
        resourceName={name}
        changes={[
          ...(cbnCode !== savedState.cbnCode ? [{ field: 'Regulator code', from: savedState.cbnCode || '—', to: cbnCode || '—' }] : []),
          ...(contactPhone !== savedState.contactPhone ? [{ field: 'Contact phone', from: savedState.contactPhone || '—', to: contactPhone || '—' }] : []),
          ...(address !== savedState.address ? [{ field: 'Address', from: savedState.address || '—', to: address || '—' }] : []),
        ]}
      />
    </>
  )
}

export default function SettingsPage() {
  const { can } = useRbac()
  const [geoFenceOpen, setGeoFenceOpen] = useState(false)
  return (
    <>
      <Box sx={{ p: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Manage
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Settings
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Organization profile, compliance configuration, and security settings
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
          {/* Organization */}
          <OrganizationSection />

          {/* AML Case Settings */}
          <AmlSettingsSection />

          {/* Beam Time Window */}
          <BeamWindowSection />

          {/* Eureka Companion */}
          <EurekaCompanionSection />

          {/* Timezone Configuration */}
          <TimezoneSection />

          {/* Developer Sandbox */}
          <DeveloperSandboxSection />

          {/* Filing Credentials */}
          <FilingCredentialsSection />

          {/* KYC Re-evaluation Schedule */}
          <KycReEvaluationSection />

          {/* Security — admin only */}
          {can('settings.modify') && (
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', gridColumn: { xs: '1', lg: '1 / -1' } }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <ShieldOutlinedIcon sx={{ fontSize: '1.1rem', color: colorPalette.primary }} />
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
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
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
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
          )}
        </Box>
      </Box>

      <GeoFenceDialog open={geoFenceOpen} onClose={() => setGeoFenceOpen(false)} />
    </>
  )
}
