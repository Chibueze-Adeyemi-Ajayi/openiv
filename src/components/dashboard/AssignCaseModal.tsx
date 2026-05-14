import { useState, useEffect } from 'react'
import { Box, Typography, InputBase, CircularProgress } from '@mui/material'
import { colorPalette } from '@/theme'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import { teamApi, type TeamMember } from '@/api/team'

const AVATAR_COLORS = ['#1e40af', '#0891b2', '#7c3aed', '#be123c', '#b45309', '#065f46']

function MemberAvatar({ name, size = 30 }: { name: string; size?: number }) {
  const idx = (name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', bgcolor: AVATAR_COLORS[idx],
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Typography sx={{ fontSize: size * 0.35, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{initials}</Typography>
    </Box>
  )
}

interface Props {
  open: boolean
  caseId: string
  onClose: () => void
  /** Called with the selected member; parent proceeds to TOTP then API call */
  onSelect: (member: TeamMember) => void
}

export default function AssignCaseModal({ open, caseId, onClose, onSelect }: Props) {
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

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  )

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
        width: 440, bgcolor: '#ffffff', zIndex: 1451,
        boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
        animation: 'assignFadeIn 0.2s ease',
        '@keyframes assignFadeIn': {
          from: { opacity: 0, transform: 'translate(-50%, -48%)' },
          to:   { opacity: 1, transform: 'translate(-50%, -50%)' },
        },
      }}>
        {/* Header */}
        <Box sx={{ px: 2.5, pt: 2.25, pb: 1.75, borderBottom: '1px solid #eef0f4',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ width: 34, height: 34, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PersonAddOutlinedIcon sx={{ fontSize: '1.125rem', color: '#1d4ed8' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                Assign Case
              </Typography>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mt: 0.125 }}>
                Select Team Member
              </Typography>
            </Box>
          </Box>
          <Box onClick={onClose} sx={{ cursor: 'pointer', color: '#94a3b8', mt: 0.25, '&:hover': { color: '#475569' }, display: 'flex' }}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid #e2e8f0', px: 1.25, py: 0.75,
            '&:focus-within': { borderColor: colorPalette.primary } }}>
            <SearchOutlinedIcon sx={{ fontSize: '0.9375rem', color: '#94a3b8', flexShrink: 0 }} />
            <InputBase
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or role…"
              sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: '#00288e' }}
            />
          </Box>
        </Box>

        {/* Member list */}
        <Box sx={{ maxHeight: 280, overflowY: 'auto', borderTop: '1px solid #f1f5f9' }}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={20} sx={{ color: colorPalette.primary }} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No active members found</Typography>
            </Box>
          ) : filtered.map(m => {
            const isSelected = selected?.id === m.id
            return (
              <Box
                key={m.id}
                onClick={() => setSelected(isSelected ? null : m)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25,
                  px: 2.5, py: 1.125,
                  cursor: 'pointer',
                  bgcolor: isSelected ? `${colorPalette.primary}08` : 'transparent',
                  borderLeft: isSelected ? `3px solid ${colorPalette.primary}` : '3px solid transparent',
                  borderBottom: '1px solid #f8fafc',
                  transition: 'all 0.12s',
                  '&:hover': { bgcolor: isSelected ? `${colorPalette.primary}0f` : '#fafbfc' },
                }}
              >
                <MemberAvatar name={m.name} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </Typography>
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
          })}
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2.5, py: 1.75, borderTop: '1px solid #eef0f4', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Box onClick={onClose} sx={{
            px: 2, py: 0.875, border: '1px solid #e2e8f0', cursor: 'pointer',
            color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
            transition: 'all 0.15s', '&:hover': { borderColor: '#94a3b8', color: '#334155' },
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
