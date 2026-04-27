import { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Typography, Stack, InputBase } from '@mui/material'
import { colorPalette } from '@/theme'
import { transactionApi, type Transaction } from '@/api/transactions'
import { type CreateCaseInput, type CasePriority, type EvidenceCategory, type AddEvidenceInput } from '@/api/cases'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import ActionEvidenceDialog, { type EvidencePayload } from '@/components/dashboard/ActionEvidenceDialog'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'

export interface CaseIntakePayload {
  caseInput: CreateCaseInput
  evidence: AddEvidenceInput
}

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (payload: CaseIntakePayload) => void  // parent handles TOTP + API
  initialTransaction?: Transaction
}

const ACTIVITY_TYPES: { value: EvidenceCategory; label: string; desc: string; icon: string }[] = [
  { value: 'transaction', label: 'Transaction',      desc: 'Suspicious payment or transfer',         icon: '💳' },
  { value: 'kyc',         label: 'KYC',              desc: 'Identity or document concern',            icon: '🪪' },
  { value: 'behavior',    label: 'Behavior Pattern', desc: 'Velocity, structuring or layering',       icon: '📊' },
  { value: 'device',      label: 'Device / IP',      desc: 'Technical fraud signal',                  icon: '💻' },
  { value: 'otp',         label: 'OTP / Fingerprint',desc: 'Auth anomaly or biometric flag',          icon: '🔐' },
  { value: 'document',    label: 'Document',         desc: 'Supporting evidence or filing',            icon: '📄' },
  { value: 'other',       label: 'Other',            desc: 'Any other investigable signal',            icon: '📝' },
]

const TYPOLOGIES = [
  'BDC Structuring', 'Layering', 'Velocity Breach', 'Cross-border Anomaly',
  'Smurfing', 'Insider Threat', 'Account Takeover', 'OTP Fraud', 'Identity Theft', 'Other',
]

const PRIORITIES: { value: CasePriority; label: string; color: string }[] = [
  { value: 'low',      label: 'Low',      color: '#64748b' },
  { value: 'medium',   label: 'Medium',   color: '#f59e0b' },
  { value: 'high',     label: 'High',     color: '#ea580c' },
  { value: 'critical', label: 'Critical', color: '#dc2626' },
]

function riskColor(n: number) {
  return n >= 70 ? '#dc2626' : n >= 40 ? '#f59e0b' : '#10b981'
}

function fmtAmount(amount: number, currency = 'NGN') {
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount) }
  catch { return `₦${amount.toLocaleString()}` }
}

interface SubjectState {
  // transaction
  txnSearch: string
  txnResults: Transaction[]
  txnSearching: boolean
  selectedTxn: Transaction | null
  // kyc
  kycName: string
  kycAccount: string
  kycBank: string
  kycConcern: string
  // behavior
  behaviorPattern: string
  behaviorDesc: string
  behaviorPeriod: string
  // device
  deviceId: string
  ipAddress: string
  deviceNotes: string
  // otp
  otpType: string
  otpRef: string
  otpDesc: string
  // document
  docType: string
  docRef: string
  docNotes: string
  // other
  otherTitle: string
  otherDesc: string
}

const EMPTY_SUBJECT: SubjectState = {
  txnSearch: '', txnResults: [], txnSearching: false, selectedTxn: null,
  kycName: '', kycAccount: '', kycBank: '', kycConcern: '',
  behaviorPattern: '', behaviorDesc: '', behaviorPeriod: '',
  deviceId: '', ipAddress: '', deviceNotes: '',
  otpType: '', otpRef: '', otpDesc: '',
  docType: '', docRef: '', docNotes: '',
  otherTitle: '', otherDesc: '',
}

