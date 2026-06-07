import { Alert, Box, Typography, Stack, Button, Chip, IconButton, InputBase, TextField } from '@mui/material'
import { colorPalette } from '@/theme'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import RoleEditor, { type RoleDraft } from '@/components/dashboard/RoleEditor'
import { useState, useMemo, useEffect } from 'react'
import { teamApi, type TeamMember, type TeamPending, type TeamRole } from '@/api/team'
import { authApi } from '@/api/auth'
import { ApiError, resolveMediaUrl } from '@/api/client'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
// import EditOutlinedIcon from '@mui/icons-material/EditOutlined'



const AVATAR_BG = ['#1e40af', '#0e7490', '#7c3aed', '#be123c', '#b45309', '#065f46', '#1d4ed8', '#9d174d']

const STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  active:   { label: 'Active',   bg: '#dcfce7', fg: '#15803d', dot: '#16a34a' },
  pending:  { label: 'Pending',  bg: '#fef9c3', fg: '#854d0e', dot: '#d97706' },
  disabled: { label: 'Disabled', bg: '#f1f5f9', fg: '#64748b', dot: '#94a3b8' },
  locked:   { label: 'Locked',   bg: '#fee2e2', fg: '#b91c1c', dot: '#dc2626' },
}

function MemberAvatar({ name, initials, avatarUrl, size = 32 }: { name: string; initials: string; avatarUrl?: string | null; size?: number }) {
  const bg = AVATAR_BG[(name.charCodeAt(0) ?? 0) % AVATAR_BG.length]
  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      {resolveMediaUrl(avatarUrl) ? (
        <Box component="img" src={resolveMediaUrl(avatarUrl)!} alt={name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Box sx={{
          width: '100%', height: '100%', bgcolor: bg, color: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.34, fontWeight: 700, fontFamily: 'Jost',
        }}>
          {initials}
        </Box>
      )}
    </Box>
  )
}

