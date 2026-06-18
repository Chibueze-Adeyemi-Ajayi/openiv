import { Box, Typography, Stack, Button, TextField, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useEffect } from 'react'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'

export interface RolePermissions extends Record<string, any> {
  monitor: { view: boolean; act: boolean }
  cases: { view: boolean; assign: boolean; close: boolean }
  rules: { view: boolean; modify: boolean }
  reports: { view: boolean; file: boolean }
  team: { view: boolean; manage: boolean }
  integrations: { view: boolean; modify: boolean }
}

export interface RoleDraft {
  id: string
  name: string
  description: string
  color: string
  permissions: RolePermissions
}

interface RoleEditorProps {
  open: boolean
  mode: 'create' | 'edit'
  initial: RoleDraft | null
  onClose: () => void
  onSubmit: (draft: RoleDraft) => void
}

const colorChoices = [
  '#dc2626', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#0891b2', // cyan
  '#1e40af', // primary blue
  '#7c3aed', // violet
  '#ec4899', // pink
  '#475569', // slate
]

const permissionGroups: { area: keyof RolePermissions; label: string; actions: { key: string; label: string; desc: string }[] }[] = [
  {
    area: 'monitor',
    label: 'Transaction Monitor',
    actions: [
      { key: 'view', label: 'View live feed', desc: 'See transactions, alerts, risk scores' },
      { key: 'act', label: 'Block / clear', desc: 'Block suspicious or clear false positives' },
    ],
  },
  {
    area: 'cases',
    label: 'Cases',
    actions: [
      { key: 'view', label: 'View cases', desc: 'Read case details and timelines' },
      { key: 'assign', label: 'Assign cases', desc: 'Route cases to specific officers' },
      { key: 'close', label: 'Close cases', desc: 'Resolve and close investigations' },
    ],
  },
  {
    area: 'rules',
    label: 'Rules & Thresholds',
    actions: [
      { key: 'view', label: 'View rules', desc: 'See detection rules and current thresholds' },
      { key: 'modify', label: 'Modify rules', desc: 'Tune thresholds and toggle rules' },
    ],
  },
  {
    area: 'reports',
    label: 'Reports',
    actions: [
      { key: 'view', label: 'View reports', desc: 'Read filed STRs, SARs, returns' },
      { key: 'file', label: 'File NFIU', desc: 'Submit reports to NFIU and CBN' },
    ],
  },
  {
    area: 'team',
    label: 'Team',
    actions: [
      { key: 'view', label: 'View team', desc: 'See team members and roles' },
      { key: 'manage', label: 'Manage team', desc: 'Invite, remove, and change roles' },
    ],
  },
  {
    area: 'integrations',
    label: 'Integrations',
    actions: [
      { key: 'view', label: 'View integrations', desc: 'See webhooks and API connections' },
      { key: 'modify', label: 'Modify integrations', desc: 'Add, edit, and remove integrations' },
    ],
  },
  {
    area: 'cdd',
    label: 'CDD Workflow',
    actions: [
      { key: 'view', label: 'View workflows', desc: 'See CDD workflow definitions and run history' },
      { key: 'manage', label: 'Manage workflows', desc: 'Create, edit, and activate CDD workflows' },
      { key: 'evaluate', label: 'Run evaluations', desc: 'Trigger individual or bulk CDD re-evaluations' },
    ],
  },
  {
    area: 'pipeline',
    label: 'Transaction Pipeline',
    actions: [
      { key: 'view', label: 'View pipeline', desc: 'See transaction scoring pipeline and results' },
      { key: 'modify', label: 'Modify pipeline', desc: 'Configure pipeline rules and thresholds' },
    ],
  },
]

const emptyPermissions: RolePermissions = {
  monitor: { view: false, act: false },
  cases: { view: false, assign: false, close: false },
  rules: { view: false, modify: false },
  reports: { view: false, file: false },
  team: { view: false, manage: false },
  integrations: { view: false, modify: false },
  cdd: { view: false, manage: false, evaluate: false },
  pipeline: { view: false, modify: false },
}

