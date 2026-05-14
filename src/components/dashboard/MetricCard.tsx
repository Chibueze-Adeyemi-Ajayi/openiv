import { Box, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'

interface MetricCardProps {
  label: string
  value: string
  trend?: number
  trendLabel?: string
  invertTrend?: boolean // for risk metrics where down is good
  icon?: React.ReactNode
  sparkline?: number[]
}

export default function MetricCard({ label, value, trend, trendLabel, invertTrend, icon, sparkline }: MetricCardProps) {
  const isPositive = trend !== undefined && trend > 0
  const isGood = invertTrend ? !isPositive : isPositive
  const trendColor = trend === undefined ? '#94a3b8' : isGood ? '#10b981' : '#dc2626'

  return (
    <Box
      data-ai-analyzable="true"
      data-ai-description={`${label} metric: currently ${value}${trend !== undefined ? ` with a ${trend}% ${trendLabel}` : ''}.`}
      sx={{
        bgcolor: '#ffffff',
        border: '1px solid #eef0f4',
        p: 2.5,
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: '#dbe1ea',
          boxShadow: '0 4px 12px rgba(15,23,42,0.04)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
          {label}
        </Typography>
        {icon && (
          <Box
            sx={{
              width: 28,
              height: 28,
              bgcolor: `${colorPalette.primary}08`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colorPalette.primary,
            }}
          >
            {icon}
          </Box>
        )}
      </Box>

      <Typography
        sx={{
          fontSize: '1.875rem',
          fontWeight: 700,
          color: '#00288e',
          lineHeight: 1.1,
          fontFamily: 'Jost',
          letterSpacing: '-0.02em',
          mb: 1,
        }}
      >
        {value}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {trend !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {isPositive ? (
              <TrendingUpRoundedIcon sx={{ fontSize: '0.875rem', color: trendColor }} />
            ) : (
              <TrendingDownRoundedIcon sx={{ fontSize: '0.875rem', color: trendColor }} />
            )}
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: trendColor }}>
              {Math.abs(trend)}%
            </Typography>
            {trendLabel && (
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', ml: 0.25 }}>
                {trendLabel}
              </Typography>
            )}
          </Box>
        )}

        {sparkline && (
          <Box component="svg" viewBox="0 0 80 24" sx={{ width: 80, height: 24 }}>
            <polyline
              fill="none"
              stroke={trendColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparkline
                .map((v, i) => `${(i / (sparkline.length - 1)) * 78 + 1},${24 - (v / Math.max(...sparkline)) * 22 - 1}`)
                .join(' ')}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}