function MemberDetailDialog({
  member, role, currentUserEmail, currentUserRole, onClose, onRemove,
}: {
  member: TeamMember | null
  role: TeamRole | null
  currentUserEmail: string | null
  currentUserRole: string | null
  onClose: () => void
  onRemove: () => void
}) {
  if (!member) return null

  const sc = STATUS_CONFIG[member.status] ?? STATUS_CONFIG.active
  const avatarBg = AVATAR_BG[(member.name.charCodeAt(0) ?? 0) % AVATAR_BG.length]
  const canRemove = currentUserRole === 'admin' && member.email !== currentUserEmail && member.role !== 'admin'
  const joinDate = member.createdAt
    ? new Date(member.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  return (
    <>
      <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', zIndex: 1290 }} />
      <Box sx={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 660, bgcolor: 'var(--card-bg)', zIndex: 1291,
        boxShadow: '0 24px 64px rgba(15,23,42,0.2)',
        animation: 'mdfadeIn 0.22s cubic-bezier(0.4,0,0.2,1)',
        '@keyframes mdfadeIn': {
          from: { opacity: 0, transform: 'translate(-50%, -48%) scale(0.96)' },
          to:   { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
        },
      }}>
        {/* ── Header ── */}
        <Box sx={{ bgcolor: colorPalette.primary, px: 3, pt: 3, pb: 3, position: 'relative' }}>
          <IconButton onClick={onClose} size="small" disableRipple sx={{
            position: 'absolute', top: 12, right: 12, borderRadius: 0,
            color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' },
          }}>
            <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
          </IconButton>

          <Stack direction="row" spacing={2.25} alignItems="center">
            <Box sx={{ width: 62, height: 62, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2.5px solid rgba(255,255,255,0.22)' }}>
              {resolveMediaUrl(member.avatarUrl) ? (
                <Box component="img" src={resolveMediaUrl(member.avatarUrl)!} alt={member.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Box sx={{ width: '100%', height: '100%', bgcolor: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.375rem', fontWeight: 700, fontFamily: 'Jost', color: '#ffffff' }}>
                  {member.initials}
                </Box>
              )}
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Jost', lineHeight: 1.2, mb: 0.75 }}>
                {member.name}
                {member.email === currentUserEmail && (
                  <Box component="span" sx={{ ml: 1, fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>(you)</Box>
                )}
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap">
                {role && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, px: 1, py: 0.3, bgcolor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: role.color }} />
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.07em' }}>
                      {role.name.toUpperCase()}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.3, bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: sc.dot }} />
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.07em' }}>
                    {sc.label.toUpperCase()}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </Box>

        {/* ── Body ── */}
        <Box sx={{ px: 3, pt: 3, pb: 2.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>

            {/* Left — Identity & Access */}
            <Box>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 2 }}>
                Identity & Access
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>Email</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', fontFamily: 'SF Mono, Monaco, monospace', wordBreak: 'break-all' }}>
                      {member.email}
                    </Typography>
                    <Box sx={{ px: 0.75, py: 0.15, bgcolor: member.emailVerified ? '#dcfce7' : '#fee2e2', flexShrink: 0 }}>
                      <Typography sx={{ fontSize: '0.4375rem', fontWeight: 800, letterSpacing: '0.08em', color: member.emailVerified ? '#15803d' : '#b91c1c' }}>
                        {member.emailVerified ? 'VERIFIED' : 'UNVERIFIED'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>Member Since</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>{joinDate}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>Last Active</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>{member.lastActive || '—'}</Typography>
                  </Box>
                </Box>

                {member.accountType && (
                  <Box>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>Account Type</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', textTransform: 'capitalize' }}>{member.accountType}</Typography>
                  </Box>
                )}

                <Box>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>Account Status</Typography>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.625, px: 1, py: 0.375, bgcolor: sc.bg }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: sc.dot }} />
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: sc.fg, letterSpacing: '0.07em' }}>{sc.label.toUpperCase()}</Typography>
                  </Box>
                </Box>

                {role?.description && (
                  <Box sx={{ pt: 0.25 }}>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>Role Description</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.6 }}>{role.description}</Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            {/* Right — Permissions */}
            <Box>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 2 }}>
                Role Permissions
              </Typography>
              {role ? (
                <Stack spacing={0}>
                  {permissionMatrix.map((section, si) => (
                    <Box key={section.area} sx={{ py: 1.25, borderBottom: si < permissionMatrix.length - 1 ? '1px solid var(--border-col)' : 'none', display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--on-surface-variant)', minWidth: 104, lineHeight: 1.5, pt: 0.1, flexShrink: 0 }}>
                        {section.area}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {section.actions.map(a => {
                          const has = getPermission(role, a.key)
                          return (
                            <Box key={a.key} sx={{ px: 0.875, py: 0.25, bgcolor: has ? '#f0fdf4' : 'var(--section-bg)', border: `1px solid ${has ? '#bbf7d0' : 'var(--border-col)'}` }}>
                              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.04em', color: has ? '#15803d' : '#94a3b8' }}>
                                {a.label}
                              </Typography>
                            </Box>
                          )
                        })}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Role permissions not available.</Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* ── Footer ── */}
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            {canRemove && (
              <Button
                onClick={onRemove}
                startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                sx={{ color: '#dc2626', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', borderRadius: 0, px: 1.75, py: 0.875, border: '1px solid #fecaca', bgcolor: '#fff5f5', '&:hover': { bgcolor: '#fee2e2', borderColor: '#fca5a5' } }}
              >
                Remove from Team
              </Button>
            )}
          </Box>
          <Button onClick={onClose} sx={{ bgcolor: 'var(--card-bg)', color: 'var(--on-surface-variant)', border: '1px solid var(--border-col)', px: 2.25, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: 'var(--section-bg)' } }}>
            Close
          </Button>
        </Box>
      </Box>
    </>
  )
}

// Members + pending come from GET /api/v1/team/members and /pending; see useEffect below.

const permissionMatrix = [
  { area: 'Transaction Monitor', actions: [{ key: 'monitor.view', label: 'View live feed' }, { key: 'monitor.act', label: 'Block / clear' }] },
  { area: 'Cases', actions: [{ key: 'cases.view', label: 'View' }, { key: 'cases.assign', label: 'Assign' }, { key: 'cases.close', label: 'Close' }] },
  { area: 'Rules & Thresholds', actions: [{ key: 'rules.view', label: 'View' }, { key: 'rules.modify', label: 'Modify' }] },
  { area: 'Reports', actions: [{ key: 'reports.view', label: 'View' }, { key: 'reports.file', label: 'File NFIU' }] },
  { area: 'Team', actions: [{ key: 'team.view', label: 'View' }, { key: 'team.manage', label: 'Manage' }] },
  { area: 'Integrations', actions: [{ key: 'integrations.view', label: 'View' }, { key: 'integrations.modify', label: 'Modify' }] },
]

function getPermission(role: TeamRole, key: string): boolean {
  const [area, action] = key.split('.')
  return (role.permissions as any)?.[area]?.[action] ?? false
}

const PAGE_SIZE = 8

export default function TeamPage() {
  const [tab, setTab] = useState<'members' | 'pending' | 'roles'>('members')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  // Server-backed data.
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pending, setPending] = useState<TeamPending[]>([])
  const [roles, setRoles] = useState<TeamRole[]>([])
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('analyst')
  const [inviteTOTP, setInviteTOTP] = useState(false)
  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null)
  const [revokePending, setRevokePending] = useState<TeamPending | null>(null)
  const [resendPending, setResendPending] = useState<TeamPending | null>(null)

  const loadMembers = async () => {
    try {
      const { members } = await teamApi.listMembers()
      setMembers(members)
    } catch (err) {
      setApiError(humanizeError(err, 'Could not load team members.'))
    }
  }

  const loadPending = async () => {
    try {
      const { pending } = await teamApi.listPending()
      setPending(pending)
    } catch (err) {
      setApiError(humanizeError(err, 'Could not load pending invitations.'))
    }
  }

  useEffect(() => {
    loadMembers()
    loadPending()
    loadRoles()
    authApi.session().then(res => {
      setCurrentUserEmail(res.email ?? null)
      setCurrentUserRole(res.role ?? null)
    }).catch(() => { })
  }, [])

  const loadRoles = async () => {
    try {
      const res = await teamApi.listRoles()
      setRoles(res.roles)
    } catch {
      setApiError('Failed to load team roles.')
    }
  }

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editorInitial, setEditorInitial] = useState<RoleDraft | null>(null)
  const [pendingRoleSave, setPendingRoleSave] = useState<TeamRole | null>(null)
  const [removeRole, setRemoveRole] = useState<TeamRole | null>(null)

  const openCreateRole = () => {
    setEditorMode('create')
    setEditorInitial(null)
    setEditorOpen(true)
  }

  // const openEditRole = (role: TeamRole) => {
  //   setEditorMode('edit')
  //   setEditorInitial({
  //     id: role.id,
  //     name: role.name,
  //     description: role.description,
  //     color: role.color,
  //     permissions: JSON.parse(JSON.stringify(role.permissions)),
  //   })
  //   setEditorOpen(true)
  // }

  const handleRoleSubmit = (draft: RoleDraft) => {
    setEditorOpen(false)
    setPendingRoleSave(draft)
  }

  const finalizeRoleSave = () => {
    if (!pendingRoleSave) return
    const roleToAdd = { ...pendingRoleSave, members: pendingRoleSave.members || 0 }

    // OPTIMISTIC UPDATE: Update UI immediately
    setRoles((prev) => {
      const exists = prev.find((r) => r.id === roleToAdd.id)
      if (exists) return prev.map((r) => (r.id === roleToAdd.id ? roleToAdd : r))
      return [...prev, roleToAdd]
    })

    // SYNC BACKGROUND
    teamApi.saveRole(roleToAdd).catch(err => {
      setApiError('Failed to sync role to server. Please refresh.')
      console.error(err)
    })

    setPendingRoleSave(null)
  }

  const finalizeRoleDelete = () => {
    if (!removeRole) return
    const idToDelete = removeRole.id

    // OPTIMISTIC UPDATE
    setRoles((prev) => prev.filter((r) => r.id !== idToDelete))

    // SYNC BACKGROUND
    teamApi.deleteRole(idToDelete).catch(err => {
      setApiError('Failed to delete role on server.')
      console.error(err)
    })

    setRemoveRole(null)
  }

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [members, search, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart = (page - 1) * PAGE_SIZE
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  // Reset to page 1 if filters change and current page is out of range
  if (page > totalPages) setTimeout(() => setPage(1), 0)

  const submitInvite = () => {
    setInviteOpen(false)
    setInviteTOTP(true)
  }

  const finalizeInvite = async () => {
    setApiError(null)
    try {
      await teamApi.invite(inviteEmail.trim(), inviteRole as any)
      setInviteEmail('')
      setInviteRole('analyst')
      setInviteTOTP(false)
      setInviteOpen(false)
      await loadPending()
    } catch (err) {
      setInviteTOTP(false)
      setInviteOpen(false)
      setApiError(humanizeError(err, 'Could not send invitation.'))
    }
  }

  const finalizeRevokeInvite = async () => {
    if (!revokePending) return
    setApiError(null)
    try {
      await teamApi.revokePending(revokePending.id)
      setRevokePending(null)
      await loadPending()
    } catch (err) {
      setRevokePending(null)
      setApiError(humanizeError(err, 'Could not revoke invitation.'))
    }
  }

  const finalizeRemoveMember = async () => {
    if (!removeMember) return
    setApiError(null)
    try {
      await teamApi.removeMember(removeMember.id)
      setRemoveMember(null)
      await loadMembers()
    } catch (err) {
      setRemoveMember(null)
      setApiError(humanizeError(err, 'Could not remove member.'))
    }
  }

  const handleResendInvite = (p: TeamPending) => {
    setResendPending(p)
  }

  const finalizeResendInvite = async () => {
    if (!resendPending) return
    const id = resendPending.id
    setResendPending(null)
    setApiError(null)
    try {
      await teamApi.resendPending(id)
      await loadPending()
    } catch (err) {
      setApiError(humanizeError(err, 'Could not resend invitation.'))
    }
  }

  return (
    <>
      <Box sx={{ p: 4 }}>
        {apiError && (
          <Alert
            severity="error"
            onClose={() => setApiError(null)}
            sx={{ borderRadius: 0, mb: 2 }}
          >
            {apiError}
          </Alert>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
              Manage
            </Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Team & Roles
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              Control who can access what — based on least-privilege principles
            </Typography>
          </Box>
          <Button
            onClick={() => setInviteOpen(true)}
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
              '&:hover': { bgcolor: 'var(--on-surface)' },
            }}
          >
            Invite Member
          </Button>
        </Box>

        {/* Tabs */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 0 }}>
          {[
            { id: 'members' as const, label: `Members (${members.length})` },
            { id: 'pending' as const, label: `Pending (${pending.length})` },
            { id: 'roles' as const, label: `Roles (${roles.length})` },
          ].map((t) => (
            <Box
              key={t.id}
              onClick={() => setTab(t.id)}
              data-ai-analyzable="true"
              data-ai-description={`Team Management View: ${t.label}.`}
              sx={{
                px: 2.5,
                py: 1.25,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                cursor: 'pointer',
                color: tab === t.id ? colorPalette.primary : '#64748b',
                bgcolor: tab === t.id ? 'var(--card-bg)' : 'transparent',
                border: '1px solid',
                borderColor: tab === t.id ? '#eef0f4' : 'transparent',
                borderBottom: tab === t.id ? '1px solid #ffffff' : '1px solid var(--border-col)',
                marginBottom: '-1px',
                transition: 'all 0.15s',
                '&:hover': { color: colorPalette.primary },
              }}
            >
              {t.label}
            </Box>
          ))}
          <Box sx={{ flex: 1, borderBottom: '1px solid var(--border-col)' }} />
        </Box>

        {/* MEMBERS TAB */}
        {tab === 'members' && (
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderTop: 'none' }}>
            {/* Filter bar */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Stack direction="row" gap={0.5}>
                {[{ id: 'all', label: `All (${members.length})` }, ...roles.map((r) => ({ id: r.id, label: `${r.name.split(' ')[0]} (${members.filter((m) => m.role === r.id).length})` }))].map((f) => (
                  <Box
                    key={f.id}
                    onClick={() => { setRoleFilter(f.id); setPage(1) }}
                    sx={{
                      px: 1.5,
                      py: 0.75,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: roleFilter === f.id ? colorPalette.primary : '#64748b',
                      bgcolor: roleFilter === f.id ? `${colorPalette.primary}0a` : 'transparent',
                      fontFamily: 'Jost',
                      transition: 'all 0.15s',
                      '&:hover': { color: colorPalette.primary },
                    }}
                  >
                    {f.label}
                  </Box>
                ))}
              </Stack>
              <Box sx={{ flex: 1 }} />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'var(--input-bg)',
                  px: 1.5,
                  height: 32,
                  minWidth: 240,
                  border: '1px solid transparent',
                  '&:focus-within': { bgcolor: 'var(--card-bg)', borderColor: colorPalette.primary },
                }}
              >
                <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
                <InputBase
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search by name or email…"
                  inputProps={{ autoComplete: 'off', name: 'team-member-search' }}
                  sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: 'var(--heading-color)' }}
                />
              </Box>
            </Box>

            {/* Header */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 200px 140px 32px',
                gap: 2,
                px: 3,
                py: 1.5,
                bgcolor: 'var(--card-bg)',
                borderBottom: '1px solid var(--border-col)',
              }}
            >
              {['Name', 'Email', 'Role', 'Last Active', ''].map((h) => (
                <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {h}
                </Typography>
              ))}
            </Box>

            {/* Rows */}
            {pageRows.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                  No members match the current filters.
                </Typography>
              </Box>
            ) : (
              pageRows.map((m, i) => {
                const role = roles.find((r) => r.id === m.role) ?? { id: m.role, name: m.role, color: '#94a3b8', description: '', members: 0, permissions: {} }
                return (
                  <Box
                    key={m.email}
                    data-ai-analyzable="true"
                    data-ai-description={`Team Member: ${m.name}. role: ${role.name}. email: ${m.email}. last active: ${m.lastActive}.`}
                    onClick={() => setSelectedMember(m)}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 200px 140px 32px',
                      gap: 2,
                      px: 3,
                      py: 2,
                      alignItems: 'center',
                      borderBottom: i === pageRows.length - 1 ? 'none' : '1px solid var(--border-col)',
                      transition: 'background 0.15s',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#f0f4ff' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <MemberAvatar name={m.name} initials={m.initials} avatarUrl={m.avatarUrl} />
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                        {m.name}
                        {m.email === currentUserEmail && (
                          <Box component="span" sx={{ color: colorPalette.primary, ml: 1, fontWeight: 700, fontSize: '0.75rem' }}>
                            (you)
                          </Box>
                        )}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                      {m.email}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: role.color }} />
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                        {role.name}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {m.lastActive}
                    </Typography>
                    {currentUserRole === 'admin' && m.email !== currentUserEmail && m.role !== 'admin' ? (
                      <IconButton
                        size="small"
                        disableRipple
                        onClick={(e) => { e.stopPropagation(); setRemoveMember(m) }}
                        sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}
                      >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: '1.125rem' }} />
                      </IconButton>
                    ) : (
                      <Box sx={{ width: 32 }} />
                    )}
                  </Box>
                )
              })
            )}

            {/* Pagination */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                px: 3,
                py: 1.5,
                borderTop: '1px solid var(--border-col)',
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                Showing {filtered.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
              </Typography>
              <Stack direction="row" gap={0.5}>
                <Box
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: page === 1 ? '#cbd5e1' : '#475569',
                    border: '1px solid #e5e7eb',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': page === 1 ? {} : { borderColor: colorPalette.primary, color: colorPalette.primary },
                  }}
                >
                  Previous
                </Box>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Box
                    key={i}
                    onClick={() => setPage(i + 1)}
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: page === i + 1 ? '#ffffff' : '#475569',
                      bgcolor: page === i + 1 ? colorPalette.primary : 'transparent',
                      border: '1px solid',
                      borderColor: page === i + 1 ? colorPalette.primary : '#e5e7eb',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: colorPalette.primary, color: page === i + 1 ? '#ffffff' : colorPalette.primary },
                    }}
                  >
                    {i + 1}
                  </Box>
                ))}
                <Box
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: page === totalPages ? '#cbd5e1' : '#475569',
                    border: '1px solid #e5e7eb',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': page === totalPages ? {} : { borderColor: colorPalette.primary, color: colorPalette.primary },
                  }}
                >
                  Next
                </Box>
              </Stack>
            </Box>
          </Box>
        )}

        {/* PENDING TAB */}
        {tab === 'pending' && (
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderTop: 'none' }}>
            {pending.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <MailOutlineRoundedIcon sx={{ fontSize: '2.25rem', color: '#cbd5e1', mb: 1 }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-variant)', mb: 0.5 }}>
                  No pending invitations
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Invited members will appear here until they accept.
                </Typography>
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 200px 180px 120px 100px',
                    gap: 2,
                    px: 3,
                    py: 1.5,
                    bgcolor: 'var(--card-bg)',
                    borderBottom: '1px solid var(--border-col)',
                  }}
                >
                  {['Email', 'Role', 'Invited by', 'Invited', ''].map((h) => (
                    <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {h}
                    </Typography>
                  ))}
                </Box>
                {pending.map((p, i) => {
                  const role = roles.find((r) => r.id === p.role) ?? { id: p.role, name: p.role, color: '#94a3b8', description: '', members: 0, permissions: {} }
                  return (
                    <Box
                      key={p.email}
                      data-ai-analyzable="true"
                      data-ai-description={`Pending Invitation: ${p.email}. role: ${role.name}. invited by: ${p.invitedBy} on ${p.invitedOn}. status: PENDING ACCEPTANCE.`}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 200px 180px 120px 100px',
                        gap: 2,
                        px: 3,
                        py: 2,
                        alignItems: 'center',
                        borderBottom: i === pending.length - 1 ? 'none' : '1px solid var(--border-col)',
                        '&:hover': { bgcolor: 'var(--section-bg)' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            bgcolor: '#fef3c7',
                            color: '#b45309',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <MailOutlineRoundedIcon sx={{ fontSize: '1rem' }} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                            {p.email}
                          </Typography>
                          <Chip
                            label="PENDING ACCEPTANCE"
                            size="small"
                            sx={{
                              bgcolor: '#fef3c7',
                              color: '#b45309',
                              fontWeight: 700,
                              fontSize: '0.5625rem',
                              letterSpacing: '0.1em',
                              borderRadius: 0,
                              height: 16,
                              mt: 0.375,
                              '& .MuiChip-label': { px: 0.625 },
                            }}
                          />
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: role.color }} />
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                          {role.name}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        {p.invitedBy ?? 'Awaiting first login'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {p.invitedOn}
                      </Typography>
                      <Stack direction="row" gap={0.5}>
                        <IconButton
                          size="small"
                          disableRipple
                          title="Resend invitation"
                          onClick={() => handleResendInvite(p)}
                          sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary } }}
                        >
                          <RefreshRoundedIcon sx={{ fontSize: '1.125rem' }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          disableRipple
                          title="Revoke invitation"
                          onClick={() => setRevokePending(p)}
                          sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: '1.125rem' }} />
                        </IconButton>
                      </Stack>
                    </Box>
                  )
                })}
              </>
            )}
          </Box>
        )}

        {/* ROLES TAB */}
        {tab === 'roles' && (
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderTop: 'none' }}>
            {/* Roles header with Create button */}
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                  Roles & permissions
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  Click any role's edit pencil to adjust its access · or create a custom role for your specific workflow
                </Typography>
              </Box>
              {/* Create Custom Role button temporarily hidden */}
            </Box>

            <Box sx={{ overflowX: 'auto' }}>
              <Box sx={{ minWidth: 1100 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: `260px repeat(${roles.length}, 1fr)`, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
                  <Box sx={{ px: 3, py: 2 }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Permission
                    </Typography>
                  </Box>
                  {roles.map((r) => {
                    const isCustom = r.id.startsWith('custom-')
                    return (
                      <Box key={r.id} sx={{ px: 1.5, py: 2, textAlign: 'center', borderLeft: '1px solid var(--border-col)', position: 'relative', '&:hover .role-actions': { opacity: 1 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.625, mb: 0.5 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: r.color }} />
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                            {r.name}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', mb: 0.875 }}>
                          {r.members} member{r.members !== 1 ? 's' : ''}
                          {isCustom && ' · custom'}
                        </Typography>
                        {/* Role modifications are globally locked */}
                      </Box>
                    )
                  })}
                </Box>

                {permissionMatrix.map((section, si) => (
                  <Box key={section.area}>
                    <Box sx={{ px: 3, py: 1.25, bgcolor: 'var(--card-bg)' }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {section.area}
                      </Typography>
                    </Box>
                    {section.actions.map((action, ai) => (
                      <Box
                        key={action.key}
                        data-ai-analyzable="true"
                        data-ai-description={`Permission Audit: ${section.area} - ${action.label}. Analysis of access distribution across all defined roles.`}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: `260px repeat(${roles.length}, 1fr)`,
                          borderBottom: si === permissionMatrix.length - 1 && ai === section.actions.length - 1 ? 'none' : '1px solid var(--border-col)',
                          '&:hover': { bgcolor: 'var(--section-bg)' },
                        }}
                      >
                        <Box sx={{ px: 3, py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
                            {action.label}
                          </Typography>
                        </Box>
                        {roles.map((r) => {
                          const has = getPermission(r, action.key)
                          return (
                            <Box
                              key={r.id}
                              sx={{
                                px: 2,
                                py: 1.5,
                                textAlign: 'center',
                                borderLeft: '1px solid var(--border-col)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {has ? (
                                <Box sx={{ width: 20, height: 20, bgcolor: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#ffffff' }} />
                                </Box>
                              ) : (
                                <Box sx={{ width: 20, height: 20, bgcolor: 'var(--section-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <RemoveRoundedIcon sx={{ fontSize: '0.875rem', color: '#cbd5e1' }} />
                                </Box>
                              )}
                            </Box>
                          )
                        })}
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* MEMBER DETAIL DIALOG */}
      {selectedMember && (
        <MemberDetailDialog
          member={selectedMember}
          role={roles.find(r => r.id === selectedMember.role) ?? null}
          currentUserEmail={currentUserEmail}
          currentUserRole={currentUserRole}
          onClose={() => setSelectedMember(null)}
          onRemove={() => { setSelectedMember(null); setRemoveMember(selectedMember) }}
        />
      )}

      {/* INVITE MODAL — email + role only */}
      {
        inviteOpen && (
          <>
            <Box
              onClick={() => { if (!inviteTOTP) setInviteOpen(false) }}
              sx={{
                position: 'fixed',
                inset: 0,
                bgcolor: 'rgba(15, 23, 42, 0.55)',
                backdropFilter: 'blur(2px)',
                zIndex: 1290,
              }}
            />
            <Box
              sx={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                maxWidth: 460,
                bgcolor: 'var(--card-bg)',
                zIndex: 1291,
                boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
                animation: 'modalIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                '@keyframes modalIn': {
                  from: { opacity: 0, transform: 'translate(-50%, -48%) scale(0.96)' },
                  to: { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
                },
              }}
            >
              <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                    Invite member
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mt: 0.125 }}>
                    Send a secure invitation
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => setInviteOpen(false)}
                  disableRipple
                  sx={{ color: '#94a3b8', borderRadius: 0, '&:hover': { color: colorPalette.primary, bgcolor: 'transparent' } }}
                >
                  <CloseRoundedIcon sx={{ fontSize: '1.25rem' }} />
                </IconButton>
              </Box>

              <Box sx={{ px: 3, py: 3 }}>
                <Stack gap={2}>
                  <Box>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', mb: 0.875, fontFamily: 'Jost' }}>
                      Email address
                    </Typography>
                    <TextField
                      fullWidth
                      autoFocus
                      type="text"
                      placeholder="name@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      inputProps={{ autoComplete: 'new-password', spellCheck: false }}
                      InputProps={{
                        startAdornment: <MailOutlineRoundedIcon sx={{ mr: 1.25, color: '#94a3b8', fontSize: '1.125rem' }} />,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'var(--section-bg)',
                          borderRadius: 0,
                          '& fieldset': { border: '1px solid transparent' },
                          '&:hover fieldset': { borderColor: '#e4dff2' },
                          '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
                          '&.Mui-focused': { bgcolor: 'var(--card-bg)', boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
                        },
                        '& input': { fontSize: '0.875rem', fontFamily: 'Jost', py: '14px', color: 'var(--heading-color)' },
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', mb: 0.875, fontFamily: 'Jost' }}>
                      Assign role
                    </Typography>
                    <Box
                      sx={{
                        position: 'relative',
                        bgcolor: 'var(--section-bg)',
                        border: '1px solid transparent',
                        transition: 'all 0.18s',
                        '&:focus-within': { bgcolor: 'var(--card-bg)', borderColor: colorPalette.primary, boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
                      }}
                    >
                      <Box
                        component="select"
                        value={inviteRole}
                        onChange={(e: any) => setInviteRole(e.target.value)}
                        sx={{
                          width: '100%',
                          bgcolor: 'transparent',
                          border: 'none',
                          outline: 'none',
                          appearance: 'none',
                          py: '14px',
                          pl: 1.75,
                          pr: 4,
                          fontSize: '0.875rem',
                          fontFamily: 'Jost',
                          color: 'var(--heading-color)',
                          cursor: 'pointer',
                        }}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </Box>
                      <ExpandMoreRoundedIcon
                        sx={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#94a3b8',
                          pointerEvents: 'none',
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.875, lineHeight: 1.5 }}>
                      {roles.find((r) => r.id === inviteRole)?.description}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Box sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-col)', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  onClick={() => setInviteOpen(false)}
                  sx={{
                    bgcolor: 'var(--card-bg)',
                    color: 'var(--on-surface-variant)',
                    border: '1px solid var(--border-col)',
                    px: 2.25,
                    py: 1,
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'var(--section-bg)' },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitInvite}
                  disabled={!inviteEmail || !inviteEmail.includes('@')}
                  sx={{
                    bgcolor: colorPalette.primary,
                    color: '#ffffff',
                    px: 2.25,
                    py: 1,
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover:not(:disabled)': { bgcolor: 'var(--on-surface)' },
                    '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
                  }}
                >
                  Send Invitation
                </Button>
              </Box>
            </Box>
          </>
        )
      }

      {/* TOTP — confirm invite */}
      <TOTPConfirmation
        open={inviteTOTP}
        onClose={() => setInviteTOTP(false)}
        onConfirm={finalizeInvite}
        operation="create"
        title="Send team invitation"
        description="Inviting a new member sends them a secure activation link. They will gain the assigned permissions once they accept."
        resourceType="Pending invitation"
        resourceName={`${inviteEmail || '—'} · ${roles.find((r) => r.id === inviteRole)?.name}`}
      />

      {/* TOTP — remove member */}
      <TOTPConfirmation
        open={!!removeMember}
        onClose={() => setRemoveMember(null)}
        onConfirm={finalizeRemoveMember}
        operation="delete"
        title="Remove team member"
        description="This will immediately revoke all access. Open cases assigned to this member will be reassigned to you."
        resourceType="Team member"
        resourceName={removeMember?.name || ''}
        itemsAffected={removeMember ? [`Email: ${removeMember.email}`, `Role: ${roles.find((r) => r.id === removeMember.role)?.name}`, 'All active sessions terminated', 'API tokens revoked'] : []}
      />

      {/* TOTP — revoke pending invitation */}
      <TOTPConfirmation
        open={!!revokePending}
        onClose={() => setRevokePending(null)}
        onConfirm={finalizeRevokeInvite}
        operation="delete"
        title="Revoke invitation"
        description="The invitation link will be invalidated immediately. The recipient will no longer be able to accept and join the team."
        resourceType="Pending invitation"
        resourceName={revokePending?.email || ''}
      />

      {/* TOTP — resend pending invitation */}
      <TOTPConfirmation
        open={!!resendPending}
        onClose={() => setResendPending(null)}
        onConfirm={finalizeResendInvite}
        operation="create"
        title="Resend invitation"
        description="A fresh invitation link will be sent to the recipient. The previous link will be immediately invalidated and the expiry extended by 7 days."
        resourceType="Pending invitation"
        resourceName={resendPending?.email || ''}
      />

      {/* Role editor (create + edit) */}
      <RoleEditor
        open={editorOpen}
        mode={editorMode}
        initial={editorInitial}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleRoleSubmit}
      />

      {/* TOTP — save role (create or edit) */}
      <TOTPConfirmation
        open={!!pendingRoleSave}
        onClose={() => setPendingRoleSave(null)}
        onConfirm={finalizeRoleSave}
        operation={editorMode === 'create' ? 'create' : 'update'}
        title={editorMode === 'create' ? 'Create custom role' : 'Update role permissions'}
        description={
          editorMode === 'create'
            ? 'A new role will be created and immediately available when inviting members. Permission changes are audit-logged.'
            : 'Permission changes apply to every member in this role immediately. Active sessions will see updated access on their next request.'
        }
        resourceType="Role"
        resourceName={pendingRoleSave?.name || ''}
      />

      {/* TOTP — delete custom role */}
      <TOTPConfirmation
        open={!!removeRole}
        onClose={() => setRemoveRole(null)}
        onConfirm={finalizeRoleDelete}
        operation="delete"
        title="Delete custom role"
        description="The role will be removed permanently. Members currently assigned to this role will lose all permissions until reassigned to another role."
        resourceType="Custom role"
        resourceName={removeRole?.name || ''}
        itemsAffected={removeRole ? [`${removeRole.members} member${removeRole.members !== 1 ? 's' : ''} will need reassignment`, 'Audit log entry created', 'Role definition archived for 90 days'] : []}
      />
    </>
  )
}

function humanizeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Your session expired. Please sign in again.'
    if (err.status === 403) return 'You need admin or compliance-officer privileges for this.'
    if (err.code === 'invalid' && err.detail === 'already_invited') {
      return 'That email already has a pending invitation in your institution.'
    }
    if (err.code === 'invalid' && err.detail === 'cannot_remove_self') {
      return "You can't remove yourself from the team."
    }
    if (err.code === 'invalid' && err.detail === 'cannot_remove_admin') {
      return "Administrators cannot be removed for security and account integrity."
    }
    if (err.code === 'feature_disabled') {
      return "Member deletion is currently disabled for your institution."
    }
    if (err.code === 'invalid' && err.detail === 'email') {
      return 'That email address is not valid.'
    }
    if (err.code === 'invalid' && err.detail === 'duplicate_role_name') {
      return "A role with this name already exists in your institution."
    }
    if (err.code === 'invalid' && err.detail === 'role_id') {
      return "Invalid role configuration. Please try again."
    }
    return fallback
  }
  return 'Network error. Please check your connection and try again.'
}
