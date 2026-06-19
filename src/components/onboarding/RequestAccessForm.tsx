import {
  Alert,
  Box,
  Button,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import PhoneIphoneOutlinedIcon from '@mui/icons-material/PhoneIphoneOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import FolderSpecialOutlinedIcon from '@mui/icons-material/FolderSpecialOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined'
import CheckIcon from '@mui/icons-material/Check'
import { Link as RouterLink } from 'react-router-dom'
import { colorPalette } from '@/theme'
import React, { useState } from 'react'
import FormLoadingOverlay from './FormLoadingOverlay'
import type { AccountType } from '@/api/auth'

export interface RequestAccessFormValues {
  institutionName: string
  institutionType: AccountType
  contactName: string
  contactEmail: string
  contactPhone: string
  jobTitle: string
  description: string
}

interface RequestAccessFormProps {
  onSubmit?: (values: RequestAccessFormValues) => void
  onStepChange?: (step: number) => void
  submitting?: boolean
  errorMessage?: string | null
  succeeded?: boolean
}

// ─── shared styles ───────────────────────────────────────────────────────────

const FONT = 'Jost'
const C = colorPalette

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 0, fontFamily: FONT, fontSize: '0.9375rem', color: '#000',
    '& fieldset': { borderColor: '#e2e8f0', transition: 'all 0.2s ease' },
    '&:hover fieldset': { borderColor: C.primary },
    '&.Mui-focused fieldset': { borderColor: C.primary, borderWidth: '1px' },
    '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(0, 40, 142, 0.08)' },
    '& input::placeholder': { color: '#94a3b8', opacity: 1 },
  },
  '& .MuiOutlinedInput-input': { py: '18px', px: '20px' },
}

const errorInputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 0, fontFamily: FONT, fontSize: '0.9375rem', color: '#000',
    '& fieldset': { borderColor: '#dc2626', transition: 'all 0.2s ease' },
    '&:hover fieldset': { borderColor: '#dc2626' },
    '&.Mui-focused fieldset': { borderColor: '#dc2626', borderWidth: '1px' },
    '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(220, 38, 38, 0.08)' },
    '& input::placeholder': { color: '#94a3b8', opacity: 1 },
  },
  '& .MuiOutlinedInput-input': { py: '18px', px: '20px' },
}

const labelSx = { fontSize: '0.875rem', fontWeight: 600, color: '#475569', mb: 0.875, fontFamily: FONT }
const errorSx = { fontSize: '0.75rem', color: '#dc2626', mt: 0.625, fontFamily: FONT }

const primaryButtonSx = {
  bgcolor: C.primary, color: '#fff',
  py: '18px', fontSize: '0.9375rem', fontWeight: 600, fontFamily: FONT,
  borderRadius: 0, textTransform: 'none' as const, letterSpacing: '0.02em',
  boxShadow: 'none',
  '&:hover:not(:disabled)': { bgcolor: '#1e40af', boxShadow: '0 8px 24px rgba(0,40,142,0.25)' },
  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
}

const ghostButtonSx = {
  color: '#64748b', py: '18px', fontSize: '0.9375rem', fontWeight: 600,
  fontFamily: FONT, borderRadius: 0, textTransform: 'none' as const,
  border: '1.5px solid #e2e8f0',
  '&:hover': { borderColor: C.primary, color: C.primary, bgcolor: 'transparent' },
}

// ─── feature catalogue ───────────────────────────────────────────────────────

const FEATURES = [
  {
    key: 'aml_monitoring',
    icon: PolicyOutlinedIcon,
    label: 'AML Monitoring',
    desc: 'Real-time detection of suspicious activity across all channels using 580+ adaptive behavioural rules.',
  },
  {
    key: 'txn_monitoring',
    icon: ReceiptLongOutlinedIcon,
    label: 'Transaction Monitoring',
    desc: 'Continuous screening of every transaction against velocity, threshold, and pattern-based controls.',
  },
  {
    key: 'cdd_edd',
    icon: VerifiedUserOutlinedIcon,
    label: 'CDD / EDD',
    desc: 'Tiered due diligence covering standard CDD, enhanced EDD for high-risk customers, and integrated PEP identification and sanctions matching.',
  },
  {
    key: 'reporting',
    icon: AssignmentOutlinedIcon,
    label: 'NFIU & CBN Reporting',
    desc: 'One-click STR/SAR generation for NFIU GoAML and auto-generated CBN AML/CFT compliance reports — both schema-compliant and examiner-ready.',
  },
  {
    key: 'case_management',
    icon: FolderSpecialOutlinedIcon,
    label: 'Case Management',
    desc: 'Collaborative investigation workspace with full evidence trails, task assignment, and audit log.',
  },
  {
    key: 'behavioural_analysis',
    icon: TimelineOutlinedIcon,
    label: 'Behavioural Analysis Realtime',
    desc: 'Live behavioural scoring that flags anomalous patterns in customer activity the moment they emerge.',
  },
  {
    key: 'eureka_ai',
    icon: AutoAwesomeOutlinedIcon,
    label: 'Eureka AI Analyst',
    desc: 'Natural language queries and AI-driven insights across your full compliance dataset.',
  },
]

