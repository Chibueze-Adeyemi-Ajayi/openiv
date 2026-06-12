import {
  Alert,
  Box,
  Button,
  InputAdornment,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { colorPalette } from '@/theme'
import { useState } from 'react'
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
  submitting?: boolean
  errorMessage?: string | null
  succeeded?: boolean
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    fontFamily: 'Jost',
    fontSize: '0.9375rem',
    color: '#000000',
    '& fieldset': {
      borderColor: '#e2e8f0',
      transition: 'all 0.2s ease',
    },
    '&:hover fieldset': {
      borderColor: '#00288e',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#00288e',
      borderWidth: '1px',
    },
    '&.Mui-focused': {
      boxShadow: '0 0 0 4px rgba(0, 40, 142, 0.08)',
    },
    '& input::placeholder': {
      color: '#94a3b8',
      opacity: 1,
    },
  },
  '& .MuiOutlinedInput-input': {
    py: '20px',
    px: '20px',
  },
  '& .MuiInputBase-multiline': { p: 0 },
  '& .MuiInputBase-multiline .MuiInputBase-input': { py: '18px', px: '20px' },
}

const labelSx = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#475569',
  mb: 1,
  fontFamily: 'Jost',
}

const errorSx = {
  fontSize: '0.75rem',
  color: '#dc2626',
  mt: 0.75,
  fontFamily: 'Jost',
}

const errorInputSx = {
  ...{},
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    fontFamily: 'Jost',
    fontSize: '0.9375rem',
    color: '#000000',
    '& fieldset': { borderColor: '#dc2626', transition: 'all 0.2s ease' },
    '&:hover fieldset': { borderColor: '#dc2626' },
    '&.Mui-focused fieldset': { borderColor: '#dc2626', borderWidth: '1px' },
    '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(220, 38, 38, 0.08)' },
    '& input::placeholder': { color: '#94a3b8', opacity: 1 },
  },
  '& .MuiOutlinedInput-input': { py: '20px', px: '20px' },
  '& .MuiInputBase-multiline': { p: 0 },
  '& .MuiInputBase-multiline .MuiInputBase-input': { py: '18px', px: '20px' },
}

const primaryButtonSx = {
  bgcolor: colorPalette.primary,
  color: '#ffffff',
  py: '20px',
  fontSize: '0.9375rem',
  fontWeight: 600,
  fontFamily: 'Jost',
  borderRadius: 0,
  textTransform: 'none' as const,
  letterSpacing: '0.02em',
  boxShadow: 'none',
  '&:hover:not(:disabled)': {
    bgcolor: '#1e40af',
    boxShadow: `0 8px 24px rgba(0, 40, 142, 0.25)`,
  },
  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
}

