import { Dialog, DialogContent, Box, Typography, Button, Stack, IconButton, Zoom, Checkbox, FormControlLabel } from '@mui/material'
import { colorPalette } from '@/theme'
import CloseIcon from '@mui/icons-material/Close'
import { useState } from 'react'

interface LocationPermissionModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (doNotShowAgain: boolean) => void
}

const modalSx = {
  '& .MuiDialog-paper': {
    borderRadius: 0,
    maxWidth: '440px',
    width: '100%',
    m: 2,
    background: '#ffffff',
    boxShadow: '0 24px 64px rgba(15, 23, 42, 0.15)',
  },
}

const actionButtonSx = {
  py: '16px',
  fontSize: '0.9375rem',
  fontWeight: 600,
  fontFamily: 'Jost',
  borderRadius: 0,
  textTransform: 'none' as const,
  letterSpacing: '0.02em',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
}

export default function LocationPermissionModal({ open, onClose, onConfirm }: LocationPermissionModalProps) {
  const [doNotShow, setDoNotShow] = useState(false)

  const handleConfirm = () => {
    onConfirm(doNotShow)
  }

  const handleClose = () => {
    setDoNotShow(false)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      TransitionComponent={Zoom}
      sx={modalSx}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }
        }
      }}
    >
      <IconButton
        onClick={handleClose}
        sx={{
          position: 'absolute',
          right: 12,
          top: 12,
          color: '#94a3b8',
          '&:hover': { color: '#00288e', bgcolor: 'transparent' },
        }}
      >
        <CloseIcon sx={{ fontSize: '1.25rem' }} />
      </IconButton>

      <DialogContent sx={{ pt: 4, pb: 4, px: 5 }}>
        <Stack sx={{ gap: 3, alignItems: 'center', textAlign: 'center' }}>
          <Box>
            <Typography
              sx={{
                fontSize: '1.5rem',
                fontWeight: 700,
                fontFamily: 'Jost',
                color: '#00288e',
                letterSpacing: '-0.015em',
                mb: 1.5,
              }}
            >
              Location Verification Required
            </Typography>
            <Typography
              sx={{
                fontSize: '0.9375rem',
                color: '#64748b',
                lineHeight: 1.7,
                fontFamily: 'Jost',
              }}
            >
              To ensure the security of your account and comply with regulatory protocols,
              this application requires real-time location validation before granting portal access.
            </Typography>
          </Box>

          <Stack sx={{ width: '100%', gap: 1.5 }}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleConfirm}
              sx={{
                ...actionButtonSx,
                bgcolor: colorPalette.primary,
                color: '#ffffff',
                '&:hover': {
                  bgcolor: '#1e293b',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 24px rgba(45, 66, 255, 0.25)',
                },
              }}
            >
              Grant Access &amp; Proceed
            </Button>
          </Stack>

          {/* "Do not show this again" preference */}
          <Box
            sx={{
              width: '100%',
              bgcolor: '#f8fafc',
              border: '1px solid #eef0f4',
              px: 2,
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              textAlign: 'left',
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={doNotShow}
                  onChange={(e) => setDoNotShow(e.target.checked)}
                  size="small"
                  disableRipple
                  sx={{
                    color: '#cbd5e1',
                    '&.Mui-checked': { color: colorPalette.primary },
                    p: 0.5,
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: '0.8125rem', color: '#475569', fontFamily: 'Jost', fontWeight: 500 }}>
                  Do not show this again on this device
                </Typography>
              }
              sx={{ m: 0, gap: 1, alignItems: 'center' }}
            />
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
