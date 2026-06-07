import {
  Box, Typography, Stack, Chip, Button, CircularProgress, Drawer, Divider,
} from '@mui/material'
import { colorPalette } from '@/theme'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { useDashboardEvents, useDashboardEventsMut } from '@/contexts/DashboardEventsContext'
import { notificationsApi, notifSeverity, type NotificationItem } from '@/api/notifications'
import { institutionAlertsApi, type InstitutionAlert } from '@/api/institutionAlerts'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined'

// ── Severity config ───────────────────────────────────────────────────────────

const sevConfig = {
  critical: {
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    icon: <ErrorOutlineRoundedIcon sx={{ fontSize: '1.125rem' }} />,
    iconLg: <ErrorOutlineRoundedIcon sx={{ fontSize: '1.5rem' }} />,
    label: 'Critical',
  },
  warning: {
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a',
    icon: <WarningAmberRoundedIcon sx={{ fontSize: '1.125rem' }} />,
    iconLg: <WarningAmberRoundedIcon sx={{ fontSize: '1.5rem' }} />,
    label: 'Warning',
  },
  info: {
    color: colorPalette.primary,
    bg: `${colorPalette.primary}10`,
    border: `${colorPalette.primary}20`,
    icon: <InfoOutlinedIcon sx={{ fontSize: '1.125rem' }} />,
    iconLg: <InfoOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
    label: 'Info',
  },
  success: {
    color: '#10b981',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1.125rem' }} />,
    iconLg: <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1.5rem' }} />,
    label: 'Success',
  },
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function groupLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (itemDay.getTime() === today.getTime()) return 'Today'
  if (itemDay.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── Auto-read observer hook ────────────────────────────────────────────────────

function useAutoMarkRead(
  itemId: number,
  isUnread: boolean,
  onRead: (id: number) => void,
) {
  const ref = useRef<HTMLDivElement | null>(null)
  const calledRef = useRef(false)

  useEffect(() => {
    if (!isUnread || calledRef.current || !ref.current) return
    const el = ref.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !calledRef.current) {
          calledRef.current = true
          onRead(itemId)
        }
      },
      { threshold: 0.6 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [itemId, isUnread, onRead])

  return ref
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotifRow({
  n,
  selected,
  onRead,
  onClick,
}: {
  n: NotificationItem
  selected: boolean
  onRead: (id: number) => void
  onClick: (n: NotificationItem) => void
}) {
  const sev = notifSeverity(n.type)
  const cfg = sevConfig[sev]
  const unread = n.status === 'unread'
  const ref = useAutoMarkRead(n.id, unread, onRead)
  const navigate = useNavigate()

  const handleEntityBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!n.entityId || !n.entityType) return
    if (unread) onRead(n.id)
    const dest = n.entityType === 'transaction'
      ? `/dashboard/transactions?tx=${encodeURIComponent(n.entityId)}`
      : `/dashboard/aml?case=${encodeURIComponent(n.entityId)}`
    navigate(dest, {
      state: { breadcrumbs: [{ label: 'Notifications', path: '/dashboard/notifications' }] },
    })
  }

  return (
    <Box
      ref={ref}
      data-notif-id={n.id}
      onClick={() => onClick(n)}
      sx={{
        display: 'flex',
        gap: 2,
        px: 3,
        py: 2.25,
        cursor: 'pointer',
        bgcolor: selected
          ? `${colorPalette.primary}08`
          : unread
            ? `${colorPalette.primary}04`
            : 'var(--card-bg)',
        borderBottom: '1px solid var(--border-col)',
        borderLeft: selected ? `3px solid ${colorPalette.primary}` : '3px solid transparent',
        position: 'relative',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        '&:hover': { bgcolor: selected ? `${colorPalette.primary}0c` : 'var(--section-bg)' },
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      {/* Unread dot */}
      {unread && (
        <Box
          sx={{
            position: 'absolute',
            left: selected ? 11 : 8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 7,
            height: 7,
            borderRadius: '50%',
            bgcolor: colorPalette.primary,
          }}
        />
      )}

      {/* Severity icon */}
      <Box
        sx={{
          width: 36,
          height: 36,
          bgcolor: cfg.bg,
          border: `1px solid ${cfg.border}`,
          color: cfg.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {cfg.icon}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 0.5 }}>
          <Typography
            sx={{
              fontSize: '0.875rem',
              fontWeight: unread ? 700 : 600,
              color: 'var(--heading-color)',
              fontFamily: 'Jost',
              lineHeight: 1.4,
            }}
          >
            {n.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Chip
              label={cfg.label}
              size="small"
              sx={{
                fontSize: '0.625rem', fontWeight: 700, height: 18,
                bgcolor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                borderRadius: 0, fontFamily: 'Jost',
                '& .MuiChip-label': { px: 1 },
              }}
            />
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {timeAgo(n.createdAt)}
            </Typography>
          </Box>
        </Box>
        <Typography
          sx={{
            fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.55,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}
        >
          {n.body}
        </Typography>
        {n.entityId && n.entityType && (
          <Box
            onClick={handleEntityBadgeClick}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1, px: 1, py: 0.375, bgcolor: `${colorPalette.primary}0c`, border: `1px solid ${colorPalette.primary}20`, borderRadius: '3px', cursor: 'pointer', '&:hover': { bgcolor: `${colorPalette.primary}18` } }}>
            {n.entityType === 'transaction'
              ? <ReceiptLongOutlinedIcon sx={{ fontSize: '0.75rem', color: colorPalette.primary }} />
              : <GavelOutlinedIcon sx={{ fontSize: '0.75rem', color: colorPalette.primary }} />
            }
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              View {n.entityType === 'transaction' ? 'Transaction' : 'Case'}
            </Typography>
            <OpenInNewRoundedIcon sx={{ fontSize: '0.625rem', color: colorPalette.primary, opacity: 0.7 }} />
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function NotifDetailDrawer({
  n,
  onClose,
  onRead,
}: {
  n: NotificationItem | null
  onClose: () => void
  onRead: (id: number) => void
}) {
  const open = !!n
  const sev = n ? notifSeverity(n.type) : 'info'
  const cfg = sevConfig[sev]
  const navigate = useNavigate()

  const handleMarkRead = () => {
    if (n && n.status === 'unread') onRead(n.id)
  }

  const handleViewEntity = () => {
    if (!n?.entityId || !n.entityType) return
    const dest = n.entityType === 'transaction'
      ? `/dashboard/transactions?tx=${encodeURIComponent(n.entityId)}`
      : `/dashboard/aml?case=${encodeURIComponent(n.entityId)}`
    onClose()
    navigate(dest, {
      state: { breadcrumbs: [{ label: 'Notifications', path: '/dashboard/notifications' }] },
    })
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 440 },
            borderLeft: '1px solid var(--border-col)',
            borderRadius: 0,
            boxShadow: '-8px 0 40px rgba(15,23,42,0.08)',
          },
        },
      }}
    >
      {n && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Drawer header */}
          <Box
            sx={{
              px: 3, py: 2.25,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-col)',
              bgcolor: 'var(--card-bg)',
            }}
          >
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
              Notification detail
            </Typography>
            <Box
              onClick={onClose}
              sx={{
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#64748b', borderRadius: '4px',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: 'var(--section-bg)', color: 'var(--heading-color)' },
              }}
            >
              <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
            </Box>
          </Box>

          {/* Severity + meta */}
          <Box
            sx={{
              px: 3, py: 2.5,
              bgcolor: cfg.bg,
              borderBottom: `1px solid ${cfg.border}`,
              display: 'flex', alignItems: 'flex-start', gap: 2,
            }}
          >
            <Box
              sx={{
                width: 44, height: 44, flexShrink: 0,
                bgcolor: '#fff', border: `1px solid ${cfg.border}`,
                color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {cfg.iconLg}
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip
                  label={cfg.label}
                  size="small"
                  sx={{
                    fontSize: '0.625rem', fontWeight: 700, height: 18,
                    bgcolor: '#fff', color: cfg.color, border: `1px solid ${cfg.border}`,
                    borderRadius: 0, fontFamily: 'Jost',
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
                <Chip
                  label={n.status === 'unread' ? 'Unread' : 'Read'}
                  size="small"
                  sx={{
                    fontSize: '0.625rem', fontWeight: 700, height: 18,
                    bgcolor: n.status === 'unread' ? `${colorPalette.primary}15` : 'var(--section-bg)',
                    color: n.status === 'unread' ? colorPalette.primary : '#94a3b8',
                    border: `1px solid ${n.status === 'unread' ? colorPalette.primary + '30' : 'var(--border-col)'}`,
                    borderRadius: 0, fontFamily: 'Jost',
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              </Box>
              <Typography sx={{ fontSize: '0.6875rem', color: cfg.color, fontWeight: 500, opacity: 0.8 }}>
                {fullDate(n.createdAt)}
              </Typography>
            </Box>
          </Box>

          {/* Body */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
            <Typography
              sx={{
                fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)',
                fontFamily: 'Jost', lineHeight: 1.45, mb: 2,
              }}
            >
              {n.title}
            </Typography>
            <Divider sx={{ mb: 2, borderColor: '#f4f5f7' }} />
            <Typography
              sx={{
                fontSize: '0.875rem', color: 'var(--on-surface-variant)',
                lineHeight: 1.75, whiteSpace: 'pre-wrap',
              }}
            >
              {n.body}
            </Typography>
          </Box>

          {/* Actions */}
          <Box
            sx={{
              px: 3, py: 2.25,
              borderTop: '1px solid var(--border-col)',
              display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap',
            }}
          >
            {n.entityId && n.entityType && (
              <Button
                size="small"
                startIcon={
                  n.entityType === 'transaction'
                    ? <ReceiptLongOutlinedIcon sx={{ fontSize: '0.9rem !important' }} />
                    : <GavelOutlinedIcon sx={{ fontSize: '0.9rem !important' }} />
                }
                endIcon={<OpenInNewRoundedIcon sx={{ fontSize: '0.75rem !important' }} />}
                onClick={handleViewEntity}
                sx={{
                  bgcolor: colorPalette.primary, color: '#fff',
                  borderRadius: 0, textTransform: 'none',
                  fontFamily: 'Jost', fontSize: '0.8125rem', fontWeight: 600,
                  px: 2, boxShadow: 'none',
                  '&:hover': { bgcolor: 'var(--on-surface)', boxShadow: 'none' },
                }}
              >
                View {n.entityType === 'transaction' ? 'Transaction' : 'Case'}
              </Button>
            )}
            {n.status === 'unread' ? (
              <Button
                size="small"
                startIcon={<MarkEmailReadOutlinedIcon sx={{ fontSize: '0.9rem !important' }} />}
                onClick={handleMarkRead}
                sx={{
                  bgcolor: n.entityId ? 'var(--card-bg)' : colorPalette.primary,
                  color: n.entityId ? '#475569' : '#fff',
                  border: n.entityId ? '1px solid var(--border-col)' : 'none',
                  borderRadius: 0, textTransform: 'none',
                  fontFamily: 'Jost', fontSize: '0.8125rem', fontWeight: 600,
                  px: 2, boxShadow: 'none',
                  '&:hover': { bgcolor: n.entityId ? 'var(--section-bg)' : '#1e293b', boxShadow: 'none' },
                }}
              >
                Mark as read
              </Button>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#10b981' }}>
                <MarkEmailReadOutlinedIcon sx={{ fontSize: '1rem' }} />
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost' }}>
                  Already read
                </Typography>
              </Box>
            )}
            <Button
              size="small"
              onClick={onClose}
              sx={{
                bgcolor: 'var(--section-bg)', color: 'var(--on-surface-variant)',
                border: '1px solid #e5e7eb',
                borderRadius: 0, textTransform: 'none',
                fontFamily: 'Jost', fontSize: '0.8125rem', fontWeight: 600,
                px: 2,
                '&:hover': { bgcolor: 'var(--section-bg)' },
              }}
            >
              Close
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  )
}

// ── Path → human label map ────────────────────────────────────────────────────

const PATH_LABELS: Record<string, string> = {
  '/dashboard':              'Overview',
  '/dashboard/otp-alerts':   'OTP Alerts',
  '/dashboard/transactions': 'Transactions',
  '/dashboard/patterns':     'Behavioral Patterns',
  '/dashboard/aml':          'AML Cases',
  '/dashboard/kyc':          'KYC',
  '/dashboard/heatmaps':     'Heatmaps',
  '/dashboard/cbn':          'CBN Compliance',
  '/dashboard/reports':      'Reports',
  '/dashboard/thresholds':   'Detection Rules',
  '/dashboard/network':      'Network',
  '/dashboard/beam':         'Data Beaming',
  '/dashboard/ingest':       'Ingestion',
  '/dashboard/webhooks':     'Webhooks',
  '/dashboard/team':         'Team',
  '/dashboard/billing':      'Billing',
  '/dashboard/settings':     'Settings',
}

// ── Page ──────────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'unread' | 'critical' | 'warning' | 'info'

export default function NotificationsPage() {
  const { notifications: liveNotifs } = useDashboardEvents()
  const { markNotifRead, markAllNotifsRead } = useDashboardEventsMut()
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading]           = useState(true)
  const [restNotifs, setRestNotifs]     = useState<NotificationItem[]>([])
  const [filter, setFilter]             = useState<FilterType>('all')
  const [selected, setSelected]         = useState<NotificationItem | null>(null)
  const didOpenRef                      = useRef(false)
  const [surgeAlerts, setSurgeAlerts]   = useState<InstitutionAlert[]>([])

  // Location state passed by Topbar when navigating here
  const navState     = location.state as { from?: string; openNotifId?: number } | null
  const fromPath     = navState?.from ?? null
  const openNotifId  = navState?.openNotifId ?? null
  const fromLabel = fromPath ? (PATH_LABELS[fromPath] ?? 'Previous page') : null

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/dashboard')
  }

  // Bootstrap from REST on mount — SSE notifInit may not have fired yet
  useEffect(() => {
    setLoading(true)
    Promise.all([
      notificationsApi.list(100),
      institutionAlertsApi.list(),
    ])
      .then(([items, alertRes]) => {
        setRestNotifs(items)
        setSurgeAlerts(alertRes.alerts.filter(a => a.status !== 'resolved'))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleRead = useCallback(
    async (id: number) => {
      markNotifRead(id)
      // Update selected item's status optimistically so the drawer reflects it
      setSelected((prev) => (prev?.id === id ? { ...prev, status: 'read' } : prev))
      await notificationsApi.markRead(id).catch(() => {})
    },
    [markNotifRead],
  )

  const handleMarkAllRead = async () => {
    markAllNotifsRead()
    setSelected((prev) => (prev ? { ...prev, status: 'read' } : prev))
    await notificationsApi.markAllRead().catch(() => {})
  }

  const handleRowClick = (n: NotificationItem) => {
    setSelected((prev) => (prev?.id === n.id ? null : n))
    // Mark as read immediately on click
    if (n.status === 'unread') handleRead(n.id)
  }

  // SSE context is authoritative once it has data (notifInit fired);
  // fall back to REST bootstrap while SSE is still connecting.
  const allNotifs = liveNotifs.length > 0 ? liveNotifs : restNotifs

  // When arriving from popover click, scroll to and open the target notification.
  useEffect(() => {
    if (!openNotifId || loading || didOpenRef.current) return
    const n = allNotifs.find((x) => x.id === openNotifId)
    if (!n) return
    didOpenRef.current = true
    setSelected(n)
    if (n.status === 'unread') handleRead(n.id)
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-notif-id="${openNotifId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [openNotifId, loading, allNotifs, handleRead])

  // Keep selected in sync with latest notification state (e.g. status change)
  const syncedSelected = selected
    ? (allNotifs.find((n) => n.id === selected.id) ?? selected)
    : null

  const filtered = allNotifs.filter((n) => {
    if (filter === 'unread')   return n.status === 'unread'
    if (filter === 'critical') return notifSeverity(n.type) === 'critical'
    if (filter === 'warning')  return notifSeverity(n.type) === 'warning'
    if (filter === 'info')     return notifSeverity(n.type) === 'info' || notifSeverity(n.type) === 'success'
    return true
  })

  const unreadCount = allNotifs.filter((n) => n.status === 'unread').length

  // Group by day
  const groups: { label: string; items: NotificationItem[] }[] = []
  for (const n of filtered) {
    const label = groupLabel(n.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(n)
    else groups.push({ label, items: [n] })
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'unread',   label: 'Unread' },
    { key: 'critical', label: 'Critical' },
    { key: 'warning',  label: 'Warning' },
    { key: 'info',     label: 'Info' },
  ]

  return (
    <>
      <Box sx={{ p: 4, maxWidth: 860, mx: 'auto' }}>
        {/* Back button */}
        <Box
          onClick={handleBack}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75,
            mb: 2.5, cursor: 'pointer', color: '#64748b',
            transition: 'color 0.15s',
            '&:hover': { color: colorPalette.primary },
          }}
        >
          <ArrowBackRoundedIcon sx={{ fontSize: '1rem' }} />
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost' }}>
            {fromLabel ? `Back to ${fromLabel}` : 'Go back'}
          </Typography>
        </Box>

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.25 }}>
              Notifications
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
              {unreadCount} unread · {allNotifs.length} total
            </Typography>
          </Box>
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<DoneAllRoundedIcon sx={{ fontSize: '0.9rem !important' }} />}
              onClick={handleMarkAllRead}
              sx={{
                bgcolor: 'var(--card-bg)', color: 'var(--on-surface-variant)',
                border: '1px solid var(--border-col)', borderRadius: 0,
                textTransform: 'none', fontFamily: 'Jost',
                fontSize: '0.8125rem', fontWeight: 600, px: 2,
                '&:hover': { bgcolor: 'var(--section-bg)' },
              }}
            >
              Mark all as read
            </Button>
          )}
        </Box>

        {/* Filter bar */}
        <Stack direction="row" gap={1} sx={{ mb: 3 }}>
          {filters.map((f) => (
            <Chip
              key={f.key}
              label={f.key === 'unread' && unreadCount > 0 ? `${f.label} (${unreadCount})` : f.label}
              onClick={() => setFilter(f.key)}
              sx={{
                borderRadius: 0, fontFamily: 'Jost', fontSize: '0.75rem',
                fontWeight: filter === f.key ? 700 : 500,
                bgcolor: filter === f.key ? colorPalette.primary : 'var(--card-bg)',
                color: filter === f.key ? '#fff' : '#475569',
                border: `1px solid ${filter === f.key ? colorPalette.primary : 'var(--border-col)'}`,
                cursor: 'pointer',
                '&:hover': { bgcolor: filter === f.key ? colorPalette.primary : 'var(--section-bg)' },
                '& .MuiChip-label': { px: 1.5 },
              }}
            />
          ))}
        </Stack>

        {/* Surge alerts — platform-wide fraud signals requiring investigation */}
        {surgeAlerts.length > 0 && (
          <Stack gap={1.5} sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Platform Alerts — Action Required
            </Typography>
            {surgeAlerts.map(alert => (
              <Box
                key={alert.id}
                sx={{
                  p: 2.5, bgcolor: '#fffbeb', border: '2px solid #fcd34d',
                  display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                  <Box sx={{ p: 1, bgcolor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrendingUpRoundedIcon sx={{ fontSize: '1.25rem', color: '#d97706' }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '0.9375rem', color: '#92400e' }}>
                        {alert.title}
                      </Typography>
                      <Chip
                        label={alert.status === 'investigating' ? 'Investigating' : 'Open'}
                        size="small"
                        sx={{
                          borderRadius: 0.5, height: 20, fontFamily: 'Jost', fontSize: '0.625rem', fontWeight: 700,
                          bgcolor: alert.status === 'investigating' ? '#fef9ee' : '#fef2f2',
                          color: alert.status === 'investigating' ? '#d97706' : '#dc2626',
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.5 }}>
                      {alert.metadata.surgePct !== undefined
                        ? `Today's transaction volume is +${alert.metadata.surgePct}% above your expected baseline (${(alert.metadata.todayCount ?? 0).toLocaleString()} vs ${(alert.metadata.expectedCount ?? 0).toLocaleString()} expected).`
                        : alert.message}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  size="small"
                  startIcon={<SearchRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
                  onClick={() => navigate(`/dashboard/investigate/${alert.id}`)}
                  sx={{
                    textTransform: 'none', fontFamily: 'Jost', fontWeight: 700, fontSize: '0.8125rem',
                    borderRadius: 0, px: 2, py: 0.875, bgcolor: '#d97706', color: '#ffffff', boxShadow: 'none',
                    flexShrink: 0,
                    '&:hover': { bgcolor: '#b45309', boxShadow: 'none' },
                  }}
                >
                  Investigate
                </Button>
              </Box>
            ))}
          </Stack>
        )}

        {/* Content */}
        {loading ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <CircularProgress size={28} sx={{ color: colorPalette.primary }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center', border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)' }}>
            <NotificationsNoneOutlinedIcon sx={{ fontSize: '2.5rem', color: '#cbd5e1', mb: 1.5, display: 'block', mx: 'auto' }} />
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--on-surface-variant)', fontFamily: 'Jost', mb: 0.5 }}>
              {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
              {filter === 'all'
                ? 'System alerts will appear here as your fraud pipeline processes transactions.'
                : 'Try switching to "All" to see everything.'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)' }}>
            {groups.map((group) => (
              <Box key={group.label}>
                {/* Day divider */}
                <Box
                  sx={{
                    px: 3, py: 1, bgcolor: 'var(--section-bg)',
                    borderBottom: '1px solid var(--border-col)',
                    display: 'flex', alignItems: 'center', gap: 1.5,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
                      fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.07em',
                    }}
                  >
                    {group.label}
                  </Typography>
                  <Box sx={{ flex: 1, height: 1, bgcolor: 'var(--border-col)' }} />
                </Box>
                {group.items.map((n) => (
                  <NotifRow
                    key={n.id}
                    n={n}
                    selected={syncedSelected?.id === n.id}
                    onRead={handleRead}
                    onClick={handleRowClick}
                  />
                ))}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Detail drawer */}
      <NotifDetailDrawer
        n={syncedSelected}
        onClose={() => setSelected(null)}
        onRead={handleRead}
      />
    </>
  )
}