export default function RequestAccessForm({
  onSubmit,
  submitting = false,
  errorMessage = null,
  succeeded = false,
}: RequestAccessFormProps) {
  const [values, setValues] = useState<RequestAccessFormValues>({
    institutionName: '',
    institutionType: 'COMPANY',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    jobTitle: '',
    description: '',
  })

  type FieldErrors = Partial<Record<'institutionName' | 'contactName' | 'contactEmail' | 'contactPhone', string>>
  const [errors, setErrors] = useState<FieldErrors>({})

  const update = <K extends keyof RequestAccessFormValues>(
    key: K,
    v: RequestAccessFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: v }))
    // Clear the inline error for this field as soon as the user starts editing
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // Strip the user's input down to digits-only and prepend +234 on submit.
  // This way the value the user sees ('801 234 5678') is just their local number.
  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/\D+/g, '').replace(/^234/, '').replace(/^0+/, '')
    return digits.length === 0 ? '' : '+234' + digits
  }

  const validate = (v: RequestAccessFormValues): FieldErrors => {
    const e: FieldErrors = {}
    if (!v.institutionName.trim()) e.institutionName = 'Institution name is required'
    if (!v.contactName.trim())     e.contactName     = 'Contact name is required'
    const email = v.contactEmail.trim()
    if (!email) e.contactEmail = 'Email address is required'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.contactEmail = 'Enter a valid email address'
    const phoneDigits = v.contactPhone.replace(/\D+/g, '').replace(/^234/, '').replace(/^0+/, '')
    if (phoneDigits && (phoneDigits.length < 7 || phoneDigits.length > 11)) {
      e.contactPhone = 'Enter a valid Nigerian phone number'
    }
    return e
  }

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault()
    const fieldErrors = validate(values)
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }
    onSubmit?.({ ...values, contactPhone: normalizePhone(values.contactPhone) })
  }

  if (succeeded) {
    return (
      <Stack sx={{ gap: 3, width: '100%', position: 'relative' }}>
        <Box>
          <Typography
            sx={{
              fontSize: '1.625rem',
              fontWeight: 700,
              fontFamily: 'Jost',
              color: '#00288e',
              letterSpacing: '-0.015em',
              mb: 0.75,
            }}
          >
            Request Received
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6 }}>
            Thanks — your access request is in our queue. Our compliance team will reach out
            to <Box component="span" sx={{ color: '#00288e', fontWeight: 600 }}>{values.contactEmail}</Box>{' '}
            within one business day.
          </Typography>
        </Box>
      </Stack>
    )
  }

  return (
    <Stack sx={{ gap: 4, width: '100%', position: 'relative' }}>
      <Box>
        <Typography
          sx={{
            fontSize: '1.625rem',
            fontWeight: 700,
            fontFamily: 'Jost',
            color: '#00288e',
            letterSpacing: '-0.015em',
            mb: 0.75,
          }}
        >
          Request Access
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6 }}>
          Tell us about your institution. A compliance reviewer will follow up with an
          invitation if approved.
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8', mt: 1 }}>
          Already have access?{' '}
          <Link component={RouterLink} to="/auth/login" sx={{ color: colorPalette.primary, fontWeight: 600, textDecoration: 'none', '&:hover': { opacity: 0.75 } }}>
            Sign in →
          </Link>
        </Typography>
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack sx={{ gap: 2.5 }}>
          {/* Row 1: Institution Name + Type */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography sx={labelSx}>Institution Name</Typography>
              <TextField
                fullWidth
                placeholder="Acme Bank Plc."
                value={values.institutionName}
                onChange={(e) => update('institutionName', e.target.value)}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                sx={errors.institutionName ? errorInputSx : inputSx}
              />
              {errors.institutionName && <Typography sx={errorSx}>{errors.institutionName}</Typography>}
            </Box>
            <Box>
              <Typography sx={labelSx}>Institution Type</Typography>
              <Select
                fullWidth
                value={values.institutionType}
                onChange={(e) => update('institutionType', e.target.value as AccountType)}
                sx={{
                  bgcolor: '#f5f3fb',
                  borderRadius: 0,
                  fontFamily: 'Jost',
                  '& fieldset': { border: '1px solid transparent' },
                  '&:hover fieldset': { borderColor: '#e4dff2' },
                  '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
                  '& .MuiSelect-select': { py: '18px', px: '20px' },
                }}
              >
                <MenuItem value="COMPANY">Company / Financial Institution</MenuItem>
                <MenuItem value="INDIVIDUAL">Individual</MenuItem>
                <MenuItem value="REGULATOR">Regulator</MenuItem>
              </Select>
            </Box>
          </Box>

          {/* Row 2: Contact Name + Job Title */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography sx={labelSx}>Contact Name</Typography>
              <TextField
                fullWidth
                placeholder="Full name of primary contact"
                value={values.contactName}
                onChange={(e) => update('contactName', e.target.value)}
                autoComplete="off"
                spellCheck={false}
                sx={errors.contactName ? errorInputSx : inputSx}
              />
              {errors.contactName && <Typography sx={errorSx}>{errors.contactName}</Typography>}
            </Box>
            <Box>
              <Typography sx={labelSx}>
                Job Title / Role{' '}
                <Box component="span" sx={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</Box>
              </Typography>
              <TextField
                fullWidth
                placeholder="e.g. CTO, Head of Compliance"
                value={values.jobTitle}
                onChange={(e) => update('jobTitle', e.target.value)}
                autoComplete="off"
                spellCheck={false}
                sx={inputSx}
              />
            </Box>
          </Box>

          {/* Row 3: Contact Email + Phone */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography sx={labelSx}>Contact Email</Typography>
              <TextField
                fullWidth
                type="email"
                placeholder="name@institution.com"
                value={values.contactEmail}
                onChange={(e) => update('contactEmail', e.target.value)}
                autoComplete="off"
                spellCheck={false}
                sx={errors.contactEmail ? errorInputSx : inputSx}
              />
              {errors.contactEmail && <Typography sx={errorSx}>{errors.contactEmail}</Typography>}
            </Box>
            <Box>
              <Typography sx={labelSx}>
                Phone{' '}
                <Box component="span" sx={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</Box>
              </Typography>
              <TextField
                fullWidth
                placeholder="801 234 5678"
                value={values.contactPhone}
                onChange={(e) => {
                  // Accept digits, spaces, dashes — store as the user typed, strip on submit
                  const cleaned = e.target.value.replace(/[^\d\s-]/g, '')
                  update('contactPhone', cleaned)
                }}
                autoComplete="tel-national"
                spellCheck={false}
                inputMode="tel"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 1.5 }}>
                        <Box sx={{
                          display: 'flex', alignItems: 'center', gap: 0.75,
                          fontFamily: 'Jost', fontSize: '0.9375rem',
                          color: '#0f172a', fontWeight: 600,
                        }}>
                          <Box component="span" sx={{ fontSize: '1.05rem', lineHeight: 1 }}>🇳🇬</Box>
                          <Box component="span">+234</Box>
                        </Box>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={errors.contactPhone ? errorInputSx : inputSx}
              />
              {errors.contactPhone && <Typography sx={errorSx}>{errors.contactPhone}</Typography>}
            </Box>
          </Box>

          {/* Row 4: Description — full width */}
          <Box>
            <Typography sx={labelSx}>
              What do you need access for?{' '}
              <Box component="span" sx={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</Box>
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={6}
              placeholder="Briefly describe your use case so we can route your request."
              value={values.description}
              onChange={(e) => update('description', e.target.value)}
              sx={inputSx}
            />
          </Box>

          <Button
            fullWidth
            type="submit"
            disabled={submitting}
            sx={{ ...primaryButtonSx, mt: 1 }}
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </Button>
        </Stack>
      </form>

      {submitting && <FormLoadingOverlay />}
    </Stack>
  )
}
