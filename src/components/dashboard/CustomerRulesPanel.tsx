import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Button, Chip, Stack, Switch, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, TextField, InputAdornment, CircularProgress,
  Snackbar, Alert, Tooltip, IconButton,
} from '@mui/material'
import { colorPalette } from '@/theme'
import {
  customerRulesApi,
  type CustomerTransactionRule,
  type CreateRulePayload,
  type RuleType,
  type RuleAction,
  type RuleDirection,
} from '@/api/customerRules'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import { useRbac } from '@/contexts/RbacContext'

interface RuleTypeConfig {
  label: string
  emoji: string
  description: string
  fields: ('amount' | 'banks' | 'channels' | 'velocity' | 'rapidWithdrawal' | 'suddenWithdrawal')[]
}

const RULE_TYPES: Record<RuleType, RuleTypeConfig> = {
  max_single_amount:              { label: 'Max Single Transaction',          emoji: '💳', description: 'Block any single transaction above a set amount.',                                     fields: ['amount'] },
  daily_amount_limit:             { label: 'Daily Spending Limit',            emoji: '📅', description: 'Cap the total amount this customer can spend per day.',                               fields: ['amount'] },
  monthly_amount_limit:           { label: 'Monthly Spending Limit',          emoji: '📆', description: 'Cap total spending in a calendar month.',                                             fields: ['amount'] },
  transaction_velocity:           { label: 'Transaction Velocity',            emoji: '⚡', description: 'Limit how many transactions are allowed in a time window.',                           fields: ['velocity'] },
  blocked_banks:                  { label: 'Blocked Banks',                   emoji: '🚫', description: 'Prevent transactions to or from specific banks.',                                    fields: ['banks'] },
  allowed_banks_only:             { label: 'Allowed Banks Only',              emoji: '✅', description: 'Whitelist — only allow transactions to approved banks.',                              fields: ['banks'] },
  blocked_channels:               { label: 'Blocked Channels',                emoji: '📵', description: 'Prevent use of specific transaction channels.',                                      fields: ['channels'] },
  rapid_post_deposit_withdrawal:    { label: 'Rapid Post-Deposit Withdrawal',      emoji: '🔄', description: 'Flag outward transfers that withdraw a large share of a recent deposit (money laundering signal).', fields: ['rapidWithdrawal'] },
  sudden_withdrawal_after_deposit:  { label: 'Sudden Withdrawal After Deposit',    emoji: '⚡', description: 'Flag or block outward transfers sent within minutes of a deposit — a strong pass-through fraud signal.',  fields: ['suddenWithdrawal'] },
  behavioral_pattern_deviation:     { label: 'Behavioural Pattern Deviation',      emoji: '🧠', description: 'Flag transactions that deviate significantly from this customer\'s historical patterns.',                   fields: [] },
}

const DIRECTION_OPTIONS: { value: RuleDirection; label: string; hint: string }[] = [
  { value: 'both',    label: 'Both directions',  hint: 'Applies to all transactions for this customer.' },
  { value: 'outward', label: 'Outward only',     hint: 'Applies only to money sent by this customer.' },
  { value: 'inward',  label: 'Inward only',      hint: 'Applies only to money received by this customer.' },
]

const ACTION_CONFIG: Record<RuleAction, { label: string; color: string; bg: string; hint: string }> = {
  block: { label: 'BLOCK',  color: '#dc2626', bg: '#fef2f2', hint: 'Transaction is hard-blocked — risk score 100, case auto-created.' },
  flag:  { label: 'FLAG',   color: '#f59e0b', bg: '#fffbeb', hint: 'Transaction is flagged and risk score raised.' },
  alert: { label: 'ALERT',  color: colorPalette.primary, bg: `${colorPalette.primary}10`, hint: 'Notification raised but transaction is not blocked.' },
}

const CHANNELS = ['wire', 'mobile', 'ussd', 'pos', 'bdc', 'atm']