// ─── institution type catalogue ──────────────────────────────────────────────

const INST_TYPES: { value: AccountType; icon: React.ElementType; label: string; desc: string }[] = [
  {
    value: 'COMPANY',
    icon: AccountBalanceOutlinedIcon,
    label: 'Bank / MFB',
    desc: 'Commercial bank, microfinance bank, or other licensed deposit-taking institution.',
  },
  {
    value: 'INDIVIDUAL',
    icon: PhoneIphoneOutlinedIcon,
    label: 'Fintech / PSP',
    desc: 'Payment service provider, digital lender, wallet operator, or licensed fintech.',
  },
  {
    value: 'REGULATOR',
    icon: GavelOutlinedIcon,
    label: 'Regulator / Government',
    desc: 'CBN, NFIU, EFCC, or any other supervisory or government body.',
  },
]

// ─── step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Your details', 'Your company', 'Feature interests']

function StepIndicator({ current }: { current: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, mb: 3.5 }}>
      {STEPS.map((label, i) => {
        const done    = i < current
        const active  = i === current
        return (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{
                width: 28, height: 28, borderRadius: '50%',
                bgcolor: done || active ? C.primary : 'transparent',
                border: `2px solid ${done || active ? C.primary : '#cbd5e1'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                {done
                  ? <CheckIcon sx={{ fontSize: 14, color: '#fff' }} />
                  : <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: FONT, color: active ? '#fff' : '#94a3b8' }}>{i + 1}</Typography>
                }
              </Box>
              <Typography sx={{
                fontSize: '0.6875rem', fontWeight: 600, fontFamily: FONT, whiteSpace: 'nowrap',
                color: done || active ? C.primary : '#94a3b8', transition: 'color 0.2s',
              }}>
                {label}
              </Typography>
            </Box>
            {i < STEPS.length - 1 && (
              <Box sx={{
                flex: 1, height: 2, mx: 1, mb: '18px',
                bgcolor: i < current ? C.primary : '#e2e8f0',
                transition: 'background-color 0.2s',
              }} />
            )}
          </Box>
        )
      })}
    </Box>
  )
}

// ─── feature card ─────────────────────────────────────────────────────────────

function FeatureCard({
  feature, selected, onToggle,
}: {
  feature: typeof FEATURES[number]
  selected: boolean
  onToggle: () => void
}) {
  const Icon = feature.icon
  return (
    <Box
      onClick={onToggle}
      sx={{
        p: 2, border: `1.5px solid ${selected ? C.primary : '#e2e8f0'}`,
        bgcolor: selected ? 'rgba(0,40,142,0.04)' : '#fff',
        cursor: 'pointer', position: 'relative', transition: 'all 0.15s',
        '&:hover': { borderColor: C.primary, bgcolor: 'rgba(0,40,142,0.03)' },
        userSelect: 'none',
      }}
    >
      {selected && (
        <Box sx={{
          position: 'absolute', top: 8, right: 8,
          width: 18, height: 18, borderRadius: '50%',
          bgcolor: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckIcon sx={{ fontSize: 11, color: '#fff' }} />
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 0.75 }}>
        <Icon sx={{ fontSize: 18, color: selected ? C.primary : '#64748b', flexShrink: 0, transition: 'color 0.15s' }} />
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: FONT, color: selected ? C.primary : '#0f172a', lineHeight: 1.3 }}>
          {feature.label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.7rem', fontFamily: FONT, color: '#94a3b8', lineHeight: 1.45 }}>
        {feature.desc}
      </Typography>
    </Box>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function RequestAccessForm({
  onSubmit,
  onStepChange,
  submitting = false,
  errorMessage = null,
  succeeded = false,
}: RequestAccessFormProps) {
  const goToStep = (n: number) => { setStep(n); onStepChange?.(n) }
  const [step, setStep]   = useState(0)

  const [contactName,  setContactName]  = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [jobTitle,     setJobTitle]     = useState('')

  const [institutionName, setInstitutionName] = useState('')
  const [institutionType, setInstitutionType] = useState<AccountType>('COMPANY')

  const [features, setFeatures] = useState<Set<string>>(new Set(FEATURES.map(f => f.key)))

  type FieldErrors = Partial<Record<string, string>>
  const [errors, setErrors] = useState<FieldErrors>({})

  const clearErr = (k: string) => setErrors(prev => { const n = { ...prev }; delete n[k]; return n })

  const normalizePhone = (raw: string): string => {
    const d = raw.replace(/\D+/g, '').replace(/^234/, '').replace(/^0+/, '')
    return d.length === 0 ? '' : '+234' + d
  }

  const toggleFeature = (key: string) => {
    setFeatures(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const validateStep0 = (): FieldErrors => {
    const e: FieldErrors = {}
    if (!contactName.trim())  e.contactName  = 'Your name is required'
    const em = contactEmail.trim()
    if (!em)                  e.contactEmail = 'Work email is required'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) e.contactEmail = 'Enter a valid email address'
    const d = contactPhone.replace(/\D+/g, '').replace(/^234/, '').replace(/^0+/, '')
    if (d && (d.length < 7 || d.length > 11)) e.contactPhone = 'Enter a valid Nigerian phone number'
    return e
  }

  const validateStep1 = (): FieldErrors => {
    const e: FieldErrors = {}
    if (!institutionName.trim()) e.institutionName = 'Institution name is required'
    return e
  }

  const next = () => {
    if (step === 0) {
      const e = validateStep0(); if (Object.keys(e).length) { setErrors(e); return }
    }
    if (step === 1) {
      const e = validateStep1(); if (Object.keys(e).length) { setErrors(e); return }
    }
    setErrors({})
    goToStep(step + 1)
  }

  const handleSubmit = () => {
    const selectedLabels = FEATURES.filter(f => features.has(f.key)).map(f => f.label)
    const description = selectedLabels.length
      ? 'Interested in: ' + selectedLabels.join(', ')
      : ''
    onSubmit?.({
      institutionName: institutionName.trim(),
      institutionType,
      contactName:     contactName.trim(),
      contactEmail:    contactEmail.trim(),
      contactPhone:    normalizePhone(contactPhone),
      jobTitle:        jobTitle.trim(),
      description,
    })
  }

  if (succeeded) {
    return (
      <Stack sx={{ gap: 3, width: '100%' }}>
        <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckIcon sx={{ color: '#16a34a', fontSize: 24 }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, fontFamily: FONT, color: C.primary, letterSpacing: '-0.015em', mb: 0.75 }}>
            Request Received
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6 }}>
            Thanks — your access request is in our queue. Our compliance team will reach out to{' '}
            <Box component="span" sx={{ color: C.primary, fontWeight: 600 }}>{contactEmail}</Box>{' '}
            within one business day.
          </Typography>
        </Box>
      </Stack>
    )
  }

  return (
    <Stack sx={{ gap: 0, width: '100%', position: 'relative' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: FONT, color: C.primary, letterSpacing: '-0.015em', mb: 0.5 }}>
          Request a Demo
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: '#64748b', fontFamily: FONT }}>
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', mt: 0.375, fontFamily: FONT }}>
          Already have access?{' '}
          <Link component={RouterLink} to="/auth/login" sx={{ color: C.primary, fontWeight: 600, textDecoration: 'none', '&:hover': { opacity: 0.75 } }}>
            Sign in →
          </Link>
        </Typography>
      </Box>

      <StepIndicator current={step} />

      {errorMessage && (
        <Alert severity="error" sx={{ borderRadius: 0, mb: 2.5 }}>{errorMessage}</Alert>
      )}

      {/* ── Step 0: Your details ── */}
      {step === 0 && (
        <Stack sx={{ gap: 2.5 }}>
          <Box>
            <Typography sx={labelSx}>Full name</Typography>
            <TextField fullWidth placeholder="Ada Okonkwo"
              value={contactName} onChange={e => { setContactName(e.target.value); clearErr('contactName') }}
              autoFocus autoComplete="name" spellCheck={false}
              sx={errors.contactName ? errorInputSx : inputSx}
            />
            {errors.contactName && <Typography sx={errorSx}>{errors.contactName}</Typography>}
          </Box>

          <Box>
            <Typography sx={labelSx}>Work email</Typography>
            <TextField fullWidth type="email" placeholder="ada@yourbank.com"
              value={contactEmail} onChange={e => { setContactEmail(e.target.value); clearErr('contactEmail') }}
              autoComplete="email" spellCheck={false}
              sx={errors.contactEmail ? errorInputSx : inputSx}
            />
            {errors.contactEmail && <Typography sx={errorSx}>{errors.contactEmail}</Typography>}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography sx={labelSx}>
                Phone <Box component="span" sx={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</Box>
              </Typography>
              <TextField fullWidth placeholder="801 234 5678"
                value={contactPhone}
                onChange={e => { setContactPhone(e.target.value.replace(/[^\d\s-]/g, '')); clearErr('contactPhone') }}
                autoComplete="tel-national" inputMode="tel" spellCheck={false}
                slotProps={{ input: { startAdornment: (
                  <InputAdornment position="start" sx={{ mr: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontFamily: FONT, fontSize: '0.9375rem', color: '#0f172a', fontWeight: 600 }}>
                      <Box component="span" sx={{ fontSize: '1rem', lineHeight: 1 }}>🇳🇬</Box>
                      <Box component="span">+234</Box>
                    </Box>
                  </InputAdornment>
                ) } }}
                sx={errors.contactPhone ? errorInputSx : inputSx}
              />
              {errors.contactPhone && <Typography sx={errorSx}>{errors.contactPhone}</Typography>}
            </Box>
            <Box>
              <Typography sx={labelSx}>
                Job title <Box component="span" sx={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</Box>
              </Typography>
              <TextField fullWidth placeholder="Head of Compliance"
                value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                autoComplete="off" spellCheck={false} sx={inputSx}
              />
            </Box>
          </Box>

          <Button fullWidth onClick={next} sx={{ ...primaryButtonSx, mt: 0.5 }}>
            Continue →
          </Button>
        </Stack>
      )}

      {/* ── Step 1: Your company ── */}
      {step === 1 && (
        <Stack sx={{ gap: 2.5 }}>
          <Box>
            <Typography sx={labelSx}>Institution name</Typography>
            <TextField fullWidth placeholder="Acme Bank Plc."
              value={institutionName} onChange={e => { setInstitutionName(e.target.value); clearErr('institutionName') }}
              autoFocus autoComplete="organization" spellCheck={false}
              sx={errors.institutionName ? errorInputSx : inputSx}
            />
            {errors.institutionName && <Typography sx={errorSx}>{errors.institutionName}</Typography>}
          </Box>

          <Box>
            <Typography sx={labelSx}>Institution type</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.25 }}>
              {INST_TYPES.map(t => {
                const Icon = t.icon
                const selected = institutionType === t.value
                return (
                  <Box key={t.value} onClick={() => setInstitutionType(t.value)}
                    sx={{
                      p: 1.75, border: `1.5px solid ${selected ? C.primary : '#e2e8f0'}`,
                      bgcolor: selected ? 'rgba(0,40,142,0.04)' : '#fff',
                      cursor: 'pointer', position: 'relative', transition: 'all 0.15s',
                      '&:hover': { borderColor: C.primary, bgcolor: 'rgba(0,40,142,0.03)' },
                      userSelect: 'none',
                    }}
                  >
                    {selected && (
                      <Box sx={{ position: 'absolute', top: 7, right: 7, width: 16, height: 16,
                        borderRadius: '50%', bgcolor: C.primary,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckIcon sx={{ fontSize: 10, color: '#fff' }} />
                      </Box>
                    )}
                    <Icon sx={{ fontSize: 20, color: selected ? C.primary : '#64748b', mb: 0.875, transition: 'color 0.15s' }} />
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: FONT,
                      color: selected ? C.primary : '#0f172a', mb: 0.375, lineHeight: 1.3 }}>
                      {t.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.73rem', fontFamily: FONT, color: '#64748b', lineHeight: 1.45 }}>
                      {t.desc}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 0.5 }}>
            <Button onClick={() => goToStep(0)} sx={ghostButtonSx}>← Back</Button>
            <Button onClick={next} sx={primaryButtonSx}>Continue →</Button>
          </Box>
        </Stack>
      )}

      {/* ── Step 2: Feature interests ── */}
      {step === 2 && (
        <Stack sx={{ gap: 2.5 }}>
          <Typography sx={{ fontSize: '0.875rem', color: '#64748b', fontFamily: FONT, mt: -0.5 }}>
            Select the areas most relevant to your institution. This helps us tailor your demo.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.25 }}>
            {FEATURES.map(f => (
              <FeatureCard
                key={f.key}
                feature={f}
                selected={features.has(f.key)}
                onToggle={() => toggleFeature(f.key)}
              />
            ))}
          </Box>

          {features.size === 0 && (
            <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: FONT, textAlign: 'center' }}>
              Select at least one area to help us prepare a relevant demo.
            </Typography>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Button onClick={() => goToStep(1)} sx={ghostButtonSx}>← Back</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || features.size === 0}
              sx={primaryButtonSx}
            >
              {submitting ? 'Submitting…' : 'Request Demo'}
            </Button>
          </Box>
        </Stack>
      )}

      {submitting && <FormLoadingOverlay />}
    </Stack>
  )
}