export default function RoleEditor({ open, mode, initial, onClose, onSubmit }: RoleEditorProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(colorChoices[0])
  const [permissions, setPermissions] = useState<RolePermissions>(emptyPermissions)

  useEffect(() => {
    if (open) {
      if (initial) {
        setName(initial.name)
        setDescription(initial.description)
        setColor(initial.color)
        setPermissions(JSON.parse(JSON.stringify(initial.permissions)))
      } else {
        setName('')
        setDescription('')
        setColor(colorChoices[2])
        setPermissions(JSON.parse(JSON.stringify(emptyPermissions)))
      }
    }
  }, [open, initial])

  const togglePerm = (area: keyof RolePermissions, action: string) => {
    setPermissions((prev) => ({
      ...prev,
      [area]: { ...prev[area], [action]: !(prev[area] as any)[action] },
    }))
  }

  const grantedCount = Object.values(permissions).reduce(
    (sum, group) => sum + Object.values(group).filter(Boolean).length,
    0
  )
  const totalPerms = permissionGroups.reduce((sum, g) => sum + g.actions.length, 0)

  const submit = () => {
    if (!name.trim()) return
    onSubmit({
      id: initial?.id || `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || 'Custom role',
      color,
      permissions,
    })
  }

  if (!open) return null

  return (
    <>
      <Box
        onClick={onClose}
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
          maxWidth: 640,
          maxHeight: '90vh',
          bgcolor: 'var(--card-bg)',
          zIndex: 1291,
          boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          '@keyframes modalIn': {
            from: { opacity: 0, transform: 'translate(-50%, -48%) scale(0.96)' },
            to: { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              {mode === 'create' ? 'Create custom role' : 'Edit role'}
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mt: 0.125 }}>
              {mode === 'create' ? 'Define a new role' : `${initial?.name}`}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disableRipple sx={{ color: '#94a3b8', borderRadius: 0, '&:hover': { color: colorPalette.primary, bgcolor: 'transparent' } }}>
            <CloseRoundedIcon sx={{ fontSize: '1.25rem' }} />
          </IconButton>
        </Box>

        {/* Body — scrollable */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
          <Stack gap={2.5}>
            {/* Name */}
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', mb: 0.875, fontFamily: 'Jost' }}>
                Role name
              </Typography>
              <TextField
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Branch Manager, Risk Lead"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'var(--section-bg)',
                    borderRadius: 0,
                    '& fieldset': { border: '1px solid transparent' },
                    '&:hover fieldset': { borderColor: '#e4dff2' },
                    '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
                    '&.Mui-focused': { bgcolor: 'var(--card-bg)', boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
                  },
                  '& input': { fontSize: '0.875rem', fontFamily: 'Jost', py: '12px', color: 'var(--heading-color)' },
                }}
              />
            </Box>

            {/* Description */}
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', mb: 0.875, fontFamily: 'Jost' }}>
                Description
              </Typography>
              <TextField
                fullWidth
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this role is for and who should have it"
                multiline
                rows={2}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'var(--section-bg)',
                    borderRadius: 0,
                    p: '12px',
                    '& fieldset': { border: '1px solid transparent' },
                    '&:hover fieldset': { borderColor: '#e4dff2' },
                    '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
                    '&.Mui-focused': { bgcolor: 'var(--card-bg)', boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
                  },
                  '& textarea': { fontSize: '0.875rem', fontFamily: 'Jost', color: 'var(--heading-color)' },
                }}
              />
            </Box>

            {/* Color */}
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', mb: 0.875, fontFamily: 'Jost' }}>
                Color
              </Typography>
              <Stack direction="row" gap={1}>
                {colorChoices.map((c) => (
                  <Box
                    key={c}
                    onClick={() => setColor(c)}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: c,
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: color === c ? '#00288e' : 'transparent',
                      boxShadow: color === c ? `0 0 0 2px #ffffff inset` : 'none',
                      transition: 'all 0.15s',
                      '&:hover': { transform: 'scale(1.1)' },
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* Permissions */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', fontFamily: 'Jost' }}>
                  Permissions
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {grantedCount} / {totalPerms} granted
                </Typography>
              </Box>

              <Stack gap={1.25}>
                {permissionGroups.map((g) => (
                  <Box key={g.area} sx={{ border: '1px solid var(--border-col)' }}>
                    <Box sx={{ px: 1.5, py: 0.875, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Jost' }}>
                        {g.label}
                      </Typography>
                    </Box>
                    {g.actions.map((a, i) => {
                      const granted = (permissions[g.area] as any)[a.key]
                      return (
                        <Box
                          key={a.key}
                          onClick={() => togglePerm(g.area, a.key)}
                          sx={{
                            px: 1.5,
                            py: 1.25,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                            cursor: 'pointer',
                            borderBottom: i === g.actions.length - 1 ? 'none' : '1px solid var(--border-col)',
                            transition: 'background 0.15s',
                            '&:hover': { bgcolor: 'var(--card-bg)' },
                          }}
                        >
                          <Box
                            sx={{
                              width: 18,
                              height: 18,
                              border: '1.5px solid',
                              borderColor: granted ? color : '#cbd5e1',
                              bgcolor: granted ? color : 'var(--card-bg)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s',
                            }}
                          >
                            {granted && <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#ffffff' }} />}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                              {a.label}
                            </Typography>
                            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.125 }}>
                              {a.desc}
                            </Typography>
                          </Box>
                        </Box>
                      )
                    })}
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Box>

        {/* Footer */}
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
            Saving requires authenticator confirmation
          </Typography>
          <Stack direction="row" gap={1}>
            <Button
              onClick={onClose}
              sx={{
                bgcolor: 'var(--card-bg)',
                color: 'var(--on-surface-variant)',
                border: '1px solid #e5e7eb',
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
              onClick={submit}
              disabled={!name.trim()}
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
              {mode === 'create' ? 'Create Role' : 'Save Changes'}
            </Button>
          </Stack>
        </Box>
      </Box>
    </>
  )
}
