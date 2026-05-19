import { Box, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { colorPalette } from '@/theme'

export interface BreadcrumbEntry {
  label: string
  path: string
  state?: Record<string, unknown>
}

interface Props {
  currentLabel?: string
}

export default function NavigationBreadcrumb({ currentLabel }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const navState = location.state as { breadcrumbs?: BreadcrumbEntry[] } | null
  const breadcrumbs = navState?.breadcrumbs

  if (!breadcrumbs?.length) return null

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mb: 2.5,
        pb: 2,
        borderBottom: '1px solid #f4f5f7',
        flexWrap: 'wrap',
      }}
    >
      <ArrowBackRoundedIcon sx={{ fontSize: '0.875rem', color: '#94a3b8', mr: 0.25 }} />
      {breadcrumbs.map((crumb, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            onClick={() =>
              navigate(crumb.path, crumb.state ? { state: crumb.state } : undefined)
            }
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: colorPalette.primary,
              fontFamily: 'Jost',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
              '&:hover': { textDecoration: 'underline', opacity: 0.75 },
            }}
          >
            {crumb.label}
          </Typography>
          <ChevronRightRoundedIcon sx={{ fontSize: '0.8125rem', color: '#cbd5e1' }} />
        </Box>
      ))}
      {currentLabel && (
        <Typography
          sx={{
            fontSize: '0.75rem',
            fontWeight: 500,
            color: '#64748b',
            fontFamily: 'Jost',
          }}
        >
          {currentLabel}
        </Typography>
      )}
    </Box>
  )
}