function paramSummary(rule: CustomerTransactionRule): string {
  const p = rule.params
  switch (rule.ruleType) {
    case 'max_single_amount':
    case 'daily_amount_limit':
    case 'monthly_amount_limit': {
      const amt = p.max_amount as number | undefined
      return amt != null ? `₦${Number(amt).toLocaleString()}` : '—'
    }
    case 'transaction_velocity': {
      const mc = p.max_count as number | undefined
      const wh = p.window_hours as number | undefined
      return mc != null ? `${mc} txn / ${wh ?? 24}h` : '—'
    }
    case 'blocked_banks':
    case 'allowed_banks_only': {
      const banks = (p.banks as string[] | undefined) ?? []
      return banks.length ? banks.slice(0, 2).join(', ') + (banks.length > 2 ? ` +${banks.length - 2}` : '') : '—'
    }
    case 'blocked_channels': {
      const ch = (p.channels as string[] | undefined) ?? []
      return ch.length ? ch.join(', ') : '—'
    }
    case 'rapid_post_deposit_withdrawal': {
      const ratio = p.min_withdrawal_ratio as number | undefined
      const wh = p.window_hours as number | undefined
      return ratio != null ? `${Math.round((ratio as number) * 100)}% in ${wh ?? 6}h` : '—'
    }
    case 'sudden_withdrawal_after_deposit': {
      const wm = p.window_minutes as number | undefined
      const minAmt = p.min_amount as number | undefined
      if (wm == null) return '—'
      return `within ${wm}min` + (minAmt ? ` ≥ ₦${Number(minAmt).toLocaleString()}` : '')
    }
    case 'behavioral_pattern_deviation': return 'Auto-detect'
    default: return '—'
  }
}

interface RuleFormState {
  ruleType: RuleType
  action: RuleAction
  direction: RuleDirection
  description: string
  amount: string
  maxCount: string
  windowHours: string
  banks: string
  channels: string[]
  withdrawalRatio: string
  withdrawalWindowHours: string
  suddenWdMinutes: string
  suddenWdMinAmount: string
}

const DEFAULT_FORM: RuleFormState = {
  ruleType: 'max_single_amount',
  action: 'block',
  direction: 'both',
  description: '',
  amount: '',
  maxCount: '',
  windowHours: '24',
  banks: '',
  channels: [],
  withdrawalRatio: '50',
  withdrawalWindowHours: '6',
  suddenWdMinutes: '30',
  suddenWdMinAmount: '',
}

function formToPayload(form: RuleFormState): CreateRulePayload {
  let params: Record<string, unknown> = {}
  const cfg = RULE_TYPES[form.ruleType]
  if (cfg.fields.includes('amount'))           params = { max_amount: Number(form.amount) }
  if (cfg.fields.includes('velocity'))         params = { max_count: Number(form.maxCount), window_hours: Number(form.windowHours) }
  if (cfg.fields.includes('banks'))            params = { banks: form.banks.split(',').map(b => b.trim()).filter(Boolean) }
  if (cfg.fields.includes('channels'))         params = { channels: form.channels }
  if (cfg.fields.includes('rapidWithdrawal'))  params = { min_withdrawal_ratio: Number(form.withdrawalRatio) / 100, window_hours: Number(form.withdrawalWindowHours) }
  if (cfg.fields.includes('suddenWithdrawal')) {
    params = { window_minutes: Number(form.suddenWdMinutes) }
    if (form.suddenWdMinAmount) params.min_amount = Number(form.suddenWdMinAmount)
  }
  return { ruleType: form.ruleType, params, action: form.action, direction: form.direction, description: form.description || undefined }
}

function ruleToForm(rule: CustomerTransactionRule): RuleFormState {
  const p = rule.params
  return {
    ruleType: rule.ruleType,
    action: rule.action,
    direction: (rule.direction as RuleDirection) ?? 'both',
    description: rule.description ?? '',
    amount: (p.max_amount as number | undefined)?.toString() ?? '',
    maxCount: (p.max_count as number | undefined)?.toString() ?? '',
    windowHours: (p.window_hours as number | undefined)?.toString() ?? '24',
    banks: ((p.banks as string[] | undefined) ?? []).join(', '),
    channels: (p.channels as string[] | undefined) ?? [],
    withdrawalRatio: p.min_withdrawal_ratio != null ? String(Math.round((p.min_withdrawal_ratio as number) * 100)) : '50',
    withdrawalWindowHours: (p.window_hours as number | undefined)?.toString() ?? '6',
    suddenWdMinutes: (p.window_minutes as number | undefined)?.toString() ?? '30',
    suddenWdMinAmount: (p.min_amount as number | undefined)?.toString() ?? '',
  }
}

