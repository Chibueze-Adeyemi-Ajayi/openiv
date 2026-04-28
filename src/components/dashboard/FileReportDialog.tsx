import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Stack, CircularProgress, MenuItem,
} from '@mui/material'
import { useState, useEffect } from 'react'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined'
import { colorPalette } from '@/theme'
import { nfiuApi, type ReportType, type NfiuReport } from '@/api/nfiu'

interface Props {
  open: boolean
  onClose: () => void
  onFiled: (report: NfiuReport) => void
}

type Step = 'type' | 'details' | 'review' | 'filing' | 'done'

const REPORT_TYPES: {
  id: ReportType; label: string; regulator: string; desc: string
  icon: React.ReactNode; color: string; requiresSubject: boolean
}[] = [
  { id: 'STR', label: 'Suspicious Transaction Report', regulator: 'NFIU', desc: 'Transaction(s) suspected to be linked to money laundering or other financial crime', icon: <DescriptionOutlinedIcon />, color: '#dc2626', requiresSubject: true },
  { id: 'CTR', label: 'Currency Transaction Report', regulator: 'NFIU', desc: 'Cash transactions ≥ ₦5M (individual) or ₦10M (corporate) within a single business day', icon: <AccountBalanceOutlinedIcon />, color: '#d97706', requiresSubject: true },
  { id: 'SAR', label: 'Suspicious Activity Report', regulator: 'NFIU', desc: 'Suspicious activity or attempted transactions not necessarily completed', icon: <GavelOutlinedIcon />, color: '#7c3aed', requiresSubject: true },
  { id: 'ITF', label: 'International Transfer Filing', regulator: 'NFIU', desc: 'Cross-border wire transfers — inbound and outbound — above reporting threshold', icon: <SwapHorizOutlinedIcon />, color: '#0891b2', requiresSubject: true },
  { id: 'PEP', label: 'PEP Disclosure Report', regulator: 'NFIU', desc: 'Transactions and accounts linked to politically exposed persons (domestic or foreign)', icon: <PersonSearchOutlinedIcon />, color: '#be185d', requiresSubject: true },
  { id: 'AML_RETURN', label: 'Monthly AML Return', regulator: 'NFIU', desc: 'Mandatory monthly compliance summary return submitted to the NFIU', icon: <AssignmentTurnedInOutlinedIcon />, color: '#15803d', requiresSubject: false },
]