function deriveEvidence(type: EvidenceCategory, s: SubjectState): AddEvidenceInput | null {
  switch (type) {
    case 'transaction':
      if (!s.selectedTxn) return null
      return { category: 'transaction', title: `TXN ${s.selectedTxn.id} · ${s.selectedTxn.customer}`, detail: `Amount: ${fmtAmount(s.selectedTxn.amount, s.selectedTxn.currency)} · Risk: ${s.selectedTxn.risk}`, refId: s.selectedTxn.id }
    case 'kyc':
      if (!s.kycName.trim()) return null
      return { category: 'kyc', title: `KYC Review — ${s.kycName.trim()}`, detail: [s.kycAccount && `Account: ${s.kycAccount}`, s.kycBank && `Bank: ${s.kycBank}`, s.kycConcern].filter(Boolean).join('\n') || undefined }
    case 'behavior':
      if (!s.behaviorPattern.trim() && !s.behaviorDesc.trim()) return null
      return { category: 'behavior', title: `Behavior — ${s.behaviorPattern.trim() || 'Pattern observed'}`, detail: [s.behaviorPeriod && `Period: ${s.behaviorPeriod}`, s.behaviorDesc].filter(Boolean).join('\n') || undefined }
    case 'device':
      if (!s.deviceId.trim() && !s.ipAddress.trim()) return null
      return { category: 'device', title: `Device/IP — ${s.deviceId.trim() || s.ipAddress.trim()}`, detail: [s.deviceId && `Device ID: ${s.deviceId}`, s.ipAddress && `IP: ${s.ipAddress}`, s.deviceNotes].filter(Boolean).join('\n') || undefined }
    case 'otp':
      if (!s.otpType.trim() && !s.otpRef.trim()) return null
      return { category: 'otp', title: `OTP/Fingerprint — ${s.otpType.trim() || s.otpRef.trim()}`, detail: [s.otpRef && `Reference: ${s.otpRef}`, s.otpDesc].filter(Boolean).join('\n') || undefined }
    case 'document':
      if (!s.docType.trim()) return null
      return { category: 'document', title: `Document — ${s.docType.trim()}`, detail: [s.docRef && `Reference: ${s.docRef}`, s.docNotes].filter(Boolean).join('\n') || undefined }
    case 'other':
      if (!s.otherTitle.trim()) return null
      return { category: 'other', title: s.otherTitle.trim(), detail: s.otherDesc.trim() || undefined }
  }
}

function deriveTitle(type: EvidenceCategory, s: SubjectState): string {
  switch (type) {
    case 'transaction': return s.selectedTxn ? `${s.selectedTxn.id} · ${s.selectedTxn.customer}` : ''
    case 'kyc':         return s.kycName.trim() ? `KYC — ${s.kycName.trim()}` : ''
    case 'behavior':    return s.behaviorPattern.trim() ? `Behavior — ${s.behaviorPattern.trim()}` : ''
    case 'device':      return (s.deviceId || s.ipAddress).trim() ? `Device/IP — ${(s.deviceId || s.ipAddress).trim()}` : ''
    case 'otp':         return (s.otpType || s.otpRef).trim() ? `OTP — ${(s.otpType || s.otpRef).trim()}` : ''
    case 'document':    return s.docType.trim() ? `Document — ${s.docType.trim()}` : ''
    case 'other':       return s.otherTitle.trim()
  }
}