export default function CustomerRulesPanel({ customerId }: { customerId: string }) {
  const { can } = useRbac()
  const canModify = can('rules.modify')
  const [rules, setRules]             = useState<CustomerTransactionRule[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [editTarget, setEditTarget]   = useState<CustomerTransactionRule | null>(null)
  const [saving, setSaving]           = useState(false)
  const [deleteId, setDeleteId]       = useState<number | null>(null)
  const [form, setForm]               = useState<RuleFormState>(DEFAULT_FORM)
  const [snack, setSnack]             = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await customerRulesApi.list(customerId)
      setRules(res.rules)
    } catch {
      setError('Failed to load transaction rules.')
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditTarget(null)
    setForm(DEFAULT_FORM)
    setDialogOpen(true)
  }

  const openEdit = (rule: CustomerTransactionRule) => {
    setEditTarget(rule)
    setForm(ruleToForm(rule))
    setDialogOpen(true)
  }

  const handleToggle = async (rule: CustomerTransactionRule, isActive: boolean) => {
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive } : r))
    try {
      await customerRulesApi.toggle(customerId, rule.id, isActive)
    } catch {
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: !isActive } : r))
      setSnack({ open: true, msg: 'Failed to toggle rule.', sev: 'error' })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = formToPayload(form)
      if (editTarget) {
        await customerRulesApi.update(customerId, editTarget.id, { ...payload, isActive: editTarget.isActive })
      } else {
        await customerRulesApi.create(customerId, payload)
      }
      setDialogOpen(false)
      await load()
      setSnack({ open: true, msg: editTarget ? 'Rule updated.' : 'Rule created.', sev: 'success' })
    } catch {
      setSnack({ open: true, msg: 'Failed to save rule.', sev: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    try {
      await customerRulesApi.delete(customerId, deleteId)
      setDeleteId(null)
      await load()
      setSnack({ open: true, msg: 'Rule deleted.', sev: 'success' })
    } catch {
      setSnack({ open: true, msg: 'Failed to delete rule.', sev: 'error' })
    }
  }

  const cfg = RULE_TYPES[form.ruleType]

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            Transaction Rules
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Per-customer restrictions enforced on every incoming transaction.
          </Typography>
        </Box>
        {canModify && (
          <Button
            startIcon={<AddOutlinedIcon />}
            onClick={openAdd}
            sx={{ bgcolor: colorPalette.primary, color: '#fff', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: 0, px: 2, py: 0.875, whiteSpace: 'nowrap', flexShrink: 0, '&:hover': { bgcolor: '#1e293b' } }}
          >
            Add Rule
          </Button>
        )}
      </Box>

      {/* Loading */}
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: colorPalette.primary }} /></Box>}

      {/* Error */}
      {!loading && error && (
        <Box sx={{ p: 2, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
          <Typography sx={{ color: '#dc2626', fontSize: '0.875rem' }}>{error}</Typography>
          <Button onClick={load} sx={{ mt: 1, fontFamily: 'Jost', textTransform: 'none', color: colorPalette.primary, fontSize: '0.8125rem' }}>Retry</Button>
        </Box>
      )}

      {/* Empty state */}
      {!loading && !error && rules.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8, border: '1px dashed #e2e8f0' }}>
          <ShieldOutlinedIcon sx={{ fontSize: '2.5rem', color: '#cbd5e1', mb: 1 }} />
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#64748b' }}>No rules configured</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', mb: 2 }}>Add rules to restrict or monitor this customer's transactions.</Typography>
          {canModify && (
            <Button onClick={openAdd} sx={{ bgcolor: colorPalette.primary, color: '#fff', fontFamily: 'Jost', fontWeight: 600, textTransform: 'none', borderRadius: 0, px: 2, '&:hover': { bgcolor: '#1e293b' } }}>
              Add the first rule
            </Button>
          )}
        </Box>
      )}

      {/* Rules list */}
      {!loading && !error && rules.map(rule => {
        const rt = RULE_TYPES[rule.ruleType]
        const ac = ACTION_CONFIG[rule.action]
        return (
          <Box
            key={rule.id}
            sx={{
              border: '1px solid #e5e7eb',
              mb: 1.5,
              px: 2.5,
              py: 1.75,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              opacity: rule.isActive ? 1 : 0.5,
              transition: 'opacity 0.2s',
            }}
          >
            {/* Type */}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{rt.emoji}</Typography>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>{rt.label}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                {rule.description || rt.description}
              </Typography>
            </Box>

            {/* Summary */}
            <Box sx={{ minWidth: 120, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155', fontFamily: 'Jost' }}>{paramSummary(rule)}</Typography>
              <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>constraint</Typography>
            </Box>

            {/* Direction badge */}
            {rule.direction && rule.direction !== 'both' && (
              <Chip
                label={rule.direction === 'inward' ? 'INWARD' : 'OUTWARD'}
                size="small"
                sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: '0.5625rem', letterSpacing: '0.08em', borderRadius: 0, height: 18, '& .MuiChip-label': { px: 0.75 } }}
              />
            )}

            {/* Action chip */}
            <Chip
              label={ac.label}
              size="small"
              sx={{ bgcolor: ac.bg, color: ac.color, fontWeight: 700, fontSize: '0.625rem', letterSpacing: '0.1em', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 } }}
            />

            {/* Toggle */}
            <Tooltip title={!canModify ? 'You do not have permission to modify rules' : rule.isActive ? 'Disable rule' : 'Enable rule'}>
              <Switch
                size="small"
                checked={rule.isActive}
                disabled={!canModify}
                onChange={e => handleToggle(rule, e.target.checked)}
                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: colorPalette.primary }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: colorPalette.primary } }}
              />
            </Tooltip>

            {/* Actions */}
            {canModify && (
              <Stack direction="row" gap={0.5}>
                <Tooltip title="Edit rule">
                  <IconButton size="small" onClick={() => openEdit(rule)} sx={{ color: '#64748b', '&:hover': { color: colorPalette.primary } }}>
                    <EditOutlinedIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete rule">
                  <IconButton size="small" onClick={() => setDeleteId(rule.id)} sx={{ color: '#64748b', '&:hover': { color: '#dc2626' } }}>
                    <DeleteOutlineIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          </Box>
        )
      })}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 0 } }}>
        <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 700, color: '#00288e', fontSize: '1rem', borderBottom: '1px solid #eef0f4', pb: 1.5 }}>
          {editTarget ? 'Edit Rule' : 'Add Transaction Rule'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack gap={2.5}>
            {/* Rule type */}
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Rule Type</Typography>
              <Select
                fullWidth size="small" value={form.ruleType}
                disabled={!!editTarget}
                onChange={e => setForm(f => ({ ...DEFAULT_FORM, ruleType: e.target.value as RuleType, action: f.action, description: f.description }))}
                sx={{ borderRadius: 0, fontFamily: 'Jost', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}
              >
                {(Object.entries(RULE_TYPES) as [RuleType, RuleTypeConfig][]).map(([key, val]) => (
                  <MenuItem key={key} value={key} sx={{ fontFamily: 'Jost' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{val.emoji}</span>
                      <Box>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{val.label}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{val.description}</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Divider />

            {/* Dynamic fields */}
            {cfg.fields.includes('amount') && (
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Amount Limit</Typography>
                <TextField
                  fullWidth size="small" type="number" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.875rem', color: '#475569' }}>₦</Typography></InputAdornment> }}
                  placeholder="e.g. 500000"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                />
              </Box>
            )}

            {cfg.fields.includes('velocity') && (
              <Stack direction="row" gap={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Max Transactions</Typography>
                  <TextField fullWidth size="small" type="number" value={form.maxCount}
                    onChange={e => setForm(f => ({ ...f, maxCount: e.target.value }))}
                    placeholder="e.g. 5"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Window (hours)</Typography>
                  <TextField fullWidth size="small" type="number" value={form.windowHours}
                    onChange={e => setForm(f => ({ ...f, windowHours: e.target.value }))}
                    placeholder="e.g. 24"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }} />
                </Box>
              </Stack>
            )}

            {cfg.fields.includes('banks') && (
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Banks (comma-separated)</Typography>
                <TextField
                  fullWidth size="small" value={form.banks}
                  onChange={e => setForm(f => ({ ...f, banks: e.target.value }))}
                  placeholder="e.g. GTBank, Access Bank, Zenith"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                />
                <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>Partial name match is supported (case-insensitive).</Typography>
              </Box>
            )}

            {cfg.fields.includes('channels') && (
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Channels</Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {CHANNELS.map(ch => (
                    <Chip
                      key={ch} label={ch.toUpperCase()} clickable
                      onClick={() => setForm(f => ({
                        ...f,
                        channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch],
                      }))}
                      sx={{
                        borderRadius: 0, fontWeight: 700, fontSize: '0.6875rem', height: 28,
                        bgcolor: form.channels.includes(ch) ? colorPalette.primary : '#f1f5f9',
                        color: form.channels.includes(ch) ? '#fff' : '#475569',
                        '&:hover': { bgcolor: form.channels.includes(ch) ? '#1e293b' : '#e2e8f0' },
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {cfg.fields.includes('rapidWithdrawal') && (
              <Stack direction="row" gap={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Min Withdrawal % of Deposit</Typography>
                  <TextField fullWidth size="small" type="number" value={form.withdrawalRatio}
                    onChange={e => setForm(f => ({ ...f, withdrawalRatio: e.target.value }))}
                    placeholder="e.g. 50"
                    InputProps={{ endAdornment: <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8', pl: 0.5 }}>%</Typography> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }} />
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>Flag if withdrawal exceeds this % of recent deposit.</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lookback Window (hours)</Typography>
                  <TextField fullWidth size="small" type="number" value={form.withdrawalWindowHours}
                    onChange={e => setForm(f => ({ ...f, withdrawalWindowHours: e.target.value }))}
                    placeholder="e.g. 6"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }} />
                </Box>
              </Stack>
            )}

            {cfg.fields.includes('suddenWithdrawal') && (
              <Stack direction="row" gap={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Time Window (minutes)</Typography>
                  <TextField fullWidth size="small" type="number" value={form.suddenWdMinutes}
                    onChange={e => setForm(f => ({ ...f, suddenWdMinutes: e.target.value }))}
                    placeholder="e.g. 30"
                    InputProps={{ endAdornment: <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8', pl: 0.5 }}>min</Typography> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }} />
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>Flag if a withdrawal occurs within this many minutes of a deposit.</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Min Withdrawal Amount (optional)</Typography>
                  <TextField fullWidth size="small" type="number" value={form.suddenWdMinAmount}
                    onChange={e => setForm(f => ({ ...f, suddenWdMinAmount: e.target.value }))}
                    placeholder="e.g. 50000 — leave blank for any amount"
                    InputProps={{ startAdornment: <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8', pr: 0.5 }}>₦</Typography> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }} />
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>Only trigger if the withdrawal is at least this amount.</Typography>
                </Box>
              </Stack>
            )}

            <Divider />

            {/* Direction */}
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Applies To</Typography>
              <Stack gap={0.75}>
                {DIRECTION_OPTIONS.map(d => (
                  <Box key={d.value} onClick={() => setForm(f => ({ ...f, direction: d.value }))}
                    sx={{ px: 1.5, py: 0.875, border: `1px solid ${form.direction === d.value ? colorPalette.primary : '#e2e8f0'}`,
                      bgcolor: form.direction === d.value ? `${colorPalette.primary}08` : '#fff',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, transition: 'all 0.15s' }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${form.direction === d.value ? colorPalette.primary : '#cbd5e1'}`,
                      bgcolor: form.direction === d.value ? colorPalette.primary : 'transparent', flexShrink: 0 }} />
                    <Box>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>{d.label}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>{d.hint}</Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* Action */}
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Action When Triggered</Typography>
              <Stack gap={1}>
                {(Object.entries(ACTION_CONFIG) as [RuleAction, typeof ACTION_CONFIG[RuleAction]][]).map(([key, ac]) => (
                  <Box
                    key={key}
                    onClick={() => setForm(f => ({ ...f, action: key }))}
                    sx={{
                      px: 1.5, py: 1, border: `1px solid ${form.action === key ? ac.color : '#e2e8f0'}`,
                      bgcolor: form.action === key ? ac.bg : '#fff',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5,
                      transition: 'all 0.15s',
                    }}
                  >
                    <Chip label={ac.label} size="small" sx={{ bgcolor: ac.bg, color: ac.color, fontWeight: 700, fontSize: '0.625rem', borderRadius: 0, height: 18, '& .MuiChip-label': { px: 0.75 } }} />
                    <Typography sx={{ fontSize: '0.8125rem', color: '#334155' }}>{ac.hint}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* Description */}
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Note (optional)</Typography>
              <TextField
                fullWidth size="small" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Flagged by compliance review Q1 2025"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #eef0f4', gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ fontFamily: 'Jost', textTransform: 'none', color: '#64748b', borderRadius: 0 }}>Cancel</Button>
          <Button
            onClick={handleSave} disabled={saving}
            sx={{ bgcolor: colorPalette.primary, color: '#fff', fontFamily: 'Jost', fontWeight: 600, textTransform: 'none', borderRadius: 0, px: 2.5, '&:hover': { bgcolor: '#1e293b' }, '&.Mui-disabled': { bgcolor: '#94a3b8', color: '#fff' } }}
          >
            {saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : editTarget ? 'Save Changes' : 'Create Rule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId != null} onClose={() => setDeleteId(null)} PaperProps={{ sx: { borderRadius: 0, maxWidth: 400 } }}>
        <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>Delete Rule?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
            This rule will stop being enforced immediately. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ fontFamily: 'Jost', textTransform: 'none', color: '#64748b', borderRadius: 0 }}>Cancel</Button>
          <Button
            onClick={handleDelete}
            sx={{ bgcolor: '#dc2626', color: '#fff', fontFamily: 'Jost', fontWeight: 600, textTransform: 'none', borderRadius: 0, px: 2, '&:hover': { bgcolor: '#b91c1c' } }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: 0 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
