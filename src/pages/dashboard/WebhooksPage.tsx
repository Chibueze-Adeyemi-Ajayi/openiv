import { Box, Typography, Stack, Button, TextField, Switch, Chip, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { useState } from 'react'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#f5f3fb',
    borderRadius: 0,
    transition: 'all 0.2s ease',
    '& fieldset': { border: '1px solid transparent' },
    '&:hover fieldset': { borderColor: '#e4dff2' },
    '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
    '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
  },
  '& .MuiOutlinedInput-input': {
    fontSize: '0.875rem',
    fontFamily: 'SF Mono, Monaco, monospace',
    py: '14px',
    px: '14px',
    color: '#0f172a',
  },
}

const labelSx = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#475569',
  mb: 0.875,
  fontFamily: 'Jost',
}

const eventTypes = [
  { id: 'tx.flagged', label: 'Transaction flagged', desc: 'Fires when a transaction crosses a risk threshold' },
  { id: 'tx.blocked', label: 'Transaction blocked', desc: 'Fires when an inbound transaction is auto-blocked' },
  { id: 'case.opened', label: 'Case opened', desc: 'Fires when an investigation case is created' },
  { id: 'case.escalated', label: 'Case escalated', desc: 'Fires when a case is escalated to a senior officer' },
  { id: 'kyc.failed', label: 'KYC verification failed', desc: 'Fires when a customer fails identity verification' },
  { id: 'sar.filed', label: 'SAR/STR filed', desc: 'Fires after an NFIU report is successfully filed' },
]

const existingEndpoints = [
  { url: 'https://compliance.fcmb.com/openiv/hooks', events: 6, status: 'active', lastDelivery: '2 min ago', successRate: 99.8 },
  { url: 'https://siem.fcmb.com/api/openiv/v2', events: 4, status: 'active', lastDelivery: '14 min ago', successRate: 100 },
  { url: 'https://staging.fcmb.com/openiv', events: 2, status: 'paused', lastDelivery: '3 days ago', successRate: 87.4 },
]

