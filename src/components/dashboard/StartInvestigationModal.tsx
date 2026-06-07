import { Box, Typography, Stack } from '@mui/material'
import { colorPalette } from '@/theme'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

interface Props {
  open: boolean
  caseId: string
  caseTitle?: string
  onClose: () => void
  onConfirm: () => void  // proceeds to TOTP
}

export default function StartInvestigationModal({ open, caseId, caseTitle, onClose, onConfirm }: Props) {
  if (!open) return null

  return (
    <>
      <Box
        onClick={onClose}
        sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)', zIndex: 1450 }}
      />
      <Box sx={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 480, bgcolor: 'var(--card-bg)', zIndex: 1451,
        boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
        animation: 'invFadeIn 0.2s ease',
        '@keyframes invFadeIn': {
          from: { opacity: 0, transform: 'translate(-50%, -48%)' },
          to:   { opacity: 1, transform: 'translate(-50%, -50%)' },
        },
      }}>
        {/* Header */}
        <Box sx={{ px: 2.5, pt: 2.25, pb: 1.75, borderBottom: '1px solid var(--border-col)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ width: 34, height: 34, bgcolor: `${colorPalette.primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PlayArrowRoundedIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                Start Investigation
              </Typography>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mt: 0.125 }}>
                Begin Active Investigation
              </Typography>
            </Box>
          </Box>
          <Box onClick={onClose} sx={{ cursor: 'pointer', color: '#94a3b8', mt: 0.25, '&:hover': { color: 'var(--on-surface-variant)' }, display: 'flex' }}>
            <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: 2.5, py: 2.25 }}>
          {/* Case reference */}
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Case
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', mt: 0.125 }}>
                {caseId}
              </Typography>
              {caseTitle && (
                <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', fontFamily: 'Jost', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                  {caseTitle}
                </Typography>
              )}
            </Box>
          </Box>

          {/* What happens */}
          <Stack gap={1.25} sx={{ mb: 2.5 }}>
            {[
              'This case will be formally moved to Investigating status',
              'The case will be auto-assigned to you as the responsible investigator',
              'SLA tracking begins immediately from this point',
              'An immutable audit entry is created in the case timeline',
            ].map((item, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: colorPalette.primary, mt: 0.625, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.5, fontFamily: 'Jost' }}>
                  {item}
                </Typography>
              </Box>
            ))}
          </Stack>

          {/* Note */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 1.25, bgcolor: `${colorPalette.primary}08`, border: `1px solid ${colorPalette.primary}20` }}>
            <InfoOutlinedIcon sx={{ fontSize: '0.875rem', color: colorPalette.primary, flexShrink: 0, mt: 0.125 }} />
            <Typography sx={{ fontSize: '0.75rem', color: colorPalette.primary, lineHeight: 1.5, fontFamily: 'Jost' }}>
              You will be asked to verify your identity with your Google Authenticator code before this action completes.
            </Typography>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2.5, pb: 2.25, display: 'flex', gap: 1, justifyContent: 'flex-end', borderTop: '1px solid var(--border-col)', pt: 1.75 }}>
          <Box onClick={onClose} sx={{
            px: 2, py: 0.875, border: '1px solid var(--border-col)', cursor: 'pointer',
            color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
            transition: 'all 0.15s', '&:hover': { borderColor: '#94a3b8', color: 'var(--on-surface-variant)' },
          }}>
            Cancel
          </Box>
          <Box onClick={onConfirm} sx={{
            display: 'flex', alignItems: 'center', gap: 0.75,
            px: 2.25, py: 0.875, cursor: 'pointer',
            bgcolor: colorPalette.primary, color: '#ffffff',
            fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost',
            transition: 'all 0.15s', '&:hover': { opacity: 0.88 },
          }}>
            <ShieldOutlinedIcon sx={{ fontSize: '0.875rem' }} />
            Begin Investigation
          </Box>
        </Box>
      </Box>
    </>
  )
}
