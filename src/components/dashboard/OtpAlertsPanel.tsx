import { Box, Typography, Skeleton, Tooltip } from '@mui/material'
import { colorPalette } from '@/theme'
import { useOtpAlerts, type OtpAlertItem } from '@/hooks/useOtpAlerts'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined'

type Rule = OtpAlertItem['rule']

const ruleConfig: Record<Rule, { label: string; shortLabel: string; color: string; bg: string }> = {
  FAILED_CASCADE:        { label: 'Failure Cascade',      shortLabel: 'CASCADE',   color: '#dc2626', bg: '#fef2f2' },
  OTP_BOMBING:           { label: 'OTP Bombing',           shortLabel: 'BOMBING',   color: '#dc2626', bg: '#fef2f2' },
  VELOCITY_SPIKE:        { label: 'Velocity Spike',        shortLabel: 'SPIKE',     color: '#f59e0b', bg: '#fffbeb' },
  NEW_DEVICE_SUSPICIOUS: { label: 'New Device Suspicious', shortLabel: 'NEW DEV',   color: '#f59e0b', bg: '#fffbeb' },
}

function ruleIcon(rule: Rule) {
  const sz = { fontSize: '0.9rem' }
  switch (rule) {
    case 'FAILED_CASCADE':        return <ErrorOutlineIcon sx={{ ...sz, color: '#dc2626' }} />
    case 'OTP_BOMBING':           return <BoltOutlinedIcon sx={{ ...sz, color: '#dc2626' }} />
    case 'VELOCITY_SPIKE':        return <TrendingUpOutlinedIcon sx={{ ...sz, color: '#f59e0b' }} />
    case 'NEW_DEVICE_SUSPICIOUS': return <PhoneAndroidOutlinedIcon sx={{ ...sz, color: '#f59e0b' }} />
    default:                      return <WarningAmberOutlinedIcon sx={{ ...sz, color: '#f59e0b' }} />
  }
}

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)} min ago`
  if (diff < 86400) return `${Math.round(diff / 3600)} hr ago`
  return `${Math.round(diff / 86400)}d ago`
}

function AlertRow({ alert }: { alert: OtpAlertItem }) {
  const cfg = ruleConfig[alert.rule]
  return (
    <Box
      data-ai-analyzable="true"
      data-ai-description={`OTP Alert: ${cfg.label} for customer ${alert.customerId || 'Unknown'}. Frequency: ${alert.eventCount} events. ${alert.detail ? `Analysis: ${alert.detail}. ` : ''}Fired via ${alert.channel || 'System'}.`}
      sx={{
        px: 2.5,
        py: 1.5,
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        transition: 'background 0.15s',
        '&:hover': { bgcolor: '#f8fafc' },
        animation: 'fadeIn 0.3s ease',
        '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(-4px)' }, to: { opacity: 1, transform: 'none' } },
      }}
    >
      {/* Icon */}
      <Box sx={{ mt: 0.25, flexShrink: 0 }}>
        {ruleIcon(alert.rule)}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Box sx={{
            px: 0.75,
            py: 0.125,
            bgcolor: cfg.bg,
            color: cfg.color,
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            fontFamily: 'Jost',
            flexShrink: 0,
          }}>
            {cfg.shortLabel}
          </Box>
          {alert.customerId && (
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {alert.customerId}
            </Typography>
          )}
          {alert.eventCount > 1 && (
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', flexShrink: 0 }}>
              ×{alert.eventCount}
            </Typography>
          )}
        </Box>
        <Tooltip title={alert.detail} placement="top-start" arrow>
          <Typography sx={{
            fontSize: '0.75rem',
            color: '#64748b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'default',
          }}>
            {alert.detail}
          </Typography>
        </Tooltip>
      </Box>

      {/* Meta */}
      <Box sx={{ flexShrink: 0, textAlign: 'right' }}>
        {alert.channel && (
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {alert.channel}
          </Typography>
        )}
        <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25 }}>
          {relativeTime(alert.firedAt)}
        </Typography>
      </Box>
    </Box>
  )
}

export default function OtpAlertsPanel() {
  const { alerts, connected, error } = useOtpAlerts()
  const loading = alerts.length === 0 && !connected && !error

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount  = alerts.filter(a => a.severity === 'warning').length

  return (
    <Box
      data-ai-analyzable="true"
      data-ai-description={`OTP Alerts Monitor: Currently tracking ${criticalCount} critical and ${warningCount} warning anomalies across the authentication stream.`}
      sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <Box sx={{ px: 2.5, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
            OTP Alerts
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Eureka · real-time anomaly detection
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{
            width: 6, height: 6, borderRadius: '50%',
            bgcolor: error ? '#94a3b8' : connected ? '#10b981' : '#f59e0b',
            animation: connected ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
          }} />
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: error ? '#94a3b8' : connected ? '#10b981' : '#f59e0b' }}>
            {error ? 'Offline' : connected ? 'Live' : 'Connecting'}
          </Typography>
        </Box>
      </Box>

      {/* Summary bar */}
      {!loading && alerts.length > 0 && (
        <Box sx={{ px: 2.5, py: 1.25, borderBottom: '1px solid #eef0f4', display: 'flex', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#dc2626' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              <strong style={{ color: '#0f172a' }}>{criticalCount}</strong> critical
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f59e0b' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              <strong style={{ color: '#0f172a' }}>{warningCount}</strong> warning
            </Typography>
          </Box>
        </Box>
      )}

      {/* Alert list */}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Box key={i} sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 1.5 }}>
                <Skeleton variant="circular" width={16} height={16} sx={{ mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="40%" height={14} sx={{ mb: 0.5 }} />
                  <Skeleton variant="text" width="80%" height={12} />
                </Box>
                <Skeleton variant="text" width={40} height={12} />
              </Box>
            ))
          : alerts.length === 0
            ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, px: 3, gap: 1 }}>
                  <WarningAmberOutlinedIcon sx={{ fontSize: '1.75rem', color: '#cbd5e1' }} />
                  <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', textAlign: 'center' }}>
                    No OTP alerts detected
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1', textAlign: 'center' }}>
                    Eureka will surface anomalies as OTPs arrive via the beam stream
                  </Typography>
                </Box>
              )
            : alerts.map(alert => <AlertRow key={alert.id} alert={alert} />)
        }
      </Box>

      {/* Footer rule legend */}
      <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid #eef0f4', display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
        {(Object.entries(ruleConfig) as [Rule, typeof ruleConfig[Rule]][]).map(([rule, cfg]) => (
          <Box key={rule} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {cfg.shortLabel}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