export default function WebhooksPage() {
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['tx.flagged', 'case.opened', 'sar.filed'])
  const [createOpen, setCreateOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const mockSecret = 'whsec_8X4LdkR2pQnVm9fT3bAhNcW6yEsZ1Kj7oHuMxBvCqYwGzPiSfDtRlAaJk'

  const toggleEvent = (id: string) => {
    setSelectedEvents((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(mockSecret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: colorPalette.primary,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              mb: 0.75,
            }}
          >
            Configure
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Webhooks
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Stream OpenIV events to your SIEM, case-management, or core banking systems in real time
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' }, gap: 3 }}>
          {/* Main config */}
          <Stack gap={3}>
            {/* New Endpoint Form */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    Add new endpoint
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    OpenIV will sign every payload with HMAC-SHA256 using your signing secret
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ p: 3 }}>
                <Stack gap={2.5}>
                  <Box>
                    <Typography sx={labelSx}>Endpoint URL</Typography>
                    <TextField
                      fullWidth
                      placeholder="https://your-domain.com/webhooks/openiv"
                      sx={inputSx}
                    />
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>
                      Must be HTTPS. We retry with exponential backoff for up to 24 hours on 5xx responses.
                    </Typography>
                  </Box>

                  <Box>
                    <Typography sx={labelSx}>Description</Typography>
                    <TextField
                      fullWidth
                      placeholder="Production SIEM ingestion"
                      sx={{
                        ...inputSx,
                        '& .MuiOutlinedInput-input': {
                          ...inputSx['& .MuiOutlinedInput-input'],
                          fontFamily: 'Jost',
                        },
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography sx={labelSx}>Subscribe to events</Typography>
                    <Stack gap={0.75}>
                      {eventTypes.map((e) => {
                        const checked = selectedEvents.includes(e.id)
                        return (
                          <Box
                            key={e.id}
                            onClick={() => toggleEvent(e.id)}
                            sx={{
                              p: 1.75,
                              border: '1px solid',
                              borderColor: checked ? colorPalette.primary : '#eef0f4',
                              bgcolor: checked ? `${colorPalette.primary}06` : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              cursor: 'pointer',
                              transition: 'all 0.18s',
                              '&:hover': { borderColor: checked ? colorPalette.primary : '#cbd5e1' },
                            }}
                          >
                            <Box
                              sx={{
                                width: 16,
                                height: 16,
                                border: `1.5px solid ${checked ? colorPalette.primary : '#cbd5e1'}`,
                                bgcolor: checked ? colorPalette.primary : '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {checked && <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#ffffff' }} />}
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost' }}>
                                {e.label}
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                                {e.desc}
                              </Typography>
                            </Box>
                            <Typography
                              sx={{
                                fontSize: '0.6875rem',
                                fontFamily: 'SF Mono, Monaco, monospace',
                                color: '#94a3b8',
                                bgcolor: '#f8fafc',
                                px: 1,
                                py: 0.375,
                              }}
                            >
                              {e.id}
                            </Typography>
                          </Box>
                        )
                      })}
                    </Stack>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button
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
                      Send Test Event
                    </Button>
                    <Button
                      onClick={() => setCreateOpen(true)}
                      startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                      sx={{
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
                      Create Endpoint
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </Box>

            {/* Active Endpoints */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  Active endpoints ({existingEndpoints.length})
                </Typography>
              </Box>
              {existingEndpoints.map((ep, i) => (
                <Box
                  key={i}
                  sx={{
                    px: 3,
                    py: 2,
                    borderBottom: i === existingEndpoints.length - 1 ? 'none' : '1px solid #f4f5f7',
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 90px 120px 100px 32px',
                    gap: 2,
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.8125rem',
                      fontFamily: 'SF Mono, Monaco, monospace',
                      color: '#0f172a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ep.url}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{ep.events} events</Typography>
                  <Chip
                    label={ep.status.toUpperCase()}
                    size="small"
                    sx={{
                      bgcolor: ep.status === 'active' ? '#f0fdf4' : '#fef3c7',
                      color: ep.status === 'active' ? '#10b981' : '#b45309',
                      fontWeight: 700,
                      fontSize: '0.625rem',
                      letterSpacing: '0.1em',
                      borderRadius: 0,
                      height: 20,
                      width: 'fit-content',
                    }}
                  />
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{ep.lastDelivery}</Typography>
                  <Typography
                    sx={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: ep.successRate >= 99 ? '#10b981' : ep.successRate >= 95 ? '#f59e0b' : '#dc2626',
                      fontFamily: 'SF Mono, Monaco, monospace',
                    }}
                  >
                    {ep.successRate}%
                  </Typography>
                  <IconButton size="small" disableRipple sx={{ borderRadius: 0, color: '#94a3b8' }}>
                    <MoreHorizRoundedIcon sx={{ fontSize: '1.125rem' }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          </Stack>

          {/* Sidebar - Signing secret */}
          <Stack gap={3}>
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 3 }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>
                Signing Secret
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 2 }}>
                Use this secret to verify the HMAC-SHA256 signature on every webhook delivery.
              </Typography>

              <Box
                sx={{
                  bgcolor: '#0f172a',
                  color: '#e2e8f0',
                  p: 1.75,
                  fontFamily: 'SF Mono, Monaco, monospace',
                  fontSize: '0.75rem',
                  wordBreak: 'break-all',
                  mb: 1.25,
                  position: 'relative',
                }}
              >
                {showSecret ? mockSecret : '•'.repeat(48)}
              </Box>

              <Stack direction="row" gap={1}>
                <Button
                  startIcon={
                    showSecret ? (
                      <VisibilityOffOutlinedIcon sx={{ fontSize: '1rem !important' }} />
                    ) : (
                      <VisibilityOutlinedIcon sx={{ fontSize: '1rem !important' }} />
                    )
                  }
                  onClick={() => setShowSecret(!showSecret)}
                  sx={{
                    flex: 1,
                    bgcolor: '#ffffff',
                    color: '#475569',
                    border: '1px solid #e5e7eb',
                    px: 1.75,
                    py: 1,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#f8fafc' },
                  }}
                >
                  {showSecret ? 'Hide' : 'Reveal'}
                </Button>
                <Button
                  startIcon={
                    copied ? (
                      <CheckRoundedIcon sx={{ fontSize: '1rem !important' }} />
                    ) : (
                      <ContentCopyOutlinedIcon sx={{ fontSize: '1rem !important' }} />
                    )
                  }
                  onClick={handleCopy}
                  sx={{
                    flex: 1,
                    bgcolor: copied ? '#10b981' : colorPalette.primary,
                    color: '#ffffff',
                    px: 1.75,
                    py: 1,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: copied ? '#10b981' : '#1a3896' },
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </Stack>

              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eef0f4' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                    Auto-rotate every 90 days
                  </Typography>
                  <Switch
                    defaultChecked
                    size="small"
                    sx={{
                      '& .MuiSwitch-track': { borderRadius: 8 },
                      '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                      '& .Mui-checked .MuiSwitch-thumb': { color: '#ffffff' },
                    }}
                  />
                </Box>
                <Button
                  onClick={() => setRotateOpen(true)}
                  startIcon={<RefreshRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: colorPalette.primary,
                    fontFamily: 'Jost',
                    textTransform: 'none',
                    p: 0,
                    '&:hover': { bgcolor: 'transparent', opacity: 0.75 },
                  }}
                >
                  Rotate now
                </Button>
              </Box>
            </Box>

            {/* Verification snippet */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 3 }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>
                Verify a payload
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 2 }}>
                Sample Node.js verification snippet
              </Typography>
              <Box
                sx={{
                  bgcolor: '#0f172a',
                  color: '#e2e8f0',
                  p: 1.75,
                  fontFamily: 'SF Mono, Monaco, monospace',
                  fontSize: '0.6875rem',
                  lineHeight: 1.6,
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                }}
              >
{`const sig = req.headers['x-openiv-signature']
const hash = crypto
  .createHmac('sha256', process.env.OPENIV_SECRET)
  .update(req.rawBody)
  .digest('hex')

if (sig !== hash) return res.sendStatus(401)`}
              </Box>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* TOTP — create endpoint */}
      <TOTPConfirmation
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onConfirm={() => setCreateOpen(false)}
        operation="create"
        title="Create webhook endpoint"
        description="You're creating a new outbound webhook that will receive sensitive event payloads from OpenIV. Verify with your authenticator code to authorize."
        resourceType="Webhook endpoint"
        resourceName="https://your-domain.com/webhooks/openiv"
      />

      {/* TOTP — rotate signing secret */}
      <TOTPConfirmation
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        onConfirm={() => setRotateOpen(false)}
        operation="update"
        title="Rotate signing secret"
        description="Rotating the signing secret will immediately invalidate the existing one. All endpoints must be updated with the new secret to keep verifying signatures correctly."
        resourceType="Signing secret"
        resourceName="whsec_••••••••••••••AaJk"
      />
    </DashboardLayout>
  )
}