export default function FileReportDialog({ open, onClose, onFiled }: Props) {
  const [step, setStep]             = useState<Step>('type')
  const [reportType, setReportType] = useState<ReportType>('STR')
  const [priority, setPriority]     = useState('medium')
  const [title, setTitle]           = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd]   = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [subjectAccount, setSubjectAccount] = useState('')
  const [subjectBvn, setSubjectBvn] = useState('')
  const [subjectType, setSubjectType] = useState<'individual' | 'corporate'>('individual')
  const [amountNgn, setAmountNgn]   = useState('')
  const [transactionCount, setTransactionCount] = useState('')
  const [narrative, setNarrative]   = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [draftId, setDraftId]       = useState<number | null>(null)
  const [filedReport, setFiledReport] = useState<NfiuReport | null>(null)

  const meta = REPORT_TYPES.find(t => t.id === reportType)!

  useEffect(() => {
    if (!open) return
    setStep('type')
    setReportType('STR')
    setPriority('medium')
    setTitle('')
    setPeriodStart('')
    setPeriodEnd('')
    setSubjectName('')
    setSubjectAccount('')
    setSubjectBvn('')
    setSubjectType('individual')
    setAmountNgn('')
    setTransactionCount('')
    setNarrative('')
    setError(null)
    setDraftId(null)
    setFiledReport(null)
  }, [open])

  // Auto-set period to current month for AML_RETURN
  useEffect(() => {
    if (reportType === 'AML_RETURN') {
      const now   = new Date()
      const y     = now.getFullYear()
      const m     = String(now.getMonth() + 1).padStart(2, '0')
      const last  = new Date(y, now.getMonth() + 1, 0).getDate()
      setPeriodStart(`${y}-${m}-01`)
      setPeriodEnd(`${y}-${m}-${last}`)
      setTitle(`Monthly AML Return – ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`)
    }
  }, [reportType])

  const detailsValid = title.trim() && periodStart && periodEnd
    && (reportType === 'AML_RETURN' || subjectName.trim())
    && narrative.trim().length >= 20

  async function handleSaveDraft() {
    if (!detailsValid) { setError('Please complete all required fields (narrative min 20 chars)'); return }
    setError(null)
    setStep('review')
  }

  async function handleFile() {
    setStep('filing')
    try {
      let report: NfiuReport
      if (draftId) {
        report = await nfiuApi.fileReport(draftId)
      } else {
        const draft = await nfiuApi.createReport({
          reportType,
          title: title.trim(),
          periodStart,
          periodEnd,
          priority: priority as any,
          subjectName:    subjectName.trim()    || undefined,
          subjectAccount: subjectAccount.trim() || undefined,
          subjectBvn:     subjectBvn.trim()     || undefined,
          subjectType:    meta.requiresSubject ? subjectType : undefined,
          amountNgn:      amountNgn ? parseFloat(amountNgn.replace(/,/g, '')) : undefined,
          transactionCount: transactionCount ? parseInt(transactionCount, 10) : undefined,
          narrative:      narrative.trim(),
        })
        report = await nfiuApi.fileReport(draft.id)
      }
      setFiledReport(report)
      setStep('done')
      onFiled(report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Filing failed')
      setStep('review')
    }
  }

  function handleClose() {
    if (step === 'filing') return
    onClose()
  }

  const titleMap: Record<Step, string> = {
    type: 'File new report', details: 'Report details',
    review: 'Review & file', filing: 'Filing report…', done: 'Report filed',
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 0, border: '1px solid #eef0f4' } }}>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Jost', color: '#0f172a', pb: 1.5, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1 }}>
        {(step === 'details' || step === 'review') && (
          <Box component="span" onClick={() => { setError(null); setStep(step === 'review' ? 'details' : 'type') }}
            sx={{ color: '#94a3b8', cursor: 'pointer', mr: 0.25, lineHeight: 1, '&:hover': { color: '#475569' } }}>←</Box>
        )}
        {titleMap[step]}
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>

        {/* ── DONE ── */}
        {step === 'done' ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircleOutlineRoundedIcon sx={{ fontSize: '3rem', color: '#10b981', mb: 1.5 }} />
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>
              Report filed successfully
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mb: 0.5 }}>
              Reference: <strong style={{ color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>{filedReport?.reference}</strong>
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              ₦10,000 NFIU filing charge applied to your wallet.
            </Typography>
          </Box>

        /* ── FILING ── */
        ) : step === 'filing' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 2 }}>
            <CircularProgress size={40} sx={{ color: colorPalette.primary }} />
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>Submitting to NFIU…</Typography>
          </Box>

        /* ── TYPE SELECTION ── */
        ) : step === 'type' ? (
          <Stack gap={1}>
            {REPORT_TYPES.map(t => (
              <Box key={t.id} onClick={() => setReportType(t.id as ReportType)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75,
                  border: '1.5px solid', cursor: 'pointer',
                  borderColor: reportType === t.id ? colorPalette.primary : '#e2e8f0',
                  bgcolor: reportType === t.id ? `${colorPalette.primary}06` : '#fff',
                  transition: 'border-color 0.15s',
                  '&:hover': { borderColor: reportType === t.id ? colorPalette.primary : '#c7d0e0' },
                }}>
                <Box sx={{ width: 36, height: 36, bgcolor: `${t.color}14`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {t.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>{t.label}</Typography>
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', bgcolor: '#f1f5f9', px: 0.75, py: 0.125, letterSpacing: '0.08em' }}>{t.regulator}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>{t.desc}</Typography>
                </Box>
                <Box sx={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: '2px solid', borderColor: reportType === t.id ? colorPalette.primary : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {reportType === t.id && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: colorPalette.primary }} />}
                </Box>
              </Box>
            ))}
          </Stack>

        /* ── DETAILS ── */
        ) : step === 'details' ? (
          <Stack gap={2}>
            <Box>
              <Typography sx={labelSx}>Report title</Typography>
              <TextField fullWidth autoFocus size="small" value={title}
                onChange={e => setTitle(e.target.value)} sx={fieldSx}
                placeholder={`e.g. ${meta.label} – ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`} />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box>
                <Typography sx={labelSx}>Period start *</Typography>
                <TextField fullWidth size="small" type="date" value={periodStart}
                  onChange={e => setPeriodStart(e.target.value)} sx={fieldSx}
                  InputLabelProps={{ shrink: true }} />
              </Box>
              <Box>
                <Typography sx={labelSx}>Period end *</Typography>
                <TextField fullWidth size="small" type="date" value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)} sx={fieldSx}
                  InputLabelProps={{ shrink: true }} />
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box>
                <Typography sx={labelSx}>Priority</Typography>
                <TextField fullWidth size="small" select value={priority}
                  onChange={e => setPriority(e.target.value)} sx={fieldSx}>
                  {['low', 'medium', 'high'].map(p => <MenuItem key={p} value={p} sx={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>{p}</MenuItem>)}
                </TextField>
              </Box>
              {meta.requiresSubject && (
                <Box>
                  <Typography sx={labelSx}>Subject type</Typography>
                  <TextField fullWidth size="small" select value={subjectType}
                    onChange={e => setSubjectType(e.target.value as any)} sx={fieldSx}>
                    <MenuItem value="individual" sx={{ fontSize: '0.875rem' }}>Individual</MenuItem>
                    <MenuItem value="corporate" sx={{ fontSize: '0.875rem' }}>Corporate</MenuItem>
                  </TextField>
                </Box>
              )}
            </Box>

            {meta.requiresSubject && (
              <>
                <Box>
                  <Typography sx={labelSx}>Subject name *</Typography>
                  <TextField fullWidth size="small" value={subjectName}
                    onChange={e => setSubjectName(e.target.value)} sx={fieldSx}
                    placeholder="Full legal name" />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box>
                    <Typography sx={labelSx}>Account number</Typography>
                    <TextField fullWidth size="small" value={subjectAccount}
                      onChange={e => setSubjectAccount(e.target.value)} sx={fieldSx}
                      inputProps={{ maxLength: 20 }} placeholder="NUBAN / IBAN" />
                  </Box>
                  <Box>
                    <Typography sx={labelSx}>BVN</Typography>
                    <TextField fullWidth size="small" value={subjectBvn}
                      onChange={e => setSubjectBvn(e.target.value.replace(/\D/g, '').slice(0, 11))} sx={fieldSx}
                      inputProps={{ inputMode: 'numeric', maxLength: 11 }} placeholder="11-digit BVN" />
                  </Box>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box>
                    <Typography sx={labelSx}>Amount involved (₦)</Typography>
                    <TextField fullWidth size="small" value={amountNgn}
                      onChange={e => setAmountNgn(e.target.value)} sx={fieldSx}
                      inputProps={{ inputMode: 'decimal' }} placeholder="0.00" />
                  </Box>
                  <Box>
                    <Typography sx={labelSx}>Transaction count</Typography>
                    <TextField fullWidth size="small" value={transactionCount}
                      onChange={e => setTransactionCount(e.target.value.replace(/\D/g, ''))} sx={fieldSx}
                      inputProps={{ inputMode: 'numeric' }} placeholder="0" />
                  </Box>
                </Box>
              </>
            )}

            <Box>
              <Typography sx={labelSx}>Narrative *</Typography>
              <TextField fullWidth multiline rows={4} size="small" value={narrative}
                onChange={e => setNarrative(e.target.value)} sx={fieldSx}
                placeholder="Describe the suspicious activity, basis for filing, and any relevant context. Minimum 20 characters." />
              <Typography sx={{ fontSize: '0.6875rem', color: narrative.length < 20 ? '#f59e0b' : '#94a3b8', mt: 0.5 }}>
                {narrative.length} chars{narrative.length < 20 ? ` (${20 - narrative.length} more required)` : ''}
              </Typography>
            </Box>

            {error && <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 500 }}>{error}</Typography>}
          </Stack>

        /* ── REVIEW ── */
        ) : step === 'review' ? (
          <Stack gap={1.5}>
            <Box sx={{ bgcolor: `${meta.color}0d`, border: `1px solid ${meta.color}30`, p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ color: meta.color, mt: 0.125 }}>{meta.icon}</Box>
              <Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>{meta.label}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>{title}</Typography>
              </Box>
            </Box>

            {[
              ['Period', `${periodStart} → ${periodEnd}`],
              ['Priority', priority.charAt(0).toUpperCase() + priority.slice(1)],
              ...(meta.requiresSubject ? [
                ['Subject', subjectName || '—'],
                ['Account', subjectAccount || '—'],
                ['BVN', subjectBvn || '—'],
                ['Amount', amountNgn ? `₦${parseFloat(amountNgn.replace(/,/g, '')).toLocaleString()}` : '—'],
                ['Transactions', transactionCount || '0'],
              ] : []),
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid #f4f5f7' }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>{label}</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>{value}</Typography>
              </Box>
            ))}

            <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #eef0f4', p: 1.5, mt: 0.5 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>Narrative</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6 }}>{narrative}</Typography>
            </Box>

            <Box sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', p: 1.5, display: 'flex', gap: 1 }}>
              <Typography sx={{ fontSize: '0.875rem' }}>⚠️</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#92400e', lineHeight: 1.55 }}>
                Filing is <strong>final and audit-logged</strong>. A <strong>₦10,000</strong> NFIU filing charge will be deducted from your wallet.
              </Typography>
            </Box>

            {error && <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 500 }}>{error}</Typography>}
          </Stack>

        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #eef0f4', gap: 1 }}>
        {step === 'done' ? (
          <Button fullWidth onClick={handleClose} sx={primaryBtn}>Close</Button>
        ) : step === 'type' ? (
          <>
            <Button onClick={handleClose} sx={cancelBtn}>Cancel</Button>
            <Button onClick={() => setStep('details')} sx={{ ...primaryBtn, flex: 1 }}>Next →</Button>
          </>
        ) : step === 'details' ? (
          <>
            <Button onClick={() => { setError(null); setStep('type') }} sx={cancelBtn}>Back</Button>
            <Button onClick={handleSaveDraft} disabled={!detailsValid} sx={{ ...primaryBtn, flex: 1 }}>Review →</Button>
          </>
        ) : step === 'review' ? (
          <>
            <Button onClick={() => { setError(null); setStep('details') }} sx={cancelBtn}>Back</Button>
            <Button onClick={handleFile} sx={{ ...primaryBtn, flex: 1 }}>File Report</Button>
          </>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}

const labelSx = { fontSize: '0.6875rem', fontWeight: 700, color: '#475569', mb: 0.75, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.9375rem' } }
const primaryBtn = { borderRadius: 0, fontFamily: 'Jost', fontWeight: 700, textTransform: 'none' as const, bgcolor: colorPalette.primary, color: '#fff', boxShadow: 'none', py: 1.125, '&:hover': { bgcolor: '#1a3896' }, '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }
const cancelBtn  = { borderRadius: 0, fontFamily: 'Jost', fontWeight: 600, textTransform: 'none' as const, color: '#64748b', border: '1px solid #e5e7eb', px: 2.5, py: 1.125, '&:hover': { bgcolor: '#f8fafc' } }
