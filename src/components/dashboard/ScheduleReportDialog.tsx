import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Stack, MenuItem, Switch,
} from '@mui/material'
import { useState, useEffect } from 'react'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import { colorPalette } from '@/theme'
import { nfiuApi, type ReportType, type ScheduleFrequency, type NfiuSchedule } from '@/api/nfiu'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (schedule: NfiuSchedule) => void
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  STR: 'Suspicious Transaction Report (STR)',
  CTR: 'Currency Transaction Report (CTR)',
  SAR: 'Suspicious Activity Report (SAR)',
  ITF: 'International Transfer Filing (ITF)',
  PEP: 'PEP Disclosure Report',
  AML_RETURN: 'Monthly AML Return',
}

function nextDueDefault(frequency: ScheduleFrequency): string {
  const now = new Date()
  if (frequency === 'monthly') {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return next.toISOString().slice(0, 10)
  }
  if (frequency === 'quarterly') {
    const qStart = Math.floor(now.getMonth() / 3) * 3
    const next = new Date(now.getFullYear(), qStart + 3, 1)
    return next.toISOString().slice(0, 10)
  }
  // annually
  return new Date(now.getFullYear() + 1, 0, 1).toISOString().slice(0, 10)
}

export default function ScheduleReportDialog({ open, onClose, onCreated }: Props) {
  const [reportType, setReportType] = useState<ReportType>('AML_RETURN')
  const [name, setName]             = useState('')
  const [frequency, setFrequency]   = useState<ScheduleFrequency>('monthly')
  const [nextDue, setNextDue]       = useState('')
  const [autoFile, setAutoFile]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [done, setDone]             = useState(false)

  useEffect(() => {
    if (!open) return
    setReportType('AML_RETURN')
    setName('Monthly AML Return')
    setFrequency('monthly')
    setNextDue(nextDueDefault('monthly'))
    setAutoFile(false)
    setSaving(false)
    setError(null)
    setDone(false)
  }, [open])

  useEffect(() => {
    setNextDue(nextDueDefault(frequency))
  }, [frequency])

  useEffect(() => {
    setName(REPORT_TYPE_LABELS[reportType])
  }, [reportType])

  const formValid = name.trim() && nextDue

  async function handleSave() {
    if (!formValid) return
    setSaving(true)
    setError(null)
    try {
      const s = await nfiuApi.createSchedule({ reportType, name: name.trim(), frequency, nextDue, autoFile })
      setDone(true)
      onCreated(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 0, border: '1px solid #eef0f4' } }}>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Jost', color: '#00288e', pb: 1.5, borderBottom: '1px solid #eef0f4' }}>
        Schedule recurring report
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        {done ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircleOutlineRoundedIcon sx={{ fontSize: '3rem', color: '#10b981', mb: 1.5 }} />
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 0.5 }}>
              Schedule created
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
              {name} is scheduled {frequency}. You'll be reminded when it's due.
            </Typography>
          </Box>
        ) : (
          <Stack gap={2}>
            <Box>
              <Typography sx={labelSx}>Report type</Typography>
              <TextField fullWidth size="small" select value={reportType}
                onChange={e => setReportType(e.target.value as ReportType)} sx={fieldSx}>
                {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([id, label]) => (
                  <MenuItem key={id} value={id} sx={{ fontSize: '0.875rem' }}>{label}</MenuItem>
                ))}
              </TextField>
            </Box>

            <Box>
              <Typography sx={labelSx}>Schedule name</Typography>
              <TextField fullWidth size="small" value={name}
                onChange={e => setName(e.target.value)} sx={fieldSx}
                placeholder="e.g. Monthly AML Return" />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box>
                <Typography sx={labelSx}>Frequency</Typography>
                <TextField fullWidth size="small" select value={frequency}
                  onChange={e => setFrequency(e.target.value as ScheduleFrequency)} sx={fieldSx}>
                  <MenuItem value="monthly" sx={{ fontSize: '0.875rem' }}>Monthly</MenuItem>
                  <MenuItem value="quarterly" sx={{ fontSize: '0.875rem' }}>Quarterly</MenuItem>
                  <MenuItem value="annually" sx={{ fontSize: '0.875rem' }}>Annually</MenuItem>
                </TextField>
              </Box>
              <Box>
                <Typography sx={labelSx}>Next due date</Typography>
                <TextField fullWidth size="small" type="date" value={nextDue}
                  onChange={e => setNextDue(e.target.value)} sx={fieldSx}
                  InputLabelProps={{ shrink: true }} />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, border: '1px solid #eef0f4', bgcolor: '#fafbfc' }}>
              <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#00288e' }}>Auto-file</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Automatically submit when due (requires approval)</Typography>
              </Box>
              <Switch checked={autoFile} onChange={e => setAutoFile(e.target.checked)}
                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: colorPalette.primary }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: colorPalette.primary } }} />
            </Box>

            <Box sx={{ bgcolor: '#f0f9ff', border: '1px solid #bae6fd', p: 1.5 }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#0369a1', lineHeight: 1.55 }}>
                A reminder will appear on the dashboard when a scheduled report is due. Auto-file submits directly to NFIU and deducts the ₦10,000 filing charge.
              </Typography>
            </Box>

            {error && <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 500 }}>{error}</Typography>}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #eef0f4', gap: 1 }}>
        {done ? (
          <Button fullWidth onClick={onClose} sx={primaryBtn}>Done</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={saving} sx={cancelBtn}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formValid || saving} sx={{ ...primaryBtn, flex: 1 }}>
              {saving ? 'Saving…' : 'Create schedule'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

const labelSx = { fontSize: '0.6875rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.9375rem' } }
const primaryBtn = { borderRadius: 0, fontFamily: 'Jost', fontWeight: 700, textTransform: 'none' as const, bgcolor: colorPalette.primary, color: '#fff', boxShadow: 'none', py: 1.125, '&:hover': { bgcolor: '#1e293b' }, '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }
const cancelBtn  = { borderRadius: 0, fontFamily: 'Jost', fontWeight: 600, textTransform: 'none' as const, color: '#64748b', border: '1px solid #e5e7eb', px: 2.5, py: 1.125, '&:hover': { bgcolor: '#f8fafc' } }
