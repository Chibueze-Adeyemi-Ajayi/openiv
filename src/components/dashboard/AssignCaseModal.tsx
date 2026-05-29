import { useState, useEffect } from 'react'
import { Box, Typography, InputBase, CircularProgress } from '@mui/material'
import { colorPalette } from '@/theme'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined'
import { teamApi, type TeamMember } from '@/api/team'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { CaseInterest } from '@/api/cases'

const AVATAR_COLORS = ['#1e40af', '#0891b2', '#7c3aed', '#be123c', '#b45309', '#065f46']

function MemberAvatar({ name, avatarUrl, size = 30 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const idx = (name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  if (avatarUrl) {
    return (
      <Box component="img" src={avatarUrl} alt={name}
        sx={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }} />
    )
  }
  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', bgcolor: AVATAR_COLORS[idx],
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Typography sx={{ fontSize: size * 0.35, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{initials}</Typography>
    </Box>
  )
}

function MemberRow({ m, selected, currentUser, onSelect, hasInterest = false }: {
  m: TeamMember
  selected: TeamMember | null
  currentUser: ReturnType<typeof import('@/hooks/useCurrentUser').useCurrentUser>
  onSelect: (m: TeamMember | null) => void
  hasInterest?: boolean
}) {
  const isSelected = selected?.id === m.id
  const isMe = currentUser?.userId != null && m.id === currentUser.userId
  return (
    <Box
      onClick={() => onSelect(isSelected ? null : m)}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        px: 2.5, py: 1.125,
        cursor: 'pointer',
        bgcolor: isSelected ? `${colorPalette.primary}08` : 'transparent',
        borderLeft: isSelected ? `3px solid ${colorPalette.primary}` : hasInterest ? '3px solid #ea580c' : '3px solid transparent',
        borderBottom: '1px solid var(--border-col)',
        transition: 'all 0.12s',
        '&:hover': { bgcolor: isSelected ? `${colorPalette.primary}0f` : hasInterest ? '#fff7ed' : 'var(--section-bg)' },
      }}
    >
      <MemberAvatar name={m.name} avatarUrl={m.avatarUrl} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.name}
          </Typography>
          {isMe && (
            <Box sx={{ px: 0.625, py: 0.125, bgcolor: `${colorPalette.primary}14`, flexShrink: 0 }}>
              <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.4 }}>You</Typography>
            </Box>
          )}
          {hasInterest && !isMe && (
            <Box sx={{ px: 0.625, py: 0.125, bgcolor: '#fff7ed', border: '1px solid #fed7aa', flexShrink: 0 }}>
              <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.4 }}>Interested</Typography>
            </Box>
          )}
        </Box>
        <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.email} · {m.role}
        </Typography>
      </Box>
      {isSelected && (
        <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: colorPalette.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CheckRoundedIcon sx={{ fontSize: '0.75rem', color: '#fff' }} />
        </Box>
      )}
    </Box>
  )
}

interface Props {
  open: boolean
  caseId: string
  interests?: CaseInterest[]
  onClose: () => void
  /** Called with the selected member; parent proceeds to TOTP then API call */
  onSelect: (member: TeamMember) => void
}