export default function CaseIntakeDrawer({ open, onClose, onSubmit, initialTransaction }: Props) {
  const [activityType, setActivityType] = useState<EvidenceCategory>('transaction')
  const [subject, setSubject]           = useState<SubjectState>(EMPTY_SUBJECT)
  const [typology,  setTypology]        = useState(TYPOLOGIES[0])
  const [priority,  setPriority]        = useState<CasePriority>('high')
  const [riskScore, setRiskScore]       = useState(50)
  const [caseTitle, setCaseTitle]       = useState('')
  const [caseNotes, setCaseNotes]       = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [totpOpen, setTotpOpen]         = useState(false)
  const pendingRef = useRef<CaseIntakePayload | null>(null)
  const txnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      const initTxn = initialTransaction ?? null
      setActivityType('transaction')
      setSubject({ ...EMPTY_SUBJECT, selectedTxn: initTxn })
      setTypology(TYPOLOGIES[0])
      const initRisk = initTxn?.risk ?? 50
      const initPriority: CasePriority = initRisk >= 80 ? 'critical' : initRisk >= 70 ? 'high' : initRisk >= 40 ? 'medium' : 'low'
      setPriority(initPriority)
      setRiskScore(initRisk)
      setCaseTitle(initTxn ? `${initTxn.id} · ${initTxn.customer}` : '')
      setCaseNotes('')
      setTitleTouched(false)
    }
  }, [open, initialTransaction])

  // Auto-fill title from subject when not manually touched
  useEffect(() => {
    if (!titleTouched) {
      const auto = deriveTitle(activityType, subject)
      if (auto) setCaseTitle(auto)
    }
  }, [activityType, subject, titleTouched])

  const searchTxns = (q: string) => {
    setSubject(s => ({ ...s, txnSearch: q, txnSearching: true }))
    if (txnTimer.current) clearTimeout(txnTimer.current)
    txnTimer.current = setTimeout(async () => {
      try {
        const res = await transactionApi.list({ q, pageSize: 8 })
        setSubject(s => ({ ...s, txnResults: res.transactions, txnSearching: false }))
      } catch {
        setSubject(s => ({ ...s, txnSearching: false }))
      }
    }, 300)
  }

  const evidence = deriveEvidence(activityType, subject)
  const canSubmit = !!evidence && caseTitle.trim().length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    setEvidenceOpen(true)
  }

  const handleEvidenceConfirm = useCallback((ev: EvidencePayload) => {
    setEvidenceOpen(false)
    const payload: CaseIntakePayload = {
      caseInput: {
        title: caseTitle.trim(),
        typology,
        priority,
        riskScore,
        notes: caseNotes.trim() || undefined,
        transactionId: activityType === 'transaction' && subject.selectedTxn ? subject.selectedTxn.id : undefined,
        reason: ev.reason,
        documentId: ev.documentId,
      },
      evidence: evidence!,
    }
    pendingRef.current = payload
    onClose()
    setTotpOpen(true)
  }, [caseTitle, typology, priority, riskScore, caseNotes, activityType, subject.selectedTxn, evidence, onClose])

  const afterTotpVerified = useCallback(() => {
    const p = pendingRef.current
    if (p) onSubmit(p)
  }, [onSubmit])

  if (!open && !totpOpen && !evidenceOpen) return null

  return (
    <>
      {open && (
        <>
          <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.35)', zIndex: 1299 }} />
          <Box sx={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 560,
            bgcolor: '#ffffff', zIndex: 1300,
            boxShadow: '-12px 0 48px rgba(15,23,42,0.16)',
            display: 'flex', flexDirection: 'column',
            animation: 'slideIntake 0.24s cubic-bezier(0.4,0,0.2,1)',
            '@keyframes slideIntake': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
          }}>
            {/* Header */}
            <Box sx={{ flexShrink: 0, px: 3, pt: 2.5, pb: 2, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <GavelOutlinedIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Open Investigation Case</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.125 }}>Select what you are investigating and fill the case details below</Typography>
              </Box>
              <Box onClick={onClose} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, cursor: 'pointer', color: '#94a3b8', '&:hover': { color: '#475569' } }}>
                <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
              </Box>
            </Box>

            {/* Scrollable body */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>

              {/* ── Section 1: Investigation subject ─────────────────────── */}
              <SectionLabel>Investigation Subject</SectionLabel>

              {/* Activity type pills */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                {ACTIVITY_TYPES.map(at => {
                  const on = activityType === at.value
                  return (
                    <Box key={at.value} onClick={() => { setActivityType(at.value); setSubject({ ...EMPTY_SUBJECT, selectedTxn: initialTransaction ?? null }) }} sx={{
                      p: 1.25, border: '1px solid', cursor: 'pointer',
                      borderColor: on ? colorPalette.primary : '#e2e8f0',
                      bgcolor:     on ? `${colorPalette.primary}08` : '#fafbfc',
                      transition: 'all 0.12s',
                      '&:hover': { borderColor: on ? colorPalette.primary : '#94a3b8' },
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                        <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{at.icon}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: on ? colorPalette.primary : '#0f172a', fontFamily: 'Jost' }}>
                          {at.label}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', pl: 2.25 }}>{at.desc}</Typography>
                    </Box>
                  )
                })}
              </Box>

              {/* Subject detail form — changes based on type */}
              <Box sx={{ mb: 2.5, p: 1.5, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.25 }}>
                  {ACTIVITY_TYPES.find(a => a.value === activityType)?.label} Details
                </Typography>

                {activityType === 'transaction' && (
                  <>
                    {initialTransaction ? (
                      // Pre-filled from transaction panel — show as locked
                      <TxnCard txn={initialTransaction} selected />
                    ) : (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#ffffff', border: '1px solid #e2e8f0', px: 1.25, py: 0.875, mb: 1, '&:focus-within': { borderColor: colorPalette.primary } }}>
                          <SearchOutlinedIcon sx={{ fontSize: '0.9375rem', color: '#94a3b8' }} />
                          <InputBase value={subject.txnSearch} onChange={e => searchTxns(e.target.value)} placeholder="Search by reference, customer or amount…" sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost' }} />
                        </Box>
                        {subject.txnSearching && <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mb: 0.75 }}>Searching…</Typography>}
                        {subject.txnResults.map(t => (
                          <TxnCard key={t.id} txn={t} selected={subject.selectedTxn?.id === t.id} onClick={() => setSubject(s => ({ ...s, selectedTxn: t }))} />
                        ))}
                        {!subject.txnSearching && subject.txnSearch && subject.txnResults.length === 0 && (
                          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>No transactions found</Typography>
                        )}
                        {!subject.txnSearch && !subject.selectedTxn && (
                          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>Type to search flagged transactions</Typography>
                        )}
                        {subject.selectedTxn && !subject.txnSearch && (
                          <TxnCard txn={subject.selectedTxn} selected />
                        )}
                      </>
                    )}
                  </>
                )}

                {activityType === 'kyc' && (
                  <Stack gap={1}>
                    <FormInput label="Customer Name *" value={subject.kycName} onChange={v => setSubject(s => ({ ...s, kycName: v }))} placeholder="e.g. Adamu Ibrahim" />
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <FormInput label="Account No." value={subject.kycAccount} onChange={v => setSubject(s => ({ ...s, kycAccount: v }))} placeholder="0123456789" mono />
                      <FormInput label="Bank" value={subject.kycBank} onChange={v => setSubject(s => ({ ...s, kycBank: v }))} placeholder="Zenith Bank" />
                    </Box>
                    <FormInput label="Issue / Concern *" value={subject.kycConcern} onChange={v => setSubject(s => ({ ...s, kycConcern: v }))} placeholder="e.g. NIN expired, address mismatch" textarea />
                  </Stack>
                )}

                {activityType === 'behavior' && (
                  <Stack gap={1}>
                    <FormInput label="Pattern Type *" value={subject.behaviorPattern} onChange={v => setSubject(s => ({ ...s, behaviorPattern: v }))} placeholder="e.g. Velocity breach, Round-tripping" />
                    <FormInput label="Period Observed" value={subject.behaviorPeriod} onChange={v => setSubject(s => ({ ...s, behaviorPeriod: v }))} placeholder="e.g. Last 7 days, 12–19 Apr 2025" />
                    <FormInput label="Description *" value={subject.behaviorDesc} onChange={v => setSubject(s => ({ ...s, behaviorDesc: v }))} placeholder="Describe the pattern in detail…" textarea />
                  </Stack>
                )}

                {activityType === 'device' && (
                  <Stack gap={1}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <FormInput label="Device ID" value={subject.deviceId} onChange={v => setSubject(s => ({ ...s, deviceId: v }))} placeholder="DEV-123abc" mono />
                      <FormInput label="IP Address" value={subject.ipAddress} onChange={v => setSubject(s => ({ ...s, ipAddress: v }))} placeholder="192.168.0.1" mono />
                    </Box>
                    <FormInput label="Notes *" value={subject.deviceNotes} onChange={v => setSubject(s => ({ ...s, deviceNotes: v }))} placeholder="Describe the technical anomaly…" textarea />
                  </Stack>
                )}

                {activityType === 'otp' && (
                  <Stack gap={1}>
                    <FormInput label="Anomaly Type *" value={subject.otpType} onChange={v => setSubject(s => ({ ...s, otpType: v }))} placeholder="e.g. OTP bypass, Fingerprint spoof, SIM swap" />
                    <FormInput label="Reference / Alert ID" value={subject.otpRef} onChange={v => setSubject(s => ({ ...s, otpRef: v }))} placeholder="e.g. AUTH-9823" mono />
                    <FormInput label="Description *" value={subject.otpDesc} onChange={v => setSubject(s => ({ ...s, otpDesc: v }))} placeholder="Describe the authentication anomaly…" textarea />
                  </Stack>
                )}

                {activityType === 'document' && (
                  <Stack gap={1}>
                    <FormInput label="Document Type *" value={subject.docType} onChange={v => setSubject(s => ({ ...s, docType: v }))} placeholder="e.g. NIN slip, CAC certificate, Utility bill" />
                    <FormInput label="Reference No." value={subject.docRef} onChange={v => setSubject(s => ({ ...s, docRef: v }))} placeholder="DOC-2024-001" mono />
                    <FormInput label="Notes" value={subject.docNotes} onChange={v => setSubject(s => ({ ...s, docNotes: v }))} placeholder="Additional context…" textarea />
                  </Stack>
                )}

                {activityType === 'other' && (
                  <Stack gap={1}>
                    <FormInput label="Subject Title *" value={subject.otherTitle} onChange={v => setSubject(s => ({ ...s, otherTitle: v }))} placeholder="Brief description of what is being investigated" />
                    <FormInput label="Description" value={subject.otherDesc} onChange={v => setSubject(s => ({ ...s, otherDesc: v }))} placeholder="Additional context…" textarea />
                  </Stack>
                )}
              </Box>

              {/* ── Section 2: Case details ─────────────────────────────── */}
              <SectionLabel>Case Details</SectionLabel>

              {/* Title */}
              <Box sx={{ mb: 1.75 }}>
                <FieldLabel>Case Title</FieldLabel>
                <Box sx={{ px: 1.25, py: 0.875, border: '1px solid #e2e8f0', '&:focus-within': { borderColor: colorPalette.primary } }}>
                  <InputBase
                    value={caseTitle}
                    onChange={e => { setCaseTitle(e.target.value); setTitleTouched(true) }}
                    placeholder="Auto-filled from subject above"
                    fullWidth
                    sx={{ fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a' }}
                  />
                </Box>
              </Box>

              {/* Typology */}
              <Box sx={{ mb: 1.75 }}>
                <FieldLabel>Typology</FieldLabel>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625 }}>
                  {TYPOLOGIES.map(t => {
                    const on = typology === t
                    return (
                      <Box key={t} onClick={() => setTypology(t)} sx={{
                        px: 1.125, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost',
                        cursor: 'pointer', border: '1px solid',
                        borderColor: on ? colorPalette.primary : '#e2e8f0',
                        color:       on ? colorPalette.primary : '#64748b',
                        bgcolor:     on ? `${colorPalette.primary}0a` : 'transparent',
                        transition: 'all 0.12s',
                      }}>
                        {t}
                      </Box>
                    )
                  })}
                </Box>
              </Box>

              {/* Priority + Risk */}
              <Box sx={{ mb: 1.75, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <FieldLabel>Priority</FieldLabel>
                  <Stack direction="row" gap={0.5}>
                    {PRIORITIES.map(p => {
                      const on = priority === p.value
                      return (
                        <Box key={p.value} onClick={() => setPriority(p.value)} sx={{
                          flex: 1, py: 0.625, textAlign: 'center',
                          fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'Jost', cursor: 'pointer',
                          border: '1px solid',
                          borderColor: on ? p.color : '#e2e8f0',
                          color:       on ? p.color : '#94a3b8',
                          bgcolor:     on ? `${p.color}0f` : 'transparent',
                          transition: 'all 0.12s',
                        }}>
                          {p.label}
                        </Box>
                      )
                    })}
                  </Stack>
                </Box>
                <Box>
                  <FieldLabel>Risk Score (0–100)</FieldLabel>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.875, border: '1px solid #e2e8f0', '&:focus-within': { borderColor: colorPalette.primary } }}>
                    <InputBase
                      type="number"
                      value={riskScore}
                      onChange={e => setRiskScore(Math.min(100, Math.max(0, Number(e.target.value))))}
                      inputProps={{ min: 0, max: 100 }}
                      sx={{ flex: 1, fontSize: '1rem', fontWeight: 700, fontFamily: 'Jost', color: riskColor(riskScore) }}
                    />
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>/100</Typography>
                  </Box>
                </Box>
              </Box>

              {/* Notes */}
              <Box sx={{ mb: 1 }}>
                <FieldLabel>Investigation Notes (optional)</FieldLabel>
                <Box component="textarea" value={caseNotes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCaseNotes(e.target.value)}
                  placeholder="Initial context or background for the investigating analyst…" rows={3}
                  sx={{ width: '100%', display: 'block', resize: 'none', border: '1px solid #e2e8f0', px: 1.25, py: 0.875, fontSize: '0.8125rem', fontFamily: 'Jost, sans-serif', color: '#0f172a', bgcolor: '#ffffff', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: colorPalette.primary }, '&::placeholder': { color: '#94a3b8' } }}
                />
              </Box>
            </Box>

            {/* Footer */}
            <Box sx={{ flexShrink: 0, px: 3, py: 2, borderTop: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {!canSubmit && (
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {!evidence ? 'Select an investigation subject above' : 'Enter a case title to continue'}
                </Typography>
              )}
              {canSubmit && <Box />}
              <Stack direction="row" gap={1}>
                <Box onClick={onClose} sx={{ px: 2, py: 0.875, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { borderColor: '#94a3b8', color: '#475569' } }}>
                  Cancel
                </Box>
                <Box onClick={handleSubmit} sx={{
                  px: 2.25, py: 0.875, display: 'flex', alignItems: 'center', gap: 0.75,
                  fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost',
                  color:   canSubmit ? '#ffffff' : '#94a3b8',
                  bgcolor: canSubmit ? colorPalette.primary : '#e2e8f0',
                  cursor:  canSubmit ? 'pointer' : 'not-allowed',
                  transition: 'opacity 0.15s',
                  '&:hover': canSubmit ? { opacity: 0.9 } : {},
                }}>
                  <GavelOutlinedIcon sx={{ fontSize: '0.9375rem' }} />
                  Create Case &amp; Investigate
                </Box>
              </Stack>
            </Box>
          </Box>
        </>
      )}

      <ActionEvidenceDialog
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        onConfirm={handleEvidenceConfirm}
        title="Open Investigation Case"
        actionLabel="Create Case"
        actionColor={colorPalette.primary}
      />

      <TOTPConfirmation
        open={totpOpen}
        onClose={() => setTotpOpen(false)}
        onConfirm={afterTotpVerified}
        operation="create"
        title="Open Investigation Case"
        description="Opening a case creates an immutable audit record and may trigger CBN AML notifications. Confirm with your authenticator code."
        resourceType="Investigation Case"
        resourceName={pendingRef.current?.caseInput.title ?? ''}
      />
    </>
  )
}

