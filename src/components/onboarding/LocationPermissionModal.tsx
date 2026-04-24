import { Dialog, DialogContent, Box, Typography, Button, Stack, IconButton, Zoom } from '@mui/material'
import { colorPalette } from '@/theme'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import CloseIcon from '@mui/icons-material/Close'

interface LocationPermissionModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
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
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      TransitionComponent={Zoom}
      sx={modalSx}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }
        }
      }}
    >

      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 12,
          top: 12,
          color: '#94a3b8',
          '&:hover': { color: '#0f172a', bgcolor: 'transparent' },
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
                color: '#0f172a',
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
                fontFamily: 'Jost'
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
              onClick={onConfirm}
              sx={{
                ...actionButtonSx,
                bgcolor: colorPalette.primary,
                color: '#ffffff',
                '&:hover': {
                  bgcolor: '#1a3896',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 24px rgba(45, 66, 255, 0.25)',
                },
              }}
            >
              Grant Access & Proceed
            </Button>
            <Button
              fullWidth
              onClick={onClose}
              sx={{
                ...actionButtonSx,
                color: '#64748b',
                '&:hover': {
                  color: '#0f172a',
                  bgcolor: '#f8fafc',
                },
              }}
            >
              Cancel Authorization
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