export default function AssignCaseModal({ open, caseId, interests = [], onClose, onSelect }: Props) {
  const currentUser = useCurrentUser()
  const [members, setMembers]     = useState<TeamMember[]>([])
  const [loading, setLoading]     = useState(false)
  const [search,  setSearch]      = useState('')
  const [selected, setSelected]   = useState<TeamMember | null>(null)

  useEffect(() => {
    if (!open) { setSearch(''); setSelected(null); return }
    setLoading(true)
    teamApi.listMembers()
      .then(res => setMembers(res.members.filter(m => m.status === 'active')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const pendingInterestIds = new Set(
    interests.filter(i => i.status === 'pending').map(i => i.userId)
  )

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  )

  const interestedMembers = filtered.filter(m => pendingInterestIds.has(m.id))
  const otherMembers      = filtered.filter(m => !pendingInterestIds.has(m.id))

  const handleConfirm = () => {
    if (!selected) return
    onSelect(selected)
  }

  return (
    <>
      <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)', zIndex: 1450 }} />
      <Box sx={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440, bgcolor: 'var(--card-bg)', zIndex: 1451,
        boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
        animation: 'assignFadeIn 0.2s ease',
        '@keyframes assignFadeIn': {
          from: { opacity: 0, transform: 'translate(-50%, -48%)' },
          to:   { opacity: 1, transform: 'translate(-50%, -50%)' },
        },
      }}>
        {/* Header */}
        <Box sx={{ px: 2.5, pt: 2.25, pb: 1.75, borderBottom: '1px solid var(--border-col)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ width: 34, height: 34, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PersonAddOutlinedIcon sx={{ fontSize: '1.125rem', color: '#1d4ed8' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                Assign Case
              </Typography>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mt: 0.125 }}>
                Select Team Member
              </Typography>
            </Box>
          </Box>
          <Box onClick={onClose} sx={{ cursor: 'pointer', color: '#94a3b8', mt: 0.25, '&:hover': { color: 'var(--on-surface-variant)' }, display: 'flex' }}>
            <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
          </Box>
        </Box>

        {/* Case ref */}
        <Box sx={{ px: 2.5, pt: 1.5, pb: 0 }}>
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'Jost' }}>
            Assigning case{' '}
            <Box component="span" sx={{ fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace' }}>
              {caseId}
            </Box>
          </Typography>
        </Box>

        {/* Search */}
        <Box sx={{ px: 2.5, pt: 1.5, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid var(--border-col)', px: 1.25, py: 0.75,
            '&:focus-within': { borderColor: colorPalette.primary } }}>
            <SearchOutlinedIcon sx={{ fontSize: '0.9375rem', color: '#94a3b8', flexShrink: 0 }} />
            <InputBase
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or role…"
              sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: 'var(--heading-color)' }}
            />
          </Box>
        </Box>

        {/* Member list */}
        <Box sx={{ maxHeight: 320, overflowY: 'auto', borderTop: '1px solid var(--border-col)' }}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={20} sx={{ color: colorPalette.primary }} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No active members found</Typography>
            </Box>
          ) : (
            <>
              {/* Interested members section */}
              {interestedMembers.length > 0 && (
                <>
                  <Box sx={{ px: 2.5, py: 0.875, bgcolor: '#fff7ed', borderBottom: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <PanToolOutlinedIcon sx={{ fontSize: '0.75rem', color: '#ea580c' }} />
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Expressed Interest ({interestedMembers.length})
                    </Typography>
                  </Box>
                  {interestedMembers.map(m => <MemberRow key={m.id} m={m} selected={selected} currentUser={currentUser} onSelect={setSelected} hasInterest />)}
                  {otherMembers.length > 0 && (
                    <Box sx={{ px: 2.5, py: 0.875, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)', borderTop: '1px solid var(--border-col)' }}>
                      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        All Team Members
                      </Typography>
                    </Box>
                  )}
                </>
              )}
              {otherMembers.map(m => <MemberRow key={m.id} m={m} selected={selected} currentUser={currentUser} onSelect={setSelected} />)}
            </>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2.5, py: 1.75, borderTop: '1px solid var(--border-col)', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Box onClick={onClose} sx={{
            px: 2, py: 0.875, border: '1px solid var(--border-col)', cursor: 'pointer',
            color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
            transition: 'all 0.15s', '&:hover': { borderColor: '#94a3b8', color: 'var(--on-surface-variant)' },
          }}>
            Cancel
          </Box>
          <Box onClick={handleConfirm} sx={{
            px: 2.25, py: 0.875,
            bgcolor: selected ? '#1d4ed8' : '#e2e8f0',
            color: selected ? '#ffffff' : '#94a3b8',
            cursor: selected ? 'pointer' : 'not-allowed',
            fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost',
            transition: 'all 0.15s', '&:hover': selected ? { opacity: 0.88 } : {},
          }}>
            Assign to {selected ? selected.name.split(' ')[0] : '…'}
          </Box>
        </Box>
      </Box>
    </>
  )
}