function TxnCard({ txn, selected, onClick }: { txn: Transaction; selected: boolean; onClick?: () => void }) {
  return (
    <Box onClick={onClick} sx={{
      p: 1.25, mb: 0.75, border: '1px solid', cursor: onClick ? 'pointer' : 'default',
      borderColor: selected ? colorPalette.primary : '#e2e8f0',
      bgcolor:     selected ? `${colorPalette.primary}06` : '#ffffff',
      transition: 'all 0.12s',
      '&:hover': onClick ? { borderColor: colorPalette.primary } : {},
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.375 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>{txn.id}</Typography>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: riskColor(txn.risk ?? 0) }}>Risk {txn.risk}</Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: '0.6875rem', color: '#475569' }}>{txn.customer} · {txn.channel}</Typography>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>{fmtAmount(txn.amount, txn.currency)}</Typography>
      </Box>
    </Box>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{children}</Typography>
      <Box sx={{ flex: 1, height: 1, bgcolor: '#eef0f4' }} />
    </Box>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>{children}</Typography>
}

function FormInput({ label, value, onChange, placeholder, textarea = false, mono = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; textarea?: boolean; mono?: boolean
}) {
  const baseFont = mono ? 'SF Mono, Monaco, monospace' : 'Jost, sans-serif'
  return (
    <Box>
      <FieldLabel>{label}</FieldLabel>
      {textarea ? (
        <Box component="textarea" value={value} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)} placeholder={placeholder} rows={3}
          sx={{ width: '100%', display: 'block', resize: 'none', border: '1px solid #e2e8f0', px: 1.25, py: 0.875, fontSize: '0.8125rem', fontFamily: baseFont, color: '#0f172a', bgcolor: '#ffffff', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: colorPalette.primary }, '&::placeholder': { color: '#94a3b8' } }}
        />
      ) : (
        <Box sx={{ px: 1.25, py: 0.875, border: '1px solid #e2e8f0', bgcolor: '#ffffff', '&:focus-within': { borderColor: colorPalette.primary } }}>
          <InputBase value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} fullWidth sx={{ fontSize: '0.8125rem', fontFamily: baseFont, color: '#0f172a' }} />
        </Box>
      )}
    </Box>
  )
}
