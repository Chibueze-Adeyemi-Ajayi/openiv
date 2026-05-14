import {
  Alert,
  Box,
  Button,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
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
    description: '',
  })

  const update = <K extends keyof RequestAccessFormValues>(
    key: K,
    v: RequestAccessFormValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: v }))

  const isValid =
    values.institutionName.trim() &&
    values.contactName.trim() &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.contactEmail.trim())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isValid) onSubmit?.(values)
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
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack sx={{ gap: 2.5 }}>
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
              sx={inputSx}
            />
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

          <Box>
            <Typography sx={labelSx}>Contact Name</Typography>
            <TextField
              fullWidth
              placeholder="Full name of primary contact"
              value={values.contactName}
              onChange={(e) => update('contactName', e.target.value)}
              autoComplete="off"
              spellCheck={false}
              sx={inputSx}
            />
          </Box>

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
              sx={inputSx}
            />
          </Box>

          <Box>
            <Typography sx={labelSx}>Contact Phone (optional)</Typography>
            <TextField
              fullWidth
              placeholder="+234 ..."
              value={values.contactPhone}
              onChange={(e) => update('contactPhone', e.target.value)}
              autoComplete="off"
              spellCheck={false}
              sx={inputSx}
            />
          </Box>

          <Box>
            <Typography sx={labelSx}>What do you need access for? (optional)</Typography>
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
            disabled={!isValid || submitting}
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
