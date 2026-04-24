import { Alert, Box, Typography, Stack, Button, Chip, IconButton, InputBase, TextField } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import RoleEditor, { type RoleDraft } from '@/components/dashboard/RoleEditor'
import { useState, useMemo, useEffect } from 'react'
import { teamApi, type TeamMember, type TeamPending, type TeamRole } from '@/api/team'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'



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

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('analyst')
  const [inviteTOTP, setInviteTOTP] = useState(false)
  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null)
  const [revokePending, setRevokePending] = useState<TeamPending | null>(null)

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
    }).catch(() => {})
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
  const [editorInitial, setEditorInitial] = useState<RoleDraft | undefined>()
  const [pendingRoleSave, setPendingRoleSave] = useState<TeamRole | null>(null)
  const [removeRole, setRemoveRole] = useState<TeamRole | null>(null)

  const openCreateRole = () => {
    setEditorMode('create')
    setEditorInitial(undefined)
    setEditorOpen(true)
  }

  const openEditRole = (role: TeamRole) => {
    setEditorMode('edit')
    setEditorInitial({
      id: role.id,
      name: role.name,
      description: role.description,
      color: role.color,
      permissions: JSON.parse(JSON.stringify(role.permissions)),
    })
    setEditorOpen(true)
  }

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
    // Opens the TOTP confirmation modal; real API call fires in finalizeInvite.
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

  const handleResendInvite = async (p: TeamPending) => {
    setApiError(null)
    try {
      await teamApi.resendPending(p.id)
      await loadPending()
    } catch (err) {
      setApiError(humanizeError(err, 'Could not resend invitation.'))
    }
  }

  return (
    <DashboardLayout>
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
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
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
              '&:hover': { bgcolor: '#1a3896' },
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
              sx={{
                px: 2.5,
                py: 1.25,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                cursor: 'pointer',
                color: tab === t.id ? colorPalette.primary : '#64748b',
                bgcolor: tab === t.id ? '#ffffff' : 'transparent',
                border: '1px solid',
                borderColor: tab === t.id ? '#eef0f4' : 'transparent',
                borderBottom: tab === t.id ? '1px solid #ffffff' : '1px solid #eef0f4',
                marginBottom: '-1px',
                transition: 'all 0.15s',
                '&:hover': { color: colorPalette.primary },
              }}
            >
              {t.label}
            </Box>
          ))}
          <Box sx={{ flex: 1, borderBottom: '1px solid #eef0f4' }} />
        </Box>

        {/* MEMBERS TAB */}
        {tab === 'members' && (
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', borderTop: 'none' }}>
            {/* Filter bar */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 2 }}>
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
                  bgcolor: '#f8fafc',
                  px: 1.5,
                  height: 32,
                  minWidth: 240,
                  border: '1px solid transparent',
                  '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary },
                }}
              >
                <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
                <InputBase
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search by name or email…"
                  sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a' }}
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
                bgcolor: '#fafbfc',
                borderBottom: '1px solid #eef0f4',
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
                const role = roles.find((r) => r.id === m.role)!
                return (
                  <Box
                    key={m.email}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 200px 140px 32px',
                      gap: 2,
                      px: 3,
                      py: 2,
                      alignItems: 'center',
                      borderBottom: i === pageRows.length - 1 ? 'none' : '1px solid #f4f5f7',
                      transition: 'background 0.15s',
                      '&:hover': { bgcolor: '#fafbfc' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          bgcolor: colorPalette.primary,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          fontFamily: 'Jost',
                        }}
                      >
                        {m.initials}
                      </Box>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost' }}>
                        {m.name}
                        {m.email === currentUserEmail && (
                          <Box component="span" sx={{ color: colorPalette.primary, ml: 1, fontWeight: 700, fontSize: '0.75rem' }}>
                            (you)
                          </Box>
                        )}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                      {m.email}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: role.color }} />
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>
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
                        onClick={() => setRemoveMember(m)}
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
                borderTop: '1px solid #eef0f4',
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
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', borderTop: 'none' }}>
            {pending.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <MailOutlineRoundedIcon sx={{ fontSize: '2.25rem', color: '#cbd5e1', mb: 1 }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', mb: 0.5 }}>
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
                    bgcolor: '#fafbfc',
                    borderBottom: '1px solid #eef0f4',
                  }}
                >
                  {['Email', 'Role', 'Invited by', 'Invited', ''].map((h) => (
                    <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {h}
                    </Typography>
                  ))}
                </Box>
                {pending.map((p, i) => {
                  const role = roles.find((r) => r.id === p.role)!
                  return (
                    <Box
                      key={p.email}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 200px 180px 120px 100px',
                        gap: 2,
                        px: 3,
                        py: 2,
                        alignItems: 'center',
                        borderBottom: i === pending.length - 1 ? 'none' : '1px solid #f4f5f7',
                        '&:hover': { bgcolor: '#fafbfc' },
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
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
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
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>
                          {role.name}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#475569' }}>
                        {p.invitedBy}
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
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', borderTop: 'none' }}>
            {/* Roles header with Create button */}
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  Roles & permissions
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  Click any role's edit pencil to adjust its access · or create a custom role for your specific workflow
                </Typography>
              </Box>
              <Button
                onClick={openCreateRole}
                startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important' }} />}
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
                  '&:hover': { bgcolor: '#1a3896' },
                }}
              >
                Create Custom Role
              </Button>
            </Box>

            <Box sx={{ overflowX: 'auto' }}>
              <Box sx={{ minWidth: 1100 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: `260px repeat(${roles.length}, 1fr)`, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
                  <Box sx={{ px: 3, py: 2 }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Permission
                    </Typography>
                  </Box>
                  {roles.map((r) => {
                    const isCustom = r.id.startsWith('custom-')
                    return (
                      <Box key={r.id} sx={{ px: 1.5, py: 2, textAlign: 'center', borderLeft: '1px solid #eef0f4', position: 'relative', '&:hover .role-actions': { opacity: 1 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.625, mb: 0.5 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: r.color }} />
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
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
                    <Box sx={{ px: 3, py: 1.25, bgcolor: '#fafbfc' }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {section.area}
                      </Typography>
                    </Box>
                    {section.actions.map((action, ai) => (
                      <Box
                        key={action.key}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: `260px repeat(${roles.length}, 1fr)`,
                          borderBottom: si === permissionMatrix.length - 1 && ai === section.actions.length - 1 ? 'none' : '1px solid #f4f5f7',
                          '&:hover': { bgcolor: '#fafbfc' },
                        }}
                      >
                        <Box sx={{ px: 3, py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.8125rem', color: '#475569' }}>
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
                                borderLeft: '1px solid #f4f5f7',
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
                                <Box sx={{ width: 20, height: 20, bgcolor: '#f4f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {/* INVITE MODAL — email + role only */}
      {inviteOpen && (
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
              bgcolor: '#ffffff',
              zIndex: 1291,
              boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
              animation: 'modalIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              '@keyframes modalIn': {
                from: { opacity: 0, transform: 'translate(-50%, -48%) scale(0.96)' },
                to: { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
              },
            }}
          >
            <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                  Invite member
                </Typography>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mt: 0.125 }}>
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
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 0.875, fontFamily: 'Jost' }}>
                    Email address
                  </Typography>
                  <TextField
                    fullWidth
                    autoFocus
                    type="email"
                    placeholder="name@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    InputProps={{
                      startAdornment: <MailOutlineRoundedIcon sx={{ mr: 1.25, color: '#94a3b8', fontSize: '1.125rem' }} />,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#f5f3fb',
                        borderRadius: 0,
                        '& fieldset': { border: '1px solid transparent' },
                        '&:hover fieldset': { borderColor: '#e4dff2' },
                        '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
                        '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
                      },
                      '& input': { fontSize: '0.875rem', fontFamily: 'Jost', py: '14px', color: '#0f172a' },
                    }}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 0.875, fontFamily: 'Jost' }}>
                    Assign role
                  </Typography>
                  <Box
                    sx={{
                      position: 'relative',
                      bgcolor: '#f5f3fb',
                      border: '1px solid transparent',
                      transition: 'all 0.18s',
                      '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary, boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
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
                        color: '#0f172a',
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

            <Box sx={{ px: 3, py: 2, borderTop: '1px solid #eef0f4', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                onClick={() => setInviteOpen(false)}
                sx={{
                  bgcolor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #e5e7eb',
                  px: 2.25,
                  py: 1,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  fontFamily: 'Jost',
                  borderRadius: 0,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#f8fafc' },
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
                  '&:hover:not(:disabled)': { bgcolor: '#1a3896' },
                  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
                }}
              >
                Send Invitation
              </Button>
            </Box>
          </Box>
        </>
      )}

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
    </DashboardLayout>
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
