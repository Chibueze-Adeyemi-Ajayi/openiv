import {
  Dialog, Box, Typography, Button, TextField, MenuItem,
  Stack, IconButton, Tooltip, LinearProgress, CircularProgress,
  Autocomplete, Chip,
} from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { nfiuApi, type ReportType, type NfiuReport } from '@/api/nfiu'
import { institutionApi, type InstitutionProfile, type SigningCredentials } from '@/api/institution'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { customerApi, type Customer } from '@/api/customers'
import { transactionApi, type Transaction } from '@/api/transactions'
import { teamApi, type TeamMember } from '@/api/team'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PrintRoundedIcon from '@mui/icons-material/PrintRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import NotesRoundedIcon from '@mui/icons-material/NotesRounded'
import GradeOutlinedIcon from '@mui/icons-material/GradeOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

// ── Report type config ────────────────────────────────────────────────────────

interface ReportTypeMeta {
  id: ReportType; label: string; short: string
  icon: React.ReactNode; color: string; requiresSubject: boolean
}

const REPORT_TYPES: ReportTypeMeta[] = [
  { id: 'STR', label: 'Suspicious Transaction Report', short: 'STR', icon: <DescriptionOutlinedIcon sx={{ fontSize: '1.1rem' }} />, color: '#dc2626', requiresSubject: true },
  { id: 'CTR', label: 'Currency Transaction Report',   short: 'CTR', icon: <AccountBalanceOutlinedIcon sx={{ fontSize: '1.1rem' }} />, color: '#d97706', requiresSubject: true },
  { id: 'SAR', label: 'Suspicious Activity Report',    short: 'SAR', icon: <GavelOutlinedIcon sx={{ fontSize: '1.1rem' }} />, color: '#7c3aed', requiresSubject: true },
  { id: 'ITF', label: 'International Transfer Filing', short: 'ITF', icon: <SwapHorizOutlinedIcon sx={{ fontSize: '1.1rem' }} />, color: '#0891b2', requiresSubject: true },
  { id: 'PEP', label: 'PEP Disclosure Report',         short: 'PEP', icon: <PersonSearchOutlinedIcon sx={{ fontSize: '1.1rem' }} />, color: '#be185d', requiresSubject: true },
  { id: 'AML_RETURN', label: 'Monthly AML Return',     short: 'AML', icon: <AssignmentTurnedInOutlinedIcon sx={{ fontSize: '1.1rem' }} />, color: '#15803d', requiresSubject: false },
]

const FORM_SECTIONS = [
  { id: 'metadata',    label: 'Report',      icon: <GradeOutlinedIcon sx={{ fontSize: '0.875rem' }} />,       color: colorPalette.primary },
  { id: 'institution', label: 'Institution', icon: <BusinessOutlinedIcon sx={{ fontSize: '0.875rem' }} />,    color: '#1d4ed8' },
  { id: 'subject',     label: 'Subject',     icon: <PersonOutlinedIcon sx={{ fontSize: '0.875rem' }} />,      color: '#7c3aed' },
  { id: 'transaction', label: 'Transaction', icon: <ReceiptLongOutlinedIcon sx={{ fontSize: '0.875rem' }} />, color: '#d97706' },
  { id: 'narrative',   label: 'Narrative',   icon: <NotesRoundedIcon sx={{ fontSize: '0.875rem' }} />,        color: '#15803d' },
]

type FormSection = 'metadata' | 'institution' | 'subject' | 'transaction' | 'narrative'
type EditorStep  = 'compose' | 'consent' | 'confirm' | 'filing' | 'done'
type SaveStatus  = 'idle' | 'saving' | 'saved' | 'error'

export interface ReportPrefill {
  reportType?: ReportType
  title?: string
  subjectName?: string
  subjectAccount?: string
  subjectBvn?: string
  subjectType?: 'individual' | 'corporate'
  amountNgn?: string
  transactionType?: string
  transactionDate?: string
  transactionLocation?: string
  transactionLat?: number
  transactionLng?: number
  linkedTransactionId?: string
  transactionSenderAccount?: string
  transactionSenderBank?: string
  transactionRecipientName?: string
  transactionRecipientAccount?: string
  transactionRecipientBank?: string
  transactionCurrency?: string
  transactionNarration?: string
  narrative?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onFiled: (report: NfiuReport) => void
  defaultType?: ReportType
  initialReport?: NfiuReport
  readOnly?: boolean
  prefill?: ReportPrefill
  prefillLocked?: boolean
}

// ── Styles ────────────────────────────────────────────────────────────────────

const LBL = { fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', mb: 0.625, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const FLD = { '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.9375rem', bgcolor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }
const AUTO_SX = { '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.875rem', bgcolor: '#fff', p: '4px 8px !important' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }

// Compliance-relevant roles for officer dropdown
const COMPLIANCE_ROLES = ['owner', 'admin', 'compliance', 'cmlco', 'mlro', 'officer', 'analyst', 'auditor']

function isComplianceRole(role: string) {
  return COMPLIANCE_ROLES.some(r => role.toLowerCase().includes(r))
}

// Map raw transaction channel → human-readable transaction type label
function channelToType(channel: string): string {
  switch (channel?.toLowerCase().trim()) {
    case 'wire':             return 'Wire Transfer'
    case 'pos':              return 'POS'
    case 'mobile':           return 'Mobile Transfer'
    case 'ussd':             return 'Mobile Transfer'
    case 'cash':
    case 'cash_deposit':     return 'Cash Deposit'
    case 'atm':
    case 'cash_withdrawal':  return 'Cash Withdrawal'
    case 'cheque':
    case 'check':            return 'Cheque'
    case 'rtgs':             return 'RTGS'
    case 'swift':            return 'SWIFT'
    case 'bdc':              return 'Other'
    default:                 return channel || 'Other'
  }
}

function imageToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ── HTML generator (for print only) ──────────────────────────────────────────

function generateNFIUHtml(f: {
  meta: ReportTypeMeta; title: string; periodStart: string; periodEnd: string; priority: string
  institutionName: string; institutionCode: string; institutionAddress: string
  officerName: string
  subjectName: string; subjectType: string; subjectBvn: string; subjectAccount: string
  subjectAddress: string; subjectDob: string
  amountNgn: string; transactionCount: string; transactionType: string; transactionDate: string
  transactionLocation?: string; transactionLat?: number; transactionLng?: number
  narrative: string; reference?: string; filed?: boolean
  filingDate?: string | null
  officialSignature?: string | null; officialStamp?: string | null
}) {
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '_______________'
  const fmtAmt  = (a: string) => a ? `₦${parseFloat(a.replace(/,/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '_______________'
  const blank   = (v: string) => v?.trim() || '_______________'
  const today   = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const ref     = f.reference || `NFIU-${f.meta.short}-DRAFT-${Date.now().toString(36).toUpperCase()}`

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${f.meta.short} — ${f.title || 'NFIU Report'}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}body{font-family:'Times New Roman',serif;font-size:11pt;color:#000;background:#fff}
  @page{size:A4;margin:20mm 22mm 24mm}@media print{body{margin:0}}
  .page{max-width:794px;margin:0 auto;padding:32px 40px 40px}
  .lh{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #003366;padding-bottom:14px;margin-bottom:18px}
  .lh-logo{font-size:18pt;font-weight:bold;color:#003366;line-height:1}.lh-sub{font-size:8pt;color:#444;letter-spacing:1.5px;text-transform:uppercase;margin-top:3px}
  .ref-box{border:1px solid #003366;padding:6px 12px;display:inline-block}.ref-val{font-size:10pt;font-weight:bold;color:#003366;font-family:'Courier New',monospace}
  .title-band{background:#003366;color:#fff;text-align:center;padding:8px 20px;margin-bottom:18px}
  .title-band-main{font-size:12pt;font-weight:bold}.title-band-sub{font-size:8pt;opacity:.85;margin-top:2px}
  .wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-40deg);font-size:80pt;font-weight:bold;color:rgba(0,0,0,.04);white-space:nowrap;pointer-events:none}
  .section{margin-bottom:18px;page-break-inside:avoid}.sec-header{background:#003366;color:#fff;padding:5px 10px;font-size:9pt;font-weight:bold;text-transform:uppercase}
  .sec-body{border:1px solid #c8d0db;border-top:none}.row{display:grid;align-items:stretch;border-bottom:1px solid #e8ecf0}.row:last-child{border-bottom:none}
  .row.c1{grid-template-columns:160px 1fr}.row.c2{grid-template-columns:160px 1fr 160px 1fr}
  .cl{padding:5px 10px;background:#f4f6f9;font-size:8.5pt;color:#555;font-weight:bold;border-right:1px solid #e8ecf0;display:flex;align-items:center}
  .cv{padding:5px 10px;font-size:9.5pt;color:#111;display:flex;align-items:center}.cv.pre{display:block;line-height:1.7;white-space:pre-wrap;min-height:100px}
  .decl{border:1px solid #c8d0db;padding:14px 16px;margin-bottom:18px}.decl-text{font-size:9pt;line-height:1.7;color:#333;margin-bottom:16px}
  .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.sig-line{border-bottom:1px solid #000;height:32px;margin-bottom:4px}.sig-label{font-size:8pt;color:#555}.sig-img{height:44px;margin-bottom:4px;display:flex;align-items:flex-end}.sig-img img{max-height:44px;max-width:100%;object-fit:contain}
  .footer{border-top:1px solid #c8d0db;padding-top:10px;display:flex;justify-content:space-between;font-size:7.5pt;color:#888}
  .conf{display:inline-block;border:1px solid #dc2626;color:#dc2626;font-size:7pt;font-weight:bold;letter-spacing:1.5px;padding:1px 6px;margin-bottom:8px}
</style></head>
<body>
<div class="wm">${f.filed ? 'FILED' : 'DRAFT'}</div>
<div class="page">
  <div class="lh">
    <div><div class="conf">STRICTLY CONFIDENTIAL</div><div class="lh-logo">NFIU</div><div class="lh-sub">Nigerian Financial Intelligence Unit</div><div style="font-size:8pt;color:#555;margin-top:6px">Federal Republic of Nigeria</div></div>
    <div style="text-align:right"><div class="ref-box"><div style="font-size:7pt;color:#555;text-transform:uppercase;letter-spacing:1px">Reference</div><div class="ref-val">${ref}</div></div><div style="font-size:8pt;color:#666;margin-top:6px">Filing Date: ${today}</div></div>
  </div>
  <div class="title-band"><div class="title-band-main">${f.meta.label.toUpperCase()}</div><div class="title-band-sub">${f.title || '&nbsp;'}</div></div>
  <div class="section"><div class="sec-header">Section A — Reporting Institution Details</div><div class="sec-body">
    <div class="row c1"><div class="cl">Institution Name</div><div class="cv">${blank(f.institutionName)}</div></div>
    <div class="row c2"><div class="cl">CBN / FIRS Code</div><div class="cv">${blank(f.institutionCode)}</div><div class="cl">Report Period</div><div class="cv">${fmtDate(f.periodStart)} — ${fmtDate(f.periodEnd)}</div></div>
    <div class="row c1"><div class="cl">Branch Address</div><div class="cv">${blank(f.institutionAddress)}</div></div>
    <div class="row c1"><div class="cl">Reporting Officer</div><div class="cv">${blank(f.officerName)}</div></div>
  </div></div>
  ${f.meta.requiresSubject ? `
  <div class="section"><div class="sec-header">Section B — Subject of Report</div><div class="sec-body">
    <div class="row c2"><div class="cl">Subject Type</div><div class="cv">${f.subjectType ? f.subjectType.charAt(0).toUpperCase()+f.subjectType.slice(1) : '___'}</div><div class="cl">Date of Birth / Inc.</div><div class="cv">${fmtDate(f.subjectDob)}</div></div>
    <div class="row c1"><div class="cl">Full Legal Name</div><div class="cv">${blank(f.subjectName)}</div></div>
    <div class="row c2"><div class="cl">BVN / NIN</div><div class="cv">${blank(f.subjectBvn)}</div><div class="cl">Account Number</div><div class="cv">${blank(f.subjectAccount)}</div></div>
    <div class="row c1"><div class="cl">Known Address</div><div class="cv">${blank(f.subjectAddress)}</div></div>
  </div></div>
  <div class="section"><div class="sec-header">Section C — Transaction Details</div><div class="sec-body">
    <div class="row c2"><div class="cl">Amount (NGN)</div><div class="cv">${fmtAmt(f.amountNgn)}</div><div class="cl">No. of Transactions</div><div class="cv">${f.transactionCount || '___'}</div></div>
    <div class="row c2"><div class="cl">Transaction Type</div><div class="cv">${blank(f.transactionType)}</div><div class="cl">Transaction Date</div><div class="cv">${fmtDate(f.transactionDate)}</div></div>
    <div class="row c1"><div class="cl">Transaction Location</div><div class="cv">${blank(f.transactionLocation ?? '')}</div></div>
    ${(f.transactionLat != null || f.transactionLng != null) ? `<div class="row c2"><div class="cl">Latitude</div><div class="cv">${f.transactionLat != null ? f.transactionLat.toFixed(6) : '___'}</div><div class="cl">Longitude</div><div class="cv">${f.transactionLng != null ? f.transactionLng.toFixed(6) : '___'}</div></div>` : ''}
  </div></div>` : ''}
  <div class="section"><div class="sec-header">Section D — Grounds for Reporting / Narrative</div><div class="sec-body">
    <div class="row c1"><div class="cl" style="align-items:flex-start;padding-top:8px">Detailed Narrative</div><div class="cv pre">${f.narrative || '___'}</div></div>
  </div></div>
  <div class="section"><div class="sec-header">Section E — Declaration</div><div class="decl">
    <div class="decl-text">I, the undersigned Compliance / Reporting Officer of <strong>${blank(f.institutionName)}</strong>, hereby certify that the information provided in this report is true, accurate and complete to the best of my knowledge and belief, filed in accordance with the Money Laundering (Prevention and Prohibition) Act 2022 and the NFIU Act.</div>
    <div class="sig-grid">
      <div>${f.officialSignature ? `<div class="sig-img"><img src="${f.officialSignature}" alt="Signature"/></div>` : '<div class="sig-line"></div>'}<div class="sig-label">Signature of Reporting Officer</div></div>
      <div><div style="border-bottom:1px solid #000;height:32px;margin-bottom:4px;display:flex;align-items:flex-end;padding-bottom:4px;font-size:10pt">${f.filingDate ? fmtDate(f.filingDate) : ''}</div><div class="sig-label">Date</div></div>
      <div style="margin-top:16px">${f.officialStamp ? `<div class="sig-img" style="margin-top:16px"><img src="${f.officialStamp}" alt="Official Stamp"/></div>` : '<div class="sig-line"></div>'}<div class="sig-label">Official Stamp</div></div>
      <div style="margin-top:16px"><div style="border-bottom:1px solid #000;height:32px;margin-bottom:4px;display:flex;align-items:flex-end;padding-bottom:4px;font-size:10pt">${blank(f.officerName)}</div><div class="sig-label">Compliance Officer Name (Print)</div></div>
    </div>
  </div></div>
  <div class="footer"><span>NFIU Ref: ${ref}</span><span>Generated by OpenIV Compliance Platform · ${today}</span><span>Page 1 of 1</span></div>
</div></body></html>`
}

// ── Document preview ──────────────────────────────────────────────────────────

interface DocProps {
  meta: ReportTypeMeta; title: string; periodStart: string; periodEnd: string; priority: string
  institutionName: string; institutionCode: string; institutionAddress: string
  officerName: string
  subjectName: string; subjectType: string; subjectBvn: string; subjectAccount: string
  subjectAddress: string; subjectDob: string
  amountNgn: string; transactionCount: string; transactionType: string; transactionDate: string
  transactionLocation?: string; transactionLat?: number; transactionLng?: number
  narrative: string; reference?: string; filed?: boolean
  filingDate?: string | null
  officialSignature?: string | null; officialStamp?: string | null
}

function DocField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const empty = !value?.trim()
  return (
    <Box sx={{ display: 'flex', borderBottom: '1px solid #eef0f4', '&:last-child': { borderBottom: 'none' } }}>
      <Box sx={{ width: 148, flexShrink: 0, bgcolor: '#f7f8fb', borderRight: '1px solid #eef0f4', px: 1.25, py: 0.875, display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', lineHeight: 1.3 }}>{label}</Typography>
      </Box>
      <Box sx={{ flex: 1, px: 1.5, py: 0.875, display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '0.8125rem', color: empty ? '#cbd5e1' : '#00288e', fontFamily: mono ? '"Roboto Mono",monospace' : 'inherit', fontStyle: empty ? 'italic' : 'normal' }}>
          {empty ? '——' : value}
        </Typography>
      </Box>
    </Box>
  )
}

function DocField2({ label1, value1, label2, value2, mono1, mono2 }: { label1: string; value1: string; label2: string; value2: string; mono1?: boolean; mono2?: boolean }) {
  const e1 = !value1?.trim(); const e2 = !value2?.trim()
  const cellSx = { px: 1.25, py: 0.875, display: 'flex', alignItems: 'center' }
  const lSx = { fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', lineHeight: 1.3 }
  const vSx = (e: boolean, mono?: boolean) => ({ fontSize: '0.8125rem', color: e ? '#cbd5e1' : '#00288e', fontFamily: mono ? '"Roboto Mono",monospace' : 'inherit', fontStyle: e ? 'italic' : 'normal' })
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '148px 1fr 148px 1fr', borderBottom: '1px solid #eef0f4', '&:last-child': { borderBottom: 'none' } }}>
      <Box sx={{ ...cellSx, bgcolor: '#f7f8fb', borderRight: '1px solid #eef0f4' }}><Typography sx={lSx}>{label1}</Typography></Box>
      <Box sx={{ ...cellSx, borderRight: '1px solid #eef0f4' }}><Typography sx={vSx(e1, mono1)}>{e1 ? '——' : value1}</Typography></Box>
      <Box sx={{ ...cellSx, bgcolor: '#f7f8fb', borderRight: '1px solid #eef0f4' }}><Typography sx={lSx}>{label2}</Typography></Box>
      <Box sx={{ ...cellSx }}><Typography sx={vSx(e2, mono2)}>{e2 ? '——' : value2}</Typography></Box>
    </Box>
  )
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ bgcolor: '#003366', px: 1.5, py: 0.75 }}>
        <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: '#fff', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{title}</Typography>
      </Box>
      <Box sx={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>{children}</Box>
    </Box>
  )
}

function DocumentPreview(p: DocProps) {
  const today    = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const ref      = p.reference || 'DRAFT — NOT FILED'
  const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
  const fmtAmt   = (a: string) => a ? `₦${parseFloat(a.replace(/,/g, '')).toLocaleString()}` : ''
  const priColor = { high: '#dc2626', medium: '#d97706', low: '#16a34a' }[p.priority] ?? '#64748b'

  return (
    <Box sx={{ bgcolor: '#fff', width: 794, maxWidth: '100%', mx: 'auto', flexShrink: 0, boxShadow: '0 2px 32px rgba(0,0,0,0.18)', my: 4, fontFamily: '"Times New Roman",serif' }}>
      <Box sx={{ px: 5, pt: 4, pb: 4 }}>
        {/* Letterhead */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #003366', pb: 1.75, mb: 2 }}>
          <Box>
            <Box sx={{ display: 'inline-block', border: '1px solid #dc2626', px: 0.75, py: 0.25, mb: 0.75 }}>
              <Typography sx={{ fontSize: '0.5rem', fontWeight: 800, color: '#dc2626', letterSpacing: '0.15em', fontFamily: 'sans-serif' }}>STRICTLY CONFIDENTIAL</Typography>
            </Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#003366', lineHeight: 1, fontFamily: '"Times New Roman",serif' }}>NFIU</Typography>
            <Typography sx={{ fontSize: '0.5rem', color: '#555', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'sans-serif', mt: 0.25 }}>Nigerian Financial Intelligence Unit</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Box sx={{ border: '1px solid #003366', px: 1.5, py: 0.875, mb: 0.75, display: 'inline-block' }}>
              <Typography sx={{ fontSize: '0.5rem', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'sans-serif', mb: 0.25 }}>Reference</Typography>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#003366', fontFamily: '"Roboto Mono",monospace' }}>{ref}</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.625rem', color: '#666', fontFamily: 'sans-serif', display: 'block' }}>Filing Date: {today}</Typography>
            <Typography sx={{ fontSize: '0.625rem', fontFamily: 'sans-serif', display: 'block' }}>
              Priority: <Box component="span" sx={{ fontWeight: 700, color: priColor }}>{p.priority.toUpperCase()}</Box>
            </Typography>
          </Box>
        </Box>

        {/* Title band */}
        <Box sx={{ bgcolor: '#003366', textAlign: 'center', px: 3, py: 1.25, mb: 2.5 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff', letterSpacing: '0.08em', fontFamily: 'sans-serif' }}>{p.meta.label.toUpperCase()}</Typography>
          {p.title && <Typography sx={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.8)', fontFamily: 'sans-serif', mt: 0.25 }}>{p.title}</Typography>}
        </Box>

        {/* Section A */}
        <DocSection title="Section A — Reporting Institution Details">
          <DocField label="Institution Name" value={p.institutionName} />
          <DocField2 label1="CBN / FIRS Code" value1={p.institutionCode} mono1 label2="Report Period" value2={p.periodStart && p.periodEnd ? `${fmtDate(p.periodStart)} — ${fmtDate(p.periodEnd)}` : ''} />
          <DocField label="Branch Address" value={p.institutionAddress} />
          <DocField label="Reporting Officer" value={p.officerName} />
        </DocSection>

        {/* Section B */}
        {p.meta.requiresSubject && (
          <DocSection title="Section B — Subject of Report">
            <DocField2 label1="Subject Type" value1={p.subjectType ? p.subjectType.charAt(0).toUpperCase() + p.subjectType.slice(1) : ''} label2="Date of Birth / Inc." value2={fmtDate(p.subjectDob)} />
            <DocField label="Full Legal Name" value={p.subjectName} />
            <DocField2 label1="BVN / NIN" value1={p.subjectBvn} mono1 label2="Account Number" value2={p.subjectAccount} mono2 />
            <DocField label="Known Address" value={p.subjectAddress} />
          </DocSection>
        )}

        {/* Section C */}
        {p.meta.requiresSubject && (
          <DocSection title="Section C — Transaction Details">
            <DocField2 label1="Amount (NGN)" value1={fmtAmt(p.amountNgn)} mono1 label2="No. of Transactions" value2={p.transactionCount} />
            <DocField2 label1="Transaction Type" value1={p.transactionType} label2="Transaction Date" value2={fmtDate(p.transactionDate)} />
            <DocField label="Transaction Location" value={p.transactionLocation ?? ''} />
            {(p.transactionLat != null || p.transactionLng != null) && (
              <DocField2
                label1="Latitude"  value1={p.transactionLat  != null ? p.transactionLat.toFixed(6)  : ''} mono1
                label2="Longitude" value2={p.transactionLng != null ? p.transactionLng.toFixed(6) : ''} mono2
              />
            )}
          </DocSection>
        )}

        {/* Section D */}
        <DocSection title="Section D — Grounds for Reporting / Narrative">
          <Box sx={{ px: 1.5, py: 1.5, minHeight: 80 }}>
            <Typography sx={{ fontSize: '0.8125rem', color: p.narrative ? '#00288e' : '#cbd5e1', fontStyle: p.narrative ? 'normal' : 'italic', lineHeight: 1.8, fontFamily: '"Times New Roman",serif', whiteSpace: 'pre-wrap' }}>
              {p.narrative || 'Narrative will appear here as you type…'}
            </Typography>
          </Box>
        </DocSection>

        {/* Section E */}
        <DocSection title="Section E — Declaration">
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontSize: '0.6875rem', color: '#475569', lineHeight: 1.8, fontFamily: '"Times New Roman",serif', mb: 2 }}>
              I, the undersigned Compliance / Reporting Officer of <Box component="span" sx={{ fontWeight: 700 }}>{p.institutionName || '______________________'}</Box>, hereby certify that the information provided in this report is true, accurate and complete to the best of my knowledge and belief, filed in accordance with the Money Laundering (Prevention and Prohibition) Act 2022 and the NFIU Act.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
              {/* Signature */}
              <Box>
                {p.officialSignature
                  ? <Box sx={{ height: 44, mb: 0.5, display: 'flex', alignItems: 'flex-end' }}><Box component="img" src={p.officialSignature} alt="Signature" sx={{ maxHeight: 44, maxWidth: '100%', objectFit: 'contain' }} /></Box>
                  : <Box sx={{ borderBottom: '1px solid #000', height: 28, mb: 0.5 }} />}
                <Typography sx={{ fontSize: '0.5625rem', color: '#888', fontFamily: 'sans-serif' }}>Signature of Reporting Officer</Typography>
              </Box>
              {/* Date */}
              <Box>
                <Box sx={{ borderBottom: '1px solid #000', height: 28, mb: 0.5, display: 'flex', alignItems: 'flex-end', pb: 0.5 }}>
                  {p.filingDate && <Typography sx={{ fontSize: '0.6875rem', color: '#111', fontFamily: '"Times New Roman",serif' }}>{new Date(p.filingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</Typography>}
                </Box>
                <Typography sx={{ fontSize: '0.5625rem', color: '#888', fontFamily: 'sans-serif' }}>Date</Typography>
              </Box>
              {/* Stamp */}
              <Box>
                {p.officialStamp
                  ? <Box sx={{ height: 44, mb: 0.5, display: 'flex', alignItems: 'flex-end' }}><Box component="img" src={p.officialStamp} alt="Official Stamp" sx={{ maxHeight: 44, maxWidth: '100%', objectFit: 'contain' }} /></Box>
                  : <Box sx={{ borderBottom: '1px solid #000', height: 28, mb: 0.5 }} />}
                <Typography sx={{ fontSize: '0.5625rem', color: '#888', fontFamily: 'sans-serif' }}>Official Stamp</Typography>
              </Box>
              {/* Name print */}
              <Box>
                <Box sx={{ borderBottom: '1px solid #000', height: 28, mb: 0.5, display: 'flex', alignItems: 'flex-end', pb: 0.5 }}>
                  {p.officerName && <Typography sx={{ fontSize: '0.6875rem', color: '#111', fontFamily: '"Times New Roman",serif' }}>{p.officerName}</Typography>}
                </Box>
                <Typography sx={{ fontSize: '0.5625rem', color: '#888', fontFamily: 'sans-serif' }}>Compliance Officer Name (Print)</Typography>
              </Box>
            </Box>
          </Box>
        </DocSection>

        <Box sx={{ borderTop: '1px solid #e2e8f0', pt: 1.25, display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.5625rem', color: '#94a3b8', fontFamily: 'sans-serif' }}>NFIU Ref: {ref}</Typography>
          <Typography sx={{ fontSize: '0.5625rem', color: '#94a3b8', fontFamily: 'sans-serif' }}>Generated by OpenIV · {today}</Typography>
          <Typography sx={{ fontSize: '0.5625rem', color: '#94a3b8', fontFamily: 'sans-serif' }}>Page 1 of 1</Typography>
        </Box>
      </Box>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FileReportDialog({ open, onClose, onFiled, defaultType, initialReport, readOnly, prefill, prefillLocked }: Props) {
  const currentUser = useCurrentUser()

  // ── Remote data ──
  const [profile, setProfile]         = useState<InstitutionProfile | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  // ── Form — metadata ──
  const [reportType, setReportType]   = useState<ReportType>(defaultType ?? 'STR')
  const [priority, setPriority]       = useState('high')
  const [title, setTitle]             = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd]     = useState('')

  // ── Form — institution ──
  const [institutionName, setInstitutionName]       = useState('')
  const [institutionCode, setInstitutionCode]       = useState('')
  const [institutionAddress, setInstitutionAddress] = useState('')
  const [selectedOfficer, setSelectedOfficer]       = useState<TeamMember | null>(null)

  // ── Form — subject ──
  const [selectedCustomer, setSelectedCustomer]     = useState<Customer | null>(null)
  const [customerQuery, setCustomerQuery]           = useState('')
  const [customerList, setCustomerList]             = useState<Customer[]>([])
  const [customerLoading, setCustomerLoading]       = useState(false)
  const [subjectType, setSubjectType]               = useState<'individual' | 'corporate'>('individual')
  const [subjectBvn, setSubjectBvn]                 = useState('')
  const [subjectAccount, setSubjectAccount]         = useState('')
  const [subjectAddress, setSubjectAddress]         = useState('')
  const [subjectDob, setSubjectDob]                 = useState('')

  // ── Form — transaction ──
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [txQuery, setTxQuery]                         = useState('')
  const [txList, setTxList]                           = useState<Transaction[]>([])
  const [txLoading, setTxLoading]                     = useState(false)
  const [amountNgn, setAmountNgn]                     = useState('')
  const [transactionCount, setTransactionCount]       = useState('')
  const [transactionType, setTransactionType]         = useState('')
  const [transactionDate, setTransactionDate]         = useState('')
  // Extended transaction detail (persisted to report so draft can be restored)
  const [linkedTransactionId, setLinkedTransactionId]             = useState<string | undefined>()
  const [transactionLocation, setTransactionLocation]             = useState<string | undefined>()
  const [transactionLat, setTransactionLat]                       = useState<number | undefined>()
  const [transactionLng, setTransactionLng]                       = useState<number | undefined>()
  const [transactionSenderAccount, setTransactionSenderAccount]   = useState<string | undefined>()
  const [transactionSenderBank, setTransactionSenderBank]         = useState<string | undefined>()
  const [transactionRecipientName, setTransactionRecipientName]   = useState<string | undefined>()
  const [transactionRecipientAccount, setTransactionRecipientAccount] = useState<string | undefined>()
  const [transactionRecipientBank, setTransactionRecipientBank]   = useState<string | undefined>()
  const [transactionCurrency, setTransactionCurrency]             = useState<string | undefined>()
  const [transactionNarration, setTransactionNarration]           = useState<string | undefined>()

  // ── Form — narrative ──
  const [narrative, setNarrative] = useState('')

  // ── Draft auto-save ──
  const [draftId, setDraftId]       = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const saveTimer                   = useRef<ReturnType<typeof setTimeout>>()
  const isSaving                    = useRef(false)

  // ── Institution auto-save (fires when leaving institution tab) ──
  const prevSectionRef        = useRef<FormSection>('metadata')
  const institutionCodeRef    = useRef(institutionCode)
  const institutionAddressRef = useRef(institutionAddress)

  // ── Subject auto-save refs ──
  const selectedCustomerRef = useRef(selectedCustomer)
  const subjectBvnRef       = useRef(subjectBvn)
  const subjectAccountRef   = useRef(subjectAccount)
  const subjectTypeRef      = useRef(subjectType)
  const subjectDobRef       = useRef(subjectDob)
  const subjectAddressRef   = useRef(subjectAddress)

  // ── Signing credentials (stamp + signature) ──
  const [officialStamp, setOfficialStamp]         = useState<string | null>(null)
  const [officialSignature, setOfficialSignature] = useState<string | null>(null)
  const [stampDraft, setStampDraft]               = useState<string | null>(null)
  const [sigDraft, setSigDraft]                   = useState<string | null>(null)
  const [consentSaving, setConsentSaving]         = useState(false)
  const [totpTarget, setTotpTarget]               = useState<'stamp' | 'sig' | null>(null)
  const [totpUnlocked, setTotpUnlocked]           = useState<'stamp' | 'sig' | null>(null)
  const [showCredentialPrefs, setShowCredentialPrefs] = useState(false)
  const stampInputRef = useRef<HTMLInputElement>(null)
  const sigInputRef   = useRef<HTMLInputElement>(null)

  // ── UI ──
  const [activeSection, setActiveSection] = useState<FormSection>('metadata')
  const [editorStep, setEditorStep]       = useState<EditorStep>('compose')
  const [error, setError]                 = useState<string | null>(null)
  const [filedReport, setFiledReport]     = useState<NfiuReport | null>(null)
  const [filingTotpOpen, setFilingTotpOpen] = useState(false)
  const [approveTotpOpen, setApproveTotpOpen] = useState(false)
  const [approving, setApproving] = useState(false)

  const meta = REPORT_TYPES.find(t => t.id === reportType)!
  const complianceMembers = useMemo(() =>
    teamMembers.filter(m => m.status === 'active' && isComplianceRole(m.role)),
    [teamMembers])

  // Keep institution refs current so the tab-leave effect can read them without deps
  useEffect(() => { institutionCodeRef.current = institutionCode },    [institutionCode])
  useEffect(() => { institutionAddressRef.current = institutionAddress }, [institutionAddress])

  // Keep subject refs current
  useEffect(() => { selectedCustomerRef.current = selectedCustomer }, [selectedCustomer])
  useEffect(() => { subjectBvnRef.current     = subjectBvn },     [subjectBvn])
  useEffect(() => { subjectAccountRef.current = subjectAccount }, [subjectAccount])
  useEffect(() => { subjectTypeRef.current    = subjectType },    [subjectType])
  useEffect(() => { subjectDobRef.current     = subjectDob },     [subjectDob])
  useEffect(() => { subjectAddressRef.current = subjectAddress }, [subjectAddress])

  // ── Load static data on open ──
  useEffect(() => {
    if (!open) return
    prevSectionRef.current = 'metadata'

    if (initialReport) {
      setReportType(initialReport.reportType)
      setPriority(initialReport.priority ?? 'high')
      setTitle(initialReport.title ?? '')
      setPeriodStart(initialReport.periodStart ?? '')
      setPeriodEnd(initialReport.periodEnd ?? '')
      setSubjectBvn(initialReport.subjectBvn ?? '')
      setSubjectAccount(initialReport.subjectAccount ?? '')
      setSubjectType((initialReport.subjectType as 'individual' | 'corporate') ?? 'individual')
      setSubjectDob(initialReport.subjectDob ?? '')
      setSubjectAddress(initialReport.subjectAddress ?? '')
      setAmountNgn(initialReport.amountNgn != null ? String(initialReport.amountNgn) : '')
      setTransactionCount(initialReport.transactionCount != null ? String(initialReport.transactionCount) : '')
      setTransactionType(initialReport.transactionType ?? '')
      setTransactionDate(initialReport.transactionDate ? initialReport.transactionDate.split('T')[0] : '')
      setNarrative(initialReport.narrative ?? '')
      setDraftId(initialReport.status === 'draft' ? initialReport.id : null)
    } else {
      setReportType(prefill?.reportType ?? defaultType ?? 'STR'); setPriority('high')
      setTitle(prefill?.title ?? ''); setPeriodStart(''); setPeriodEnd('')
      setSubjectType(prefill?.subjectType ?? 'individual')
      setSubjectBvn(prefill?.subjectBvn ?? ''); setSubjectAccount(prefill?.subjectAccount ?? '')
      setSubjectAddress(''); setSubjectDob('')
      setAmountNgn(prefill?.amountNgn ?? '')
      setTransactionCount(''); setTransactionType(prefill?.transactionType ?? ''); setTransactionDate(prefill?.transactionDate ?? '')
      setNarrative(prefill?.narrative ?? '')
      setDraftId(null)
    }

    setSelectedOfficer(null)
    setCustomerQuery(''); setTxQuery(''); setTxList([])
    setSaveStatus('idle'); setActiveSection('metadata'); setEditorStep('compose')
    setError(null); setFiledReport(null)
    setStampDraft(null); setSigDraft(null); setConsentSaving(false); setTotpTarget(null)

    // When prefillLocked + linkedTransactionId: build synthetic transaction so the locked
    // preview renders immediately without a picker.
    if (!initialReport && prefillLocked && prefill?.linkedTransactionId) {
      const synthetic: Transaction = {
        id:               prefill.linkedTransactionId,
        customerId:       '',
        customer:         prefill.subjectName ?? '',
        amount:           Number(prefill.amountNgn ?? 0),
        channel:          prefill.transactionType ?? '',
        counterparty:     prefill.transactionRecipientName ?? prefill.subjectName ?? '',
        time:             prefill.transactionDate ?? '',
        risk:             0,
        status:           'successful',
        location:         prefill.transactionLocation ?? '',
        lat:              prefill.transactionLat,
        lng:              prefill.transactionLng,
        occurredAt:       prefill.transactionDate,
        senderAccount:    prefill.transactionSenderAccount,
        senderBank:       prefill.transactionSenderBank,
        recipientName:    prefill.transactionRecipientName,
        recipientAccount: prefill.transactionRecipientAccount,
        recipientBank:    prefill.transactionRecipientBank,
        currency:         prefill.transactionCurrency,
        narration:        prefill.transactionNarration,
        seen:             true,
      }
      setSelectedTransaction(synthetic)
      transactionApi.get(prefill.linkedTransactionId)
        .then(tx => setSelectedTransaction(tx))
        .catch(() => {})
    } else {
      setSelectedTransaction(null)
    }

    // Reset extended transaction detail (apply prefill if present)
    setLinkedTransactionId(prefill?.linkedTransactionId ?? undefined)
    setTransactionLocation(prefill?.transactionLocation ?? undefined)
    setTransactionLat(prefill?.transactionLat ?? undefined)
    setTransactionLng(prefill?.transactionLng ?? undefined)
    setTransactionSenderAccount(prefill?.transactionSenderAccount ?? undefined)
    setTransactionSenderBank(prefill?.transactionSenderBank ?? undefined)
    setTransactionRecipientName(prefill?.transactionRecipientName ?? undefined)
    setTransactionRecipientAccount(prefill?.transactionRecipientAccount ?? undefined)
    setTransactionRecipientBank(prefill?.transactionRecipientBank ?? undefined)
    setTransactionCurrency(prefill?.transactionCurrency ?? undefined)
    setTransactionNarration(prefill?.transactionNarration ?? undefined)

    // Restore customer selection when opening a draft that had a subject
    if (initialReport?.subjectName) {
      // Search by name; refine by account/BVN for exact match
      customerApi.list(initialReport.subjectName, 20).then(r => {
        setCustomerList(r.customers)
        const match = r.customers.find(c =>
          c.name === initialReport.subjectName ||
          (initialReport.subjectAccount && c.accountNumber === initialReport.subjectAccount) ||
          (initialReport.subjectBvn && c.bvn === initialReport.subjectBvn)
        ) ?? r.customers[0] ?? null
        setSelectedCustomer(match)
      }).catch(() => { setSelectedCustomer(null); setCustomerList([]) })
    } else {
      setSelectedCustomer(null)
      setCustomerList([])
    }

    // Restore extended transaction detail
    if (initialReport?.linkedTransactionId) {
      setLinkedTransactionId(initialReport.linkedTransactionId)
      setTransactionLocation(initialReport.transactionLocation ?? undefined)
      setTransactionLat(initialReport.transactionLat ?? undefined)
      setTransactionLng(initialReport.transactionLng ?? undefined)
      setTransactionSenderAccount(initialReport.transactionSenderAccount ?? undefined)
      setTransactionSenderBank(initialReport.transactionSenderBank ?? undefined)
      setTransactionRecipientName(initialReport.transactionRecipientName ?? undefined)
      setTransactionRecipientAccount(initialReport.transactionRecipientAccount ?? undefined)
      setTransactionRecipientBank(initialReport.transactionRecipientBank ?? undefined)
      setTransactionCurrency(initialReport.transactionCurrency ?? undefined)
      setTransactionNarration(initialReport.transactionNarration ?? undefined)

      // Build a synthetic transaction immediately from persisted fields so the Autocomplete
      // shows the locked preview without waiting for any API call.
      const synthetic: Transaction = {
        id:               initialReport.linkedTransactionId,
        customerId:       '',
        customer:         initialReport.subjectName ?? '',
        amount:           initialReport.amountNgn ?? 0,
        channel:          initialReport.transactionType ?? '',
        counterparty:     initialReport.transactionRecipientName ?? initialReport.subjectName ?? '',
        time:             initialReport.transactionDate ?? '',
        risk:             0,
        status:           'successful',
        location:         initialReport.transactionLocation ?? '',
        lat:              initialReport.transactionLat ?? undefined,
        lng:              initialReport.transactionLng ?? undefined,
        occurredAt:       initialReport.transactionDate ?? undefined,
        senderAccount:    initialReport.transactionSenderAccount ?? undefined,
        senderBank:       initialReport.transactionSenderBank ?? undefined,
        recipientName:    initialReport.transactionRecipientName ?? undefined,
        recipientAccount: initialReport.transactionRecipientAccount ?? undefined,
        recipientBank:    initialReport.transactionRecipientBank ?? undefined,
        currency:         initialReport.transactionCurrency ?? undefined,
        narration:        initialReport.transactionNarration ?? undefined,
        seen:             true,
      }
      setSelectedTransaction(synthetic)

      // Then refresh with the live record in the background (gets current risk, status etc.)
      transactionApi.get(initialReport.linkedTransactionId)
        .then(tx => setSelectedTransaction(tx))
        .catch(() => { /* keep synthetic */ })
    }

    // Load institution profile + team
    institutionApi.getProfile().then(p => {
      setProfile(p)
      setInstitutionName(p.name ?? '')
      setInstitutionCode(p.cbnCode ?? '')
      setInstitutionAddress(p.address ?? '')
      if (p.officialStamp)     setOfficialStamp(p.officialStamp)
      if (p.officialSignature) setOfficialSignature(p.officialSignature)
    }).catch(() => {})

    // Load signing credentials via dedicated endpoint (reliable fallback — profile
    // may omit large base64 fields or fail silently)
    institutionApi.getSigningCredentials().then(c => {
      if (c.officialStamp)     setOfficialStamp(c.officialStamp)
      if (c.officialSignature) setOfficialSignature(c.officialSignature)
    }).catch(() => {})

    teamApi.listMembers().then(r => setTeamMembers(r.members)).catch(() => {})
  }, [open, defaultType, initialReport, prefill, prefillLocked])

  // Auto-select officer when team loads — restore from draft, otherwise fall back to current user
  useEffect(() => {
    if (!teamMembers.length || selectedOfficer) return
    if (initialReport?.officerUserId || initialReport?.officerName) {
      const prev = teamMembers.find(m =>
        m.id === initialReport.officerUserId ||
        m.name === initialReport.officerName
      )
      if (prev) { setSelectedOfficer(prev); return }
    }
    if (!currentUser) return
    const me = teamMembers.find(m => m.email === currentUser.email)
    if (me) setSelectedOfficer(me)
  }, [teamMembers, currentUser, selectedOfficer, initialReport])

  // Auto-set period for AML_RETURN
  useEffect(() => {
    if (reportType !== 'AML_RETURN') return
    const now = new Date()
    const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, '0')
    const last = new Date(y, now.getMonth() + 1, 0).getDate()
    setPeriodStart(`${y}-${m}-01`); setPeriodEnd(`${y}-${m}-${last}`)
    setTitle(`Monthly AML Return – ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`)
  }, [reportType])

  // Customer search debounce
  const custDebounce = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    clearTimeout(custDebounce.current)
    custDebounce.current = setTimeout(() => {
      setCustomerLoading(true)
      customerApi.list(customerQuery || undefined, 30)
        .then(r => setCustomerList(r.customers))
        .catch(() => setCustomerList([]))
        .finally(() => setCustomerLoading(false))
    }, 300)
  }, [customerQuery])

  // Transaction search when customer selected
  useEffect(() => {
    if (!selectedCustomer) { setTxList([]); return }
    setTxLoading(true)
    transactionApi.list({ q: txQuery || selectedCustomer.name, pageSize: 30 })
      .then(r => setTxList(r.transactions.filter(t => t.customer === selectedCustomer.name || !txQuery)))
      .catch(() => setTxList([]))
      .finally(() => setTxLoading(false))
  }, [selectedCustomer, txQuery])

  // Apply selected customer → fill subject fields (pre-populate from saved profile)
  const applyCustomer = (c: Customer | null) => {
    setSelectedCustomer(c)
    if (!c) return
    setSubjectBvn(c.bvn ?? '')
    setSubjectAccount(c.accountNumber ?? '')
    setSubjectType((c.subjectType as 'individual' | 'corporate') ?? 'individual')
    setSubjectDob(c.dob ?? '')
    setSubjectAddress(c.address ?? '')
    setSelectedTransaction(null)
  }

  // Apply selected transaction → fill transaction fields and capture detail for persistence
  const applyTransaction = (tx: Transaction | null) => {
    setSelectedTransaction(tx)
    if (!tx) {
      setLinkedTransactionId(undefined)
      setTransactionLocation(undefined); setTransactionLat(undefined); setTransactionLng(undefined)
      setTransactionSenderAccount(undefined); setTransactionSenderBank(undefined)
      setTransactionRecipientName(undefined); setTransactionRecipientAccount(undefined)
      setTransactionRecipientBank(undefined); setTransactionCurrency(undefined)
      setTransactionNarration(undefined)
      return
    }
    setAmountNgn(String(tx.amount))
    setTransactionCount('1')
    setTransactionType(channelToType(tx.channel))
    setTransactionDate(tx.occurredAt ? tx.occurredAt.split('T')[0] : tx.time?.split('T')[0] ?? '')
    if (!subjectAccount) setSubjectAccount(tx.senderAccount || tx.recipientAccount || '')
    // Capture detail fields for persistence
    setLinkedTransactionId(tx.id)
    setTransactionLocation(tx.location || undefined)
    setTransactionLat(tx.lat ?? undefined)
    setTransactionLng(tx.lng ?? undefined)
    setTransactionSenderAccount(tx.senderAccount || undefined)
    setTransactionSenderBank(tx.senderBank || undefined)
    setTransactionRecipientName(tx.recipientName || undefined)
    setTransactionRecipientAccount(tx.recipientAccount || undefined)
    setTransactionRecipientBank(tx.recipientBank || undefined)
    setTransactionCurrency(tx.currency || undefined)
    setTransactionNarration(tx.narration || undefined)
  }

  // Auto-save institution profile whenever the user navigates away from the institution tab
  useEffect(() => {
    if (prevSectionRef.current === 'institution' && activeSection !== 'institution') {
      const code    = institutionCodeRef.current.trim()
      const address = institutionAddressRef.current.trim()
      if (code || address) {
        institutionApi.updateProfile({ cbnCode: code || undefined, address: address || undefined }).catch(() => {})
      }
    }

    // Auto-save subject profile whenever the user navigates away from the subject tab
    if (prevSectionRef.current === 'subject' && activeSection !== 'subject') {
      const customer = selectedCustomerRef.current
      if (customer) {
        const req: import('@/api/customers').UpdateCustomerProfileRequest = {}
        const bvn     = subjectBvnRef.current.trim()
        const account = subjectAccountRef.current.trim()
        const type    = subjectTypeRef.current
        const dob     = subjectDobRef.current
        const addr    = subjectAddressRef.current.trim()
        if (bvn)     req.bvn           = bvn
        if (account) req.accountNumber = account
        if (type)    req.subjectType   = type
        if (dob)     req.dob           = dob
        if (addr)    req.address       = addr
        if (Object.keys(req).length > 0) {
          customerApi.updateProfile(customer.externalId, req).catch(() => {})
        }
      }
    }

    prevSectionRef.current = activeSection
  }, [activeSection])

  // ── Auto-save (debounced 2s) ──
  const buildPayload = useCallback(() => ({
    reportType,
    title:                      title.trim(),
    periodStart,
    periodEnd,
    priority:                   priority as any,
    officerUserId:              selectedOfficer?.id ?? undefined,
    officerName:                selectedOfficer?.name ?? undefined,
    subjectName:                selectedCustomer?.name ?? undefined,
    subjectAccount:             subjectAccount.trim() || undefined,
    subjectBvn:                 subjectBvn.trim()     || undefined,
    subjectType:                meta.requiresSubject ? subjectType : undefined,
    subjectDob:                 subjectDob || undefined,
    subjectAddress:             subjectAddress.trim() || undefined,
    amountNgn:                  amountNgn ? parseFloat(amountNgn.replace(/,/g, '')) : undefined,
    transactionCount:           transactionCount ? parseInt(transactionCount, 10) : undefined,
    transactionType:            transactionType || undefined,
    transactionDate:            transactionDate || undefined,
    linkedTransactionId:        linkedTransactionId || undefined,
    transactionLocation:        transactionLocation || undefined,
    transactionLat:             transactionLat,
    transactionLng:             transactionLng,
    transactionSenderAccount:   transactionSenderAccount || undefined,
    transactionSenderBank:      transactionSenderBank || undefined,
    transactionRecipientName:   transactionRecipientName || undefined,
    transactionRecipientAccount: transactionRecipientAccount || undefined,
    transactionRecipientBank:   transactionRecipientBank || undefined,
    transactionCurrency:        transactionCurrency || undefined,
    transactionNarration:       transactionNarration || undefined,
    narrative:                  narrative.trim() || undefined,
  }), [reportType, title, periodStart, periodEnd, priority, selectedOfficer, selectedCustomer,
       subjectAccount, subjectBvn, subjectType, subjectDob, subjectAddress,
       amountNgn, transactionCount, transactionType, transactionDate,
       linkedTransactionId, transactionLocation, transactionLat, transactionLng,
       transactionSenderAccount, transactionSenderBank, transactionRecipientName,
       transactionRecipientAccount, transactionRecipientBank, transactionCurrency,
       transactionNarration, narrative, meta])

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    if (editorStep !== 'compose') return
    if (readOnly) return
    saveTimer.current = setTimeout(async () => {
      if (isSaving.current) return
      const payload = buildPayload()
      if (!payload.title || !payload.periodStart || !payload.periodEnd) return
      isSaving.current = true
      setSaveStatus('saving')
      try {
        if (draftId == null) {
          const r = await nfiuApi.createReport(payload)
          setDraftId(r.id)
        } else {
          await nfiuApi.updateReport(draftId, payload)
        }
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } catch {
        setSaveStatus('error')
      } finally {
        isSaving.current = false
      }
    }, 2000)
  }, [buildPayload, draftId, editorStep])

  // Trigger auto-save whenever any form field changes (skip for filed/read-only reports)
  useEffect(() => {
    if (!open || editorStep !== 'compose' || readOnly) return
    scheduleSave()
  }, [title, periodStart, periodEnd, priority, selectedOfficer, selectedCustomer,
      subjectAccount, subjectBvn, subjectType, subjectDob, subjectAddress,
      amountNgn, transactionCount, transactionType, transactionDate,
      linkedTransactionId, transactionLocation, transactionLat, transactionLng,
      transactionSenderAccount, transactionSenderBank, transactionRecipientName,
      transactionRecipientAccount, transactionRecipientBank, transactionCurrency,
      transactionNarration, narrative,
      open, editorStep, scheduleSave])

  // ── Completion ──
  const completion = useMemo(() => {
    const checks = [
      title.trim(), periodStart, periodEnd, institutionName.trim(),
      selectedOfficer, narrative.trim().length >= 20,
      ...(meta.requiresSubject ? [selectedCustomer || subjectAccount.trim(), amountNgn.trim()] : []),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [title, periodStart, periodEnd, institutionName, selectedOfficer, narrative, meta, selectedCustomer, subjectAccount, amountNgn])

  const docProps: DocProps = {
    meta, title, periodStart, periodEnd, priority,
    institutionName, institutionCode, institutionAddress,
    officerName: selectedOfficer?.name ?? '',
    subjectName: selectedCustomer?.name ?? '',
    subjectType, subjectBvn, subjectAccount, subjectAddress, subjectDob,
    amountNgn, transactionCount, transactionType, transactionDate,
    transactionLocation, transactionLat, transactionLng,
    narrative,
    reference: filedReport?.reference ?? initialReport?.reference,
    filed: !!filedReport || !!(initialReport && initialReport.status !== 'draft' && initialReport.status !== 'pending_approval'),
    filingDate: filedReport?.filingDate ?? initialReport?.filingDate,
    officialSignature, officialStamp,
  }

  const handlePrint = useCallback(() => {
    const html = generateNFIUHtml(docProps)
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }, [docProps])

  const handleFile = useCallback(async () => {
    if (!title.trim())            { setError('Report title is required'); return }
    if (!periodStart || !periodEnd) { setError('Report period is required'); return }
    if (narrative.trim().length < 20) { setError('Narrative must be at least 20 characters'); return }
    // Cancel any pending auto-save so it cannot race with the explicit create below
    clearTimeout(saveTimer.current)
    setEditorStep('filing'); setError(null)
    try {
      const payload = buildPayload()
      let id = draftId
      if (id == null) {
        const r = await nfiuApi.createReport(payload)
        id = r.id
        setDraftId(id)
      } else {
        await nfiuApi.updateReport(id, payload)
      }
      const report = await nfiuApi.fileReport(id)
      setFiledReport(report)
      setEditorStep('done')
      onFiled(report)
      setFilingTotpOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Filing failed. Please try again.')
      setEditorStep('compose')
    }
  }, [buildPayload, draftId, title, periodStart, periodEnd, narrative, onFiled])

  const handleClose = () => { if (editorStep === 'filing') return; onClose() }

  const visibleSections = FORM_SECTIONS.filter(s => {
    if (!meta.requiresSubject && (s.id === 'subject' || s.id === 'transaction')) return false
    return true
  })

  const navIdx = visibleSections.findIndex(s => s.id === activeSection)

  // ── Render ──
  return (
    <Dialog
      open={open} onClose={handleClose}
      maxWidth={false} fullWidth
      PaperProps={{ sx: { borderRadius: 0, width: '97vw', height: 'calc(100vh - 32px)', maxHeight: 'calc(100vh - 32px)', maxWidth: '1320px', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
    >
      {/* ── Toolbar ── */}
      <Box sx={{ height: 52, flexShrink: 0, bgcolor: '#00288e', display: 'flex', alignItems: 'center', px: 2, gap: 1.5, borderBottom: '1px solid #1e293b' }}>
        <Tooltip title="Close"><IconButton onClick={handleClose} size="small" sx={{ color: '#94a3b8', borderRadius: 0, '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
          <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
        </IconButton></Tooltip>
        <Box sx={{ width: 1, height: 28, bgcolor: '#1e293b', mx: 0.5 }} />

        {/* Report type pills */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {REPORT_TYPES.map(t => (
            <Tooltip key={t.id} title={readOnly ? t.label : `Switch to ${t.label}`}>
              <Box
                onClick={readOnly ? undefined : () => { setReportType(t.id); setActiveSection('metadata') }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.625,
                  cursor: readOnly ? 'default' : 'pointer',
                  bgcolor: reportType === t.id ? t.color : 'transparent',
                  color: reportType === t.id ? '#fff' : '#94a3b8',
                  border: '1px solid', borderColor: reportType === t.id ? t.color : 'transparent',
                  transition: 'all 0.15s',
                  opacity: readOnly && reportType !== t.id ? 0.35 : 1,
                  ...(!readOnly && { '&:hover': { bgcolor: reportType === t.id ? t.color : 'rgba(255,255,255,0.06)', color: '#fff' } }),
                }}
              >
                <Box sx={{ '& svg': { fontSize: '0.875rem !important' } }}>{t.icon}</Box>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em' }}>{t.short}</Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Save status — hidden for filed/read-only reports */}
        {!readOnly && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
            {saveStatus === 'saving' && <CircularProgress size={12} sx={{ color: '#64748b' }} />}
            {saveStatus === 'saved'  && <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#10b981' }} />}
            {saveStatus === 'error'  && <SaveOutlinedIcon sx={{ fontSize: '0.875rem', color: '#f59e0b' }} />}
            <Typography sx={{ fontSize: '0.625rem', color: saveStatus === 'saved' ? '#10b981' : saveStatus === 'error' ? '#f59e0b' : '#475569', letterSpacing: '0.08em' }}>
              {saveStatus === 'saving' ? 'Saving draft…' : saveStatus === 'saved' ? 'Draft saved' : saveStatus === 'error' ? 'Save failed' : draftId ? `Draft #${draftId}` : 'Unsaved draft'}
            </Typography>
          </Box>
        )}

        {/* Completion — hidden for read-only */}
        {!readOnly && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.625rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Complete</Typography>
            <Box sx={{ width: 80, height: 3, bgcolor: '#1e293b', position: 'relative' }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${completion}%`, bgcolor: completion >= 80 ? '#10b981' : completion >= 50 ? '#f59e0b' : '#64748b', transition: 'width 0.3s' }} />
            </Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: completion >= 80 ? '#10b981' : '#94a3b8', minWidth: 28 }}>{completion}%</Typography>
          </Box>
        )}

        <Box sx={{ width: 1, height: 28, bgcolor: '#1e293b', mx: 0.5 }} />

        <Tooltip title="Print / Save as PDF">
          <Button onClick={handlePrint} size="small" startIcon={<PrintRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
            sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', borderRadius: 0, px: 1.5, py: 0.75, '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: '#fff' } }}>
            Print PDF
          </Button>
        </Tooltip>
      </Box>

      {/* ── Body ── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Document area */}
        <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#dde3ea', px: 2 }}>
          <DocumentPreview {...docProps} />
        </Box>

        {/* ── Read-only summary sidebar ── */}
        {readOnly && initialReport && (
          <Box sx={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0', bgcolor: '#fafbfc', overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ color: meta.color, '& svg': { fontSize: '1rem !important' } }}>{meta.icon}</Box>
                <Box>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{meta.short}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', lineHeight: 1.2 }}>Filed Report</Typography>
                </Box>
              </Box>
              <IconButton size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#00288e' } }}>
                <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
              </IconButton>
            </Box>

            {/* Summary fields */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
              {([
                { label: 'Reference',   value: initialReport.reference,                               mono: true },
                { label: 'Status',      value: initialReport.status === 'pending_approval' ? 'PENDING APPROVAL' : initialReport.status.toUpperCase() },
                { label: 'Filed',       value: initialReport.filingDate ? new Date(initialReport.filingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                { label: 'Period',      value: initialReport.periodStart && initialReport.periodEnd ? `${initialReport.periodStart} → ${initialReport.periodEnd}` : '—' },
                { label: 'Priority',    value: (initialReport.priority ?? '').charAt(0).toUpperCase() + (initialReport.priority ?? '').slice(1) },
                { label: 'Officer',     value: initialReport.officerName ?? '—' },
                { label: 'Filed by',    value: initialReport.filedByName ?? '—' },
              ] as { label: string; value: string; mono?: boolean }[]).map(({ label, value, mono }) => (
                <Box key={label} sx={{ display: 'flex', borderBottom: '1px solid #f1f5f9', py: 0.875 }}>
                  <Typography sx={{ width: 72, flexShrink: 0, fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', alignSelf: 'center' }}>{label}</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#00288e', fontFamily: mono ? '"Roboto Mono",monospace' : 'inherit', wordBreak: 'break-all', lineHeight: 1.5 }}>{value}</Typography>
                </Box>
              ))}

              {meta.requiresSubject && (
                <>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.12em', mt: 2, mb: 0.5 }}>Subject</Typography>
                  {([
                    { label: 'Name',    value: initialReport.subjectName ?? '—' },
                    { label: 'Account', value: initialReport.subjectAccount ?? '—', mono: true },
                    { label: 'BVN',     value: initialReport.subjectBvn ?? '—',     mono: true },
                    { label: 'Type',    value: (initialReport.subjectType ?? '—').charAt(0).toUpperCase() + (initialReport.subjectType ?? '').slice(1) },
                    { label: 'Address', value: initialReport.subjectAddress ?? '—' },
                  ] as { label: string; value: string; mono?: boolean }[]).filter(r => r.value && r.value !== '—').map(({ label, value, mono }) => (
                    <Box key={label} sx={{ display: 'flex', borderBottom: '1px solid #f1f5f9', py: 0.875 }}>
                      <Typography sx={{ width: 72, flexShrink: 0, fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', alignSelf: 'center' }}>{label}</Typography>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#00288e', fontFamily: mono ? '"Roboto Mono",monospace' : 'inherit', wordBreak: 'break-all', lineHeight: 1.5 }}>{value}</Typography>
                    </Box>
                  ))}

                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.12em', mt: 2, mb: 0.5 }}>Transaction</Typography>
                  {([
                    { label: 'Amount',  value: initialReport.amountNgn != null ? `₦${initialReport.amountNgn.toLocaleString()}` : '—', mono: true },
                    { label: 'Type',    value: initialReport.transactionType ?? '—' },
                    { label: 'Date',    value: initialReport.transactionDate ?? '—' },
                    { label: 'Txn ID',  value: initialReport.linkedTransactionId ?? '—', mono: true },
                  ] as { label: string; value: string; mono?: boolean }[]).filter(r => r.value && r.value !== '—').map(({ label, value, mono }) => (
                    <Box key={label} sx={{ display: 'flex', borderBottom: '1px solid #f1f5f9', py: 0.875 }}>
                      <Typography sx={{ width: 72, flexShrink: 0, fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', alignSelf: 'center' }}>{label}</Typography>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#00288e', fontFamily: mono ? '"Roboto Mono",monospace' : 'inherit', wordBreak: 'break-all', lineHeight: 1.5 }}>{value}</Typography>
                    </Box>
                  ))}
                </>
              )}

              {initialReport.acknowledgementRef && (
                <Box sx={{ mt: 2, bgcolor: '#f0fdf4', border: '1px solid #d1fae5', px: 1.5, py: 1 }}>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>NFIU Acknowledgement</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', fontFamily: '"Roboto Mono",monospace' }}>{initialReport.acknowledgementRef}</Typography>
                </Box>
              )}
            </Box>

            {/* Pending approval banner + approve button */}
            {initialReport.status === 'pending_approval' && (
              <Box sx={{ px: 2.5, py: 1.75, bgcolor: '#fffbeb', borderTop: '1px solid #fde68a', borderBottom: '1px solid #fde68a', flexShrink: 0 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#92400e', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pending Your Approval</Typography>
                {initialReport.submittedByName && (
                  <Typography sx={{ fontSize: '0.75rem', color: '#92400e', mb: 1 }}>
                    Submitted by <strong>{initialReport.submittedByName}</strong>
                    {initialReport.submittedAt && ` · ${new Date(initialReport.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                  </Typography>
                )}
                <Button
                  onClick={() => setApproveTotpOpen(true)}
                  disabled={approving}
                  fullWidth
                  sx={{ bgcolor: '#d97706', color: '#fff', borderRadius: 0, fontFamily: 'Jost', fontWeight: 700, textTransform: 'none', fontSize: '0.8125rem', py: 0.875, boxShadow: 'none', '&:hover': { bgcolor: '#b45309' }, '&:disabled': { bgcolor: '#fde68a', color: '#92400e' } }}>
                  {approving ? 'Approving…' : 'Approve & File →'}
                </Button>
                {error && <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', mt: 0.75 }}>{error}</Typography>}
              </Box>
            )}

            {/* Footer */}
            <Box sx={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', px: 2.5, py: 1.5, display: 'flex', gap: 1, bgcolor: '#fff' }}>
              <Button onClick={handlePrint} size="small" startIcon={<PrintRoundedIcon sx={{ fontSize: '0.8125rem !important' }} />}
                sx={{ flex: 1, fontSize: '0.75rem', fontFamily: 'Jost', fontWeight: 600, color: '#475569', border: '1px solid #e2e8f0', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#f8fafc' } }}>
                Print PDF
              </Button>
              <Button onClick={onClose} size="small"
                sx={{ flex: 1, fontSize: '0.75rem', fontFamily: 'Jost', fontWeight: 700, color: '#fff', bgcolor: '#475569', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#334155' } }}>
                Close
              </Button>
            </Box>
          </Box>
        )}

        {/* Form panel */}
        {!readOnly && <Box sx={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0', bgcolor: '#fafbfc', overflow: 'hidden' }}>

          {/* Section tabs */}
          <Box sx={{ display: 'flex', borderBottom: '1px solid #e2e8f0', bgcolor: '#fff', flexShrink: 0 }}>
            {visibleSections.map(s => (
              <Box key={s.id} onClick={() => setActiveSection(s.id as FormSection)} sx={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1, cursor: 'pointer',
                borderBottom: activeSection === s.id ? `2px solid ${s.color}` : '2px solid transparent',
                bgcolor: activeSection === s.id ? `${s.color}08` : 'transparent',
                transition: 'all 0.15s',
              }}>
                <Box sx={{ color: activeSection === s.id ? s.color : '#94a3b8', '& svg': { fontSize: '0.875rem !important' } }}>{s.icon}</Box>
                <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: activeSection === s.id ? s.color : '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', mt: 0.25 }}>{s.label}</Typography>
              </Box>
            ))}
          </Box>

          {/* Section content */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2.5 }}>

            {/* ── METADATA ── */}
            {activeSection === 'metadata' && (
              <Stack gap={2}>
                {readOnly && (
                  <Box sx={{ bgcolor: '#f0f4ff', border: `1px solid ${colorPalette.primary}30`, px: 1.5, py: 1, display: 'flex', gap: 0.75, alignItems: 'center' }}>
                    <LockOutlinedIcon sx={{ fontSize: '0.875rem', color: colorPalette.primary }} />
                    <Typography sx={{ fontSize: '0.6875rem', color: colorPalette.primary }}>This report has been filed and is read-only.</Typography>
                  </Box>
                )}
                <Box>
                  <Typography sx={LBL}>Report Title *</Typography>
                  <TextField fullWidth size="small" value={title} onChange={e => !readOnly && setTitle(e.target.value)} sx={FLD} disabled={readOnly}
                    placeholder={`e.g. ${meta.label} – ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box><Typography sx={LBL}>Period Start *</Typography><TextField fullWidth size="small" type="date" value={periodStart} onChange={e => !readOnly && setPeriodStart(e.target.value)} sx={FLD} disabled={readOnly} InputLabelProps={{ shrink: true }} /></Box>
                  <Box><Typography sx={LBL}>Period End *</Typography><TextField fullWidth size="small" type="date" value={periodEnd} onChange={e => !readOnly && setPeriodEnd(e.target.value)} sx={FLD} disabled={readOnly} InputLabelProps={{ shrink: true }} /></Box>
                </Box>
                <Box>
                  <Typography sx={LBL}>Priority</Typography>
                  <TextField fullWidth size="small" select value={priority} onChange={e => !readOnly && setPriority(e.target.value)} sx={FLD} disabled={readOnly}>
                    {['low', 'medium', 'high'].map(p => <MenuItem key={p} value={p} sx={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>{p}</MenuItem>)}
                  </TextField>
                </Box>
                {readOnly && initialReport?.reference && (
                  <Box>
                    <Typography sx={LBL}>NFIU Reference</Typography>
                    <TextField fullWidth size="small" value={initialReport.reference} sx={FLD} disabled InputProps={{ sx: { fontFamily: '"Roboto Mono",monospace', fontSize: '0.875rem' } }} />
                  </Box>
                )}
              </Stack>
            )}

            {/* ── INSTITUTION ── */}
            {activeSection === 'institution' && (
              <Stack gap={2}>
                {profile && (
                  <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #d1fae5', px: 1.5, py: 1, display: 'flex', gap: 0.75, alignItems: 'center' }}>
                    <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#10b981' }} />
                    <Typography sx={{ fontSize: '0.6875rem', color: '#065f46' }}>Pre-filled from your institution profile — edit below to update.</Typography>
                  </Box>
                )}
                <Box><Typography sx={LBL}>Institution Name *</Typography><TextField fullWidth size="small" value={institutionName} onChange={e => setInstitutionName(e.target.value)} sx={FLD} /></Box>
                <Box><Typography sx={LBL}>CBN / FIRS License Code</Typography><TextField fullWidth size="small" value={institutionCode} onChange={e => setInstitutionCode(e.target.value)} sx={FLD} placeholder="e.g. CBN/FIN/2024/0042" /></Box>
                <Box><Typography sx={LBL}>Branch Address</Typography><TextField fullWidth size="small" multiline rows={2} value={institutionAddress} onChange={e => setInstitutionAddress(e.target.value)} sx={FLD} placeholder="Street, city, state" /></Box>

                <Box>
                  <Typography sx={LBL}>Reporting Officer *</Typography>
                  <Autocomplete
                    options={complianceMembers}
                    getOptionLabel={m => `${m.name} (${m.role})`}
                    value={selectedOfficer}
                    onChange={(_, v) => setSelectedOfficer(v)}
                    loading={!teamMembers.length}
                    renderInput={params => (
                      <TextField {...params} size="small" placeholder="Search team members…" sx={AUTO_SX}
                        InputProps={{ ...params.InputProps, endAdornment: (<>{!teamMembers.length && <CircularProgress size={14} />}{params.InputProps.endAdornment}</>) }} />
                    )}
                    renderOption={(props, m) => (
                      <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1, px: 1.5 }}>
                        <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: colorPalette.primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: colorPalette.primary }}>{m.initials}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#00288e', lineHeight: 1.2 }}>{m.name}</Typography>
                          <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>{m.role} · {m.email}</Typography>
                        </Box>
                      </Box>
                    )}
                    noOptionsText={<Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No compliance officers found</Typography>}
                    sx={{ '& .MuiAutocomplete-paper': { borderRadius: 0 } }}
                  />
                  {complianceMembers.length < teamMembers.length && (
                    <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', mt: 0.75 }}>
                      Showing {complianceMembers.length} of {teamMembers.length} team members with compliance roles
                    </Typography>
                  )}
                </Box>

              </Stack>
            )}

            {/* ── SUBJECT ── */}
            {activeSection === 'subject' && meta.requiresSubject && (
              <Stack gap={2}>
                <Box>
                  <Typography sx={LBL}>Customer *</Typography>
                  {prefillLocked && prefill?.subjectName ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid #d1fae5', bgcolor: '#f0fdf4', px: 1.5, py: 1 }}>
                      <LockOutlinedIcon sx={{ fontSize: '0.875rem', color: '#10b981', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#065f46', flex: 1 }}>{prefill.subjectName}</Typography>
                      <Typography sx={{ fontSize: '0.625rem', color: '#10b981', fontWeight: 700, letterSpacing: '0.08em' }}>LOCKED</Typography>
                    </Box>
                  ) : (
                    <Autocomplete
                      options={customerList}
                      getOptionLabel={c => c.name}
                      value={selectedCustomer}
                      onChange={(_, v) => applyCustomer(v)}
                      onInputChange={(_, v) => setCustomerQuery(v)}
                      loading={customerLoading}
                      filterOptions={x => x}
                      renderInput={params => (
                        <TextField {...params} size="small" placeholder="Search customers…" sx={AUTO_SX}
                          InputProps={{ ...params.InputProps, endAdornment: (<>{customerLoading && <CircularProgress size={14} />}{params.InputProps.endAdornment}</>) }} />
                      )}
                      renderOption={(props, c) => (
                        <Box component="li" {...props} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 1 }}>
                          <Box>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#00288e' }}>{c.name}</Typography>
                            <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>{c.externalId}{c.email ? ` · ${c.email}` : ''}</Typography>
                          </Box>
                          <Chip label={`${c.riskScore}%`} size="small" sx={{ fontSize: '0.625rem', height: 18, bgcolor: c.riskScore >= 75 ? '#fef2f2' : c.riskScore >= 50 ? '#fffbeb' : '#f0fdf4', color: c.riskScore >= 75 ? '#dc2626' : c.riskScore >= 50 ? '#d97706' : '#16a34a', fontWeight: 700, borderRadius: 0 }} />
                        </Box>
                      )}
                      noOptionsText={<Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No customers found</Typography>}
                    />
                  )}
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box><Typography sx={LBL}>Subject Type</Typography>
                    <TextField fullWidth size="small" select value={subjectType} onChange={e => setSubjectType(e.target.value as any)} sx={FLD}>
                      <MenuItem value="individual" sx={{ fontSize: '0.875rem' }}>Individual</MenuItem>
                      <MenuItem value="corporate"  sx={{ fontSize: '0.875rem' }}>Corporate</MenuItem>
                    </TextField>
                  </Box>
                  <Box><Typography sx={LBL}>Date of Birth / Inc.</Typography><TextField fullWidth size="small" type="date" value={subjectDob} onChange={e => setSubjectDob(e.target.value)} sx={FLD} InputLabelProps={{ shrink: true }} /></Box>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box><Typography sx={LBL}>BVN / NIN</Typography><TextField fullWidth size="small" value={subjectBvn} onChange={e => setSubjectBvn(e.target.value.replace(/\D/g, '').slice(0, 11))} sx={FLD} inputProps={{ inputMode: 'numeric', maxLength: 11 }} placeholder="11 digits" /></Box>
                  <Box><Typography sx={LBL}>Account Number</Typography><TextField fullWidth size="small" value={subjectAccount} onChange={e => setSubjectAccount(e.target.value)} sx={FLD} inputProps={{ maxLength: 20 }} placeholder="NUBAN" /></Box>
                </Box>
                <Box><Typography sx={LBL}>Known Address</Typography><TextField fullWidth size="small" multiline rows={2} value={subjectAddress} onChange={e => setSubjectAddress(e.target.value)} sx={FLD} placeholder="Street, city, state" /></Box>
              </Stack>
            )}

            {/* ── TRANSACTION ── */}
            {activeSection === 'transaction' && meta.requiresSubject && (
              <Stack gap={2}>
                {/* Transaction picker — hidden when prefillLocked (locked preview shows below) */}
                {!prefillLocked && (selectedCustomer || selectedTransaction) ? (
                  <Box>
                    <Typography sx={LBL}>Link Transaction</Typography>
                    <Autocomplete
                      options={txList}
                      getOptionLabel={tx => `₦${tx.amount.toLocaleString()} · ${channelToType(tx.channel)} · ${tx.occurredAt?.split('T')[0] ?? tx.time}`}
                      isOptionEqualToValue={(opt, val) => opt.id === val.id}
                      value={selectedTransaction}
                      onChange={(_, v) => applyTransaction(v)}
                      onInputChange={(_, v) => setTxQuery(v)}
                      loading={txLoading}
                      filterOptions={x => x}
                      renderInput={params => (
                        <TextField {...params} size="small" placeholder="Search transactions…" sx={AUTO_SX}
                          InputProps={{ ...params.InputProps, endAdornment: (<>{txLoading && <CircularProgress size={14} />}{params.InputProps.endAdornment}</>) }} />
                      )}
                      renderOption={(props, tx) => (
                        <Box component="li" {...props} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 1 }}>
                          <Box>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#00288e', fontFamily: '"Roboto Mono",monospace' }}>₦{tx.amount.toLocaleString()}</Typography>
                            <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>{channelToType(tx.channel)} · {tx.occurredAt?.split('T')[0] ?? tx.time}</Typography>
                          </Box>
                          <Chip label={`${tx.risk}%`} size="small" sx={{ fontSize: '0.625rem', height: 18, bgcolor: tx.risk >= 75 ? '#fef2f2' : '#fffbeb', color: tx.risk >= 75 ? '#dc2626' : '#d97706', fontWeight: 700, borderRadius: 0 }} />
                        </Box>
                      )}
                      noOptionsText={<Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No transactions for this customer</Typography>}
                    />
                  </Box>
                ) : !prefillLocked ? (
                  <Box sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', px: 1.5, py: 1 }}>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#92400e' }}>Select a customer in the Subject tab to search transactions, or fill manually below.</Typography>
                  </Box>
                ) : null}

                {/* ── Locked preview when a transaction is linked ── */}
                {selectedTransaction ? (() => {
                  const tx = selectedTransaction
                  const fmtAmt = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
                  const riskColor = tx.risk >= 75 ? '#dc2626' : tx.risk >= 50 ? '#d97706' : '#16a34a'
                  const rows: { label: string; value: string; mono?: boolean }[] = [
                    { label: 'Transaction ID',   value: tx.id,                                      mono: true },
                    { label: 'Amount',           value: fmtAmt(tx.amount),                          mono: true },
                    { label: 'Type / Channel',   value: channelToType(tx.channel) },
                    { label: 'Date',             value: tx.occurredAt?.split('T')[0] ?? tx.time ?? '' },
                    { label: 'Currency',         value: tx.currency ?? 'NGN' },
                    { label: 'Status',           value: tx.status ?? '' },
                    { label: 'Sender Account',   value: tx.senderAccount ?? '' },
                    { label: 'Sender Bank',      value: tx.senderBank ?? '' },
                    { label: 'Recipient',        value: tx.recipientName ?? '' },
                    { label: 'Recipient Acct',   value: tx.recipientAccount ?? '',                  mono: true },
                    { label: 'Recipient Bank',   value: tx.recipientBank ?? '' },
                    { label: 'Counterparty',     value: tx.counterparty ?? '' },
                    { label: 'Location',         value: tx.location ?? '' },
                    { label: 'Latitude',         value: tx.lat  != null ? tx.lat.toFixed(6)  : '', mono: true },
                    { label: 'Longitude',        value: tx.lng != null ? tx.lng.toFixed(6) : '', mono: true },
                    { label: 'Narration',        value: tx.narration ?? '' },
                  ].filter(r => r.value)
                  return (
                    <Box>
                      {/* Lock banner */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f0fdf4', border: '1px solid #d1fae5', px: 1.5, py: 0.875, mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#10b981' }} />
                          <Typography sx={{ fontSize: '0.6875rem', color: '#065f46', fontWeight: 600 }}>Fields locked — sourced from linked transaction</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, border: '1px solid #e2e8f0', px: 0.875, py: 0.25, bgcolor: tx.risk >= 75 ? '#fef2f2' : tx.risk >= 50 ? '#fffbeb' : '#f0fdf4' }}>
                          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: riskColor }}>RISK {tx.risk}%</Typography>
                        </Box>
                      </Box>

                      {/* Field rows */}
                      <Box sx={{ border: '1px solid #e2e8f0' }}>
                        {rows.map((r, i) => (
                          <Box key={r.label} sx={{ display: 'flex', borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <Box sx={{ width: 110, flexShrink: 0, bgcolor: '#f8fafc', borderRight: '1px solid #f1f5f9', px: 1.25, py: 0.75, display: 'flex', alignItems: 'center' }}>
                              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', lineHeight: 1.3 }}>{r.label}</Typography>
                            </Box>
                            <Box sx={{ flex: 1, px: 1.25, py: 0.75, display: 'flex', alignItems: 'center' }}>
                              <Typography sx={{ fontSize: '0.8125rem', color: '#00288e', fontFamily: r.mono ? '"Roboto Mono",monospace' : 'inherit', wordBreak: 'break-all', lineHeight: 1.4 }}>
                                {r.value}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )
                })() : (
                  /* ── Editable form when no transaction is linked ── */
                  <Stack gap={2}>
                    {selectedCustomer && (
                      <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>No transaction linked — fill manually or select one above.</Typography>
                    )}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                      <Box><Typography sx={LBL}>Amount (₦) *</Typography><TextField fullWidth size="small" value={amountNgn} onChange={e => setAmountNgn(e.target.value)} sx={FLD} inputProps={{ inputMode: 'decimal' }} placeholder="0.00" /></Box>
                      <Box><Typography sx={LBL}>No. of Transactions</Typography><TextField fullWidth size="small" value={transactionCount} onChange={e => setTransactionCount(e.target.value.replace(/\D/g, ''))} sx={FLD} inputProps={{ inputMode: 'numeric' }} placeholder="1" /></Box>
                    </Box>
                    <Box><Typography sx={LBL}>Transaction Type</Typography>
                      <TextField fullWidth size="small" select value={transactionType} onChange={e => setTransactionType(e.target.value)} sx={FLD}>
                        {['Wire Transfer', 'Cash Deposit', 'Cash Withdrawal', 'POS', 'Mobile Transfer', 'Cheque', 'RTGS', 'SWIFT', 'Other'].map(v => <MenuItem key={v} value={v} sx={{ fontSize: '0.875rem' }}>{v}</MenuItem>)}
                      </TextField>
                    </Box>
                    <Box><Typography sx={LBL}>Transaction Date</Typography><TextField fullWidth size="small" type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} sx={FLD} InputLabelProps={{ shrink: true }} /></Box>
                    <Box>
                      <Typography sx={LBL}>Transaction Location (Address)</Typography>
                      <TextField fullWidth size="small" value={transactionLocation ?? ''} onChange={e => setTransactionLocation(e.target.value || undefined)} sx={FLD} placeholder="e.g. 14 Marina Street, Lagos Island" />
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                      <Box>
                        <Typography sx={LBL}>Latitude</Typography>
                        <TextField fullWidth size="small" value={transactionLat ?? ''} onChange={e => { const v = parseFloat(e.target.value); setTransactionLat(isNaN(v) ? undefined : v) }} sx={FLD} inputProps={{ inputMode: 'decimal', step: 'any' }} placeholder="e.g. 6.452739" />
                      </Box>
                      <Box>
                        <Typography sx={LBL}>Longitude</Typography>
                        <TextField fullWidth size="small" value={transactionLng ?? ''} onChange={e => { const v = parseFloat(e.target.value); setTransactionLng(isNaN(v) ? undefined : v) }} sx={FLD} inputProps={{ inputMode: 'decimal', step: 'any' }} placeholder="e.g. 3.395985" />
                      </Box>
                    </Box>
                  </Stack>
                )}
              </Stack>
            )}

            {/* ── NARRATIVE ── */}
            {activeSection === 'narrative' && (
              <Stack gap={2}>
                <Box>
                  <Typography sx={LBL}>Narrative *</Typography>
                  <TextField fullWidth multiline rows={14} size="small" value={narrative} onChange={e => !readOnly && setNarrative(e.target.value)} disabled={readOnly} sx={{ ...FLD, '& textarea': { fontSize: '0.9375rem', lineHeight: 1.7 } }}
                    placeholder="Describe in detail: what happened, why it is suspicious, when, amounts involved, parties, and any action taken. Minimum 20 characters." />
                  {!readOnly && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75 }}>
                      <Typography sx={{ fontSize: '0.6875rem', color: narrative.length < 20 ? '#f59e0b' : '#94a3b8' }}>
                        {narrative.length < 20 ? `${20 - narrative.length} more characters required` : `${narrative.length} characters`}
                      </Typography>
                      <LinearProgress variant="determinate" value={Math.min(100, (narrative.length / 200) * 100)} sx={{ width: 60, mt: 0.5, height: 3, borderRadius: 0, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: narrative.length >= 20 ? '#10b981' : '#f59e0b' } }} />
                    </Box>
                  )}
                </Box>
                {error && <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 500 }}>{error}</Typography>}
              </Stack>
            )}
          </Box>

          {/* Nav footer */}

          <Box sx={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', bgcolor: '#fff' }}>
            <Button size="small" disabled={navIdx === 0}
              onClick={() => setActiveSection(visibleSections[navIdx - 1].id as FormSection)}
              sx={{ fontSize: '0.75rem', fontFamily: 'Jost', fontWeight: 600, color: '#64748b', borderRadius: 0, textTransform: 'none', px: 1.5, '&:hover': { bgcolor: '#f1f5f9' } }}>
              ← Back
            </Button>
            <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', alignSelf: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {navIdx + 1} / {visibleSections.length}
            </Typography>
            {navIdx === visibleSections.length - 1 ? (
              readOnly ? (
                <Button size="small" onClick={onClose}
                  sx={{ fontSize: '0.75rem', fontFamily: 'Jost', fontWeight: 700, color: '#fff', bgcolor: '#475569', borderRadius: 0, textTransform: 'none', px: 2, py: 0.75, boxShadow: 'none', '&:hover': { bgcolor: '#334155' } }}>
                  Close
                </Button>
              ) : (
                <Button size="small" disabled={editorStep === 'filing'}
                  onClick={() => {
                    if (!title.trim())            { setError('Report title is required'); return }
                    if (!periodStart || !periodEnd) { setError('Report period is required'); return }
                    if (narrative.trim().length < 20) { setError('Narrative must be at least 20 characters'); return }
                    setError(null)
                    setStampDraft(null); setSigDraft(null)
                    setEditorStep('consent')
                  }}
                  startIcon={<SendRoundedIcon sx={{ fontSize: '0.8125rem !important' }} />}
                  sx={{ fontSize: '0.75rem', fontFamily: 'Jost', fontWeight: 700, color: '#fff', bgcolor: colorPalette.primary, borderRadius: 0, textTransform: 'none', px: 2, py: 0.75, boxShadow: 'none', '&:hover': { bgcolor: '#1e293b' }, '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }}>
                  File to NFIU
                </Button>
              )
            ) : (
              <Button size="small"
                onClick={() => setActiveSection(visibleSections[navIdx + 1].id as FormSection)}
                sx={{ fontSize: '0.75rem', fontFamily: 'Jost', fontWeight: 700, color: colorPalette.primary, borderRadius: 0, textTransform: 'none', px: 1.5, '&:hover': { bgcolor: `${colorPalette.primary}08` } }}>
                Next →
              </Button>
            )}
          </Box>
        </Box>}

        {/* ── Consent overlay ── */}
        {editorStep === 'consent' && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(15,23,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, backdropFilter: 'blur(3px)' }}>
            <Box sx={{ bgcolor: '#fff', width: 500, border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Filing Consent</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.125 }}>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>Official Stamp &amp; Signature</Typography>
                    <Tooltip title="Image upload preferences">
                      <IconButton size="small" onClick={() => setShowCredentialPrefs(true)} sx={{ borderRadius: 0, color: '#94a3b8', p: 0.25, '&:hover': { color: colorPalette.primary, bgcolor: `${colorPalette.primary}10` } }}>
                        <InfoOutlinedIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => setEditorStep('compose')} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#00288e' } }}>
                  <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
                </IconButton>
              </Box>

              {/* ── Credential preferences modal ── */}
              {showCredentialPrefs && (
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(2px)', borderRadius: 0 }}>
                  <Box sx={{ bgcolor: '#fff', width: 420, border: '1px solid #e2e8f0', boxShadow: '0 16px 48px rgba(0,0,0,0.25)', mx: 2 }}>
                    {/* Modal header */}
                    <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 28, height: 28, bgcolor: `${colorPalette.primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <InfoOutlinedIcon sx={{ fontSize: '0.9375rem', color: colorPalette.primary }} />
                        </Box>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>Image Upload Preferences</Typography>
                      </Box>
                      <IconButton size="small" onClick={() => setShowCredentialPrefs(false)} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#00288e' } }}>
                        <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    </Box>

                    {/* Modal body */}
                    <Box sx={{ px: 2.5, py: 2.5 }}>
                      {/* Recommendation banner */}
                      <Box sx={{ bgcolor: `${colorPalette.primary}08`, border: `1px solid ${colorPalette.primary}25`, px: 1.75, py: 1.25, mb: 2.5, display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                        <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: colorPalette.primary, mt: 0.125, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.8125rem', color: colorPalette.primary, fontWeight: 600, lineHeight: 1.5 }}>
                          Transparent-background PNG images are strongly recommended for both your stamp and signature.
                        </Typography>
                      </Box>

                      {/* Reasons */}
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>Why it matters</Typography>
                      {[
                        { icon: '🖨️', text: 'Prints cleanly over the document without a white box obscuring the underlying content.' },
                        { icon: '📄', text: 'The NFIU printed report places the stamp and signature over the declaration section — a white background blocks the printed lines.' },
                        { icon: '✅', text: 'Meets the CBN/NFIU digital filing standard for authenticated document overlays.' },
                      ].map(({ icon, text }) => (
                        <Box key={text} sx={{ display: 'flex', gap: 1.25, mb: 1.25, alignItems: 'flex-start' }}>
                          <Typography sx={{ fontSize: '0.875rem', lineHeight: 1, mt: 0.125 }}>{icon}</Typography>
                          <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6 }}>{text}</Typography>
                        </Box>
                      ))}

                      {/* Tips */}
                      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #f1f5f9' }}>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>How to prepare</Typography>
                        {[
                          { step: '1', text: 'Scan or photograph the stamp/signature on a plain white background.' },
                          { step: '2', text: 'Use a free tool such as remove.bg, Adobe Express, or Canva to remove the background.' },
                          { step: '3', text: 'Export as PNG — JPEG does not support transparency.' },
                          { step: '4', text: 'Upload the transparent PNG here. Max recommended size: 512 × 512 px for stamps, 800 × 200 px for signatures.' },
                        ].map(({ step, text }) => (
                          <Box key={step} sx={{ display: 'flex', gap: 1.25, mb: 1, alignItems: 'flex-start' }}>
                            <Box sx={{ width: 18, height: 18, bgcolor: '#f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b' }}>{step}</Typography>
                            </Box>
                            <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.55 }}>{text}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>

                    {/* Modal footer */}
                    <Box sx={{ px: 2.5, py: 1.75, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                      <Button onClick={() => setShowCredentialPrefs(false)}
                        sx={{ borderRadius: 0, bgcolor: colorPalette.primary, color: '#fff', fontFamily: 'Jost', fontWeight: 700, textTransform: 'none', px: 2.5, py: 0.875, fontSize: '0.8125rem', boxShadow: 'none', '&:hover': { bgcolor: '#1e293b' } }}>
                        Got it
                      </Button>
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Body */}
              <Box sx={{ px: 3, py: 2.5, flex: 1, overflow: 'auto' }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6, mb: 2.5 }}>
                  To file this report, your official institutional stamp and authorized signature are required per CBN/NFIU compliance standards. Once uploaded they are saved for future filings.
                </Typography>

                {/* Stamp */}
                {(() => {
                  const current = officialStamp
                  const pending = stampDraft
                  const display = pending ?? current
                  const hasExisting = !!current
                  return (
                    <Box sx={{ mb: 2.5 }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>Official Stamp</Typography>
                      <Box sx={{ border: '1px solid #e2e8f0', p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        {display ? (
                          <Box component="img" src={display} sx={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid #f1f5f9', bgcolor: '#fafbfc' }} />
                        ) : (
                          <Box sx={{ width: 80, height: 80, border: '1px dashed #d1d5db', bgcolor: '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CloudUploadOutlinedIcon sx={{ fontSize: '1.5rem', color: '#cbd5e1' }} />
                          </Box>
                        )}
                        <Box sx={{ flex: 1 }}>
                          {pending && <Typography sx={{ fontSize: '0.625rem', color: '#10b981', fontWeight: 700, mb: 0.5 }}>New stamp ready to save</Typography>}
                          {hasExisting && !pending && <Typography sx={{ fontSize: '0.625rem', color: '#10b981', fontWeight: 700, mb: 0.5 }}>Using saved stamp</Typography>}
                          {hasExisting ? (
                            <Button size="small" startIcon={<LockOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
                              onClick={() => setTotpTarget('stamp')}
                              sx={{ fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600, color: '#475569', border: '1px solid #e2e8f0', borderRadius: 0, textTransform: 'none', px: 1.5, py: 0.5, '&:hover': { bgcolor: '#f8fafc' } }}>
                              Change (requires TOTP)
                            </Button>
                          ) : (
                            <Button size="small" component="label" startIcon={<CloudUploadOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                              sx={{ fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600, color: colorPalette.primary, border: `1px solid ${colorPalette.primary}`, borderRadius: 0, textTransform: 'none', px: 1.5, py: 0.5, '&:hover': { bgcolor: `${colorPalette.primary}08` } }}>
                              Upload Stamp
                              <input type="file" hidden accept="image/*" onChange={async e => {
                                const f = e.target.files?.[0]; if (!f) return
                                const url = await imageToDataUrl(f)
                                setStampDraft(url)
                                e.target.value = ''
                              }} />
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  )
                })()}

                {/* Signature */}
                {(() => {
                  const current = officialSignature
                  const pending = sigDraft
                  const display = pending ?? current
                  const hasExisting = !!current
                  return (
                    <Box sx={{ mb: 2.5 }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>Authorized Signature</Typography>
                      <Box sx={{ border: '1px solid #e2e8f0', p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        {display ? (
                          <Box component="img" src={display} sx={{ width: 120, height: 60, objectFit: 'contain', border: '1px solid #f1f5f9', bgcolor: '#fafbfc' }} />
                        ) : (
                          <Box sx={{ width: 120, height: 60, border: '1px dashed #d1d5db', bgcolor: '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CloudUploadOutlinedIcon sx={{ fontSize: '1.5rem', color: '#cbd5e1' }} />
                          </Box>
                        )}
                        <Box sx={{ flex: 1 }}>
                          {pending && <Typography sx={{ fontSize: '0.625rem', color: '#10b981', fontWeight: 700, mb: 0.5 }}>New signature ready to save</Typography>}
                          {hasExisting && !pending && <Typography sx={{ fontSize: '0.625rem', color: '#10b981', fontWeight: 700, mb: 0.5 }}>Using saved signature</Typography>}
                          {hasExisting ? (
                            <Button size="small" startIcon={<LockOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
                              onClick={() => setTotpTarget('sig')}
                              sx={{ fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600, color: '#475569', border: '1px solid #e2e8f0', borderRadius: 0, textTransform: 'none', px: 1.5, py: 0.5, '&:hover': { bgcolor: '#f8fafc' } }}>
                              Change (requires TOTP)
                            </Button>
                          ) : (
                            <Button size="small" component="label" startIcon={<CloudUploadOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                              sx={{ fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600, color: colorPalette.primary, border: `1px solid ${colorPalette.primary}`, borderRadius: 0, textTransform: 'none', px: 1.5, py: 0.5, '&:hover': { bgcolor: `${colorPalette.primary}08` } }}>
                              Upload Signature
                              <input type="file" hidden accept="image/*" onChange={async e => {
                                const f = e.target.files?.[0]; if (!f) return
                                const url = await imageToDataUrl(f)
                                setSigDraft(url)
                                e.target.value = ''
                              }} />
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  )
                })()}

                <Box sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', p: 1.5, display: 'flex', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem' }}>⚠️</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#92400e', lineHeight: 1.6 }}>By proceeding you confirm this report is accurate and authorize it for submission. Filing is <strong>final and audit-logged</strong>. A <strong>₦10,000</strong> NFIU filing charge will apply.</Typography>
                </Box>
              </Box>

              {/* Footer */}
              <Box sx={{ px: 3, py: 2, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 1.5, justifyContent: 'space-between', alignItems: 'center' }}>
                <Button onClick={() => setEditorStep('compose')} sx={{ borderRadius: 0, border: '1px solid #e2e8f0', color: '#64748b', fontFamily: 'Jost', fontWeight: 600, textTransform: 'none', px: 2.5, py: 1, '&:hover': { bgcolor: '#f8fafc' } }}>
                  Back
                </Button>
                <Button
                  disabled={consentSaving || (!(officialStamp || stampDraft) || !(officialSignature || sigDraft))}
                  onClick={async () => {
                    setConsentSaving(true)
                    try {
                      const newStamp = stampDraft ?? undefined
                      const newSig   = sigDraft ?? undefined
                      if (newStamp || newSig) {
                        // Only send the field that changed — omitting the other
                        // prevents the backend from nulling out the existing one
                        const patch: { officialStamp?: string; officialSignature?: string } = {}
                        if (newStamp) patch.officialStamp = newStamp
                        if (newSig)   patch.officialSignature = newSig
                        await institutionApi.updateSigningCredentials(patch)
                        if (newStamp) setOfficialStamp(newStamp)
                        if (newSig)   setOfficialSignature(newSig)
                        setStampDraft(null); setSigDraft(null)
                      }
                      setEditorStep('confirm')
                    } catch {
                      // ignore — proceed anyway
                      setEditorStep('confirm')
                    } finally {
                      setConsentSaving(false)
                    }
                  }}
                  sx={{ borderRadius: 0, bgcolor: colorPalette.primary, color: '#fff', fontFamily: 'Jost', fontWeight: 700, textTransform: 'none', px: 3, py: 1, boxShadow: 'none', '&:hover:not(:disabled)': { bgcolor: '#1e293b' }, '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }}>
                  {consentSaving ? 'Saving…' : 'Preview & File →'}
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {/* ── Confirm overlay ── */}
        {editorStep === 'confirm' && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(15,23,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, backdropFilter: 'blur(3px)' }}>
            <Box sx={{ bgcolor: '#fff', width: 460, border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 36, height: 36, bgcolor: `${meta.color}14`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{meta.icon}</Box>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>Confirm filing</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{meta.label} — {title || 'Untitled'}</Typography>
                </Box>
              </Box>
              <Box sx={{ px: 3, py: 2.5 }}>
                {[
                  ['Report type', meta.label],
                  ['Period', periodStart && periodEnd ? `${periodStart} → ${periodEnd}` : '—'],
                  ['Priority', priority.charAt(0).toUpperCase() + priority.slice(1)],
                  ['Officer', selectedOfficer?.name ?? '—'],
                  ...(meta.requiresSubject ? [['Subject', selectedCustomer?.name || '—'], ['Amount', amountNgn ? `₦${parseFloat(amountNgn.replace(/,/g, '')).toLocaleString()}` : '—']] : []),
                ].map(([l, v]) => (
                  <Box key={l} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid #f4f5f7' }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>{l}</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#00288e' }}>{v}</Typography>
                  </Box>
                ))}
                <Box sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', p: 1.5, mt: 2, display: 'flex', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem' }}>⚠️</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#92400e', lineHeight: 1.6 }}>Filing is <strong>final and audit-logged</strong>. A <strong>₦10,000</strong> NFIU filing charge will be deducted from your wallet.</Typography>
                </Box>
                {error && <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', mt: 1.5, fontWeight: 500 }}>{error}</Typography>}
              </Box>
              <Box sx={{ px: 3, py: 2, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                <Button onClick={() => { setEditorStep('compose'); setError(null) }} sx={{ borderRadius: 0, border: '1px solid #e2e8f0', color: '#64748b', fontFamily: 'Jost', fontWeight: 600, textTransform: 'none', px: 2.5, py: 1, '&:hover': { bgcolor: '#f8fafc' } }}>Cancel</Button>
                <Button onClick={() => setFilingTotpOpen(true)} sx={{ borderRadius: 0, bgcolor: colorPalette.primary, color: '#fff', fontFamily: 'Jost', fontWeight: 700, textTransform: 'none', px: 3, py: 1, boxShadow: 'none', '&:hover': { bgcolor: '#1e293b' } }}>
                  Verify &amp; File →
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {/* ── Filing overlay ── */}
        {editorStep === 'filing' && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(15,23,42,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, backdropFilter: 'blur(4px)' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ width: 56, height: 56, border: '3px solid rgba(255,255,255,0.15)', borderTop: `3px solid ${colorPalette.primary}`, borderRadius: '50%', animation: 'spin 0.9s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } }, mx: 'auto', mb: 2 }} />
              <Typography sx={{ color: '#fff', fontSize: '1rem', fontWeight: 600, fontFamily: 'Jost' }}>Submitting to NFIU…</Typography>
              <Typography sx={{ color: '#64748b', fontSize: '0.8125rem', mt: 0.5 }}>Creating record and transmitting report</Typography>
            </Box>
          </Box>
        )}

        {/* ── Done overlay ── */}
        {editorStep === 'done' && filedReport && (() => {
          const isPending = filedReport.status === 'pending_approval'
          return (
            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(15,23,42,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, backdropFilter: 'blur(4px)' }}>
              <Box sx={{ bgcolor: '#fff', width: 480, border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', textAlign: 'center' }}>
                <Box sx={{ bgcolor: isPending ? '#fffbeb' : '#f0fdf4', borderBottom: `1px solid ${isPending ? '#fde68a' : '#d1fae5'}`, py: 3 }}>
                  <CheckCircleOutlineRoundedIcon sx={{ fontSize: '3rem', color: isPending ? '#d97706' : '#10b981', mb: 1 }} />
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                    {isPending ? 'Submitted for Approval' : 'Report Filed Successfully'}
                  </Typography>
                  <Box sx={{ display: 'inline-block', bgcolor: '#fff', border: `1px solid ${isPending ? '#fde68a' : '#d1fae5'}`, px: 2, py: 0.75, mt: 1.5 }}>
                    <Typography sx={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
                      {isPending ? 'Draft Reference' : 'NFIU Reference'}
                    </Typography>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#00288e', fontFamily: '"Roboto Mono",monospace' }}>{filedReport.reference}</Typography>
                  </Box>
                </Box>
                <Box sx={{ px: 3, py: 2.5 }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: 2 }}>
                    {isPending
                      ? 'Your report is pending approval by a Compliance Officer or Admin. They will review and file it on your behalf.'
                      : '₦10,000 NFIU filing charge applied. Print the filed document for your records.'}
                  </Typography>
                  <Stack direction="row" gap={1.5} justifyContent="center">
                    {!isPending && <Button onClick={handlePrint} startIcon={<PrintRoundedIcon />} sx={{ borderRadius: 0, border: '1px solid #e2e8f0', color: '#475569', fontFamily: 'Jost', fontWeight: 600, textTransform: 'none', px: 2.5, py: 1, '&:hover': { bgcolor: '#f8fafc' } }}>Print PDF</Button>}
                    <Button onClick={onClose} sx={{ borderRadius: 0, bgcolor: isPending ? '#d97706' : colorPalette.primary, color: '#fff', fontFamily: 'Jost', fontWeight: 700, textTransform: 'none', px: 2.5, py: 1, boxShadow: 'none', '&:hover': { bgcolor: isPending ? '#b45309' : '#1e293b' } }}>Close</Button>
                  </Stack>
                </Box>
              </Box>
            </Box>
          )
        })()}
      </Box>

      {/* ── Hidden file inputs for TOTP-unlocked credential replacement ── */}
      <input ref={stampInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
        const f = e.target.files?.[0]; if (!f) return
        setStampDraft(await imageToDataUrl(f)); setTotpUnlocked(null)
        e.target.value = ''
      }} />
      <input ref={sigInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
        const f = e.target.files?.[0]; if (!f) return
        setSigDraft(await imageToDataUrl(f)); setTotpUnlocked(null)
        e.target.value = ''
      }} />

      {/* ── TOTP for filing ── */}
      <TOTPConfirmation
        open={filingTotpOpen}
        onClose={() => setFilingTotpOpen(false)}
        onConfirm={handleFile}
        operation="create"
        title="Confirm Report Filing"
        description="This action is final and audit-logged. Verify your identity to submit this NFIU report."
        resourceType="NFIU Report"
        resourceName={title || meta.label}
      />

      {/* ── TOTP for approving pending report ── */}
      <TOTPConfirmation
        open={approveTotpOpen}
        onClose={() => setApproveTotpOpen(false)}
        onConfirm={async () => {
          if (!initialReport) return
          setApproving(true)
          try {
            const approved = await nfiuApi.approveReport(initialReport.id)
            onFiled(approved)
            onClose()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Approval failed')
          } finally {
            setApproving(false)
            setApproveTotpOpen(false)
          }
        }}
        operation="update"
        title="Approve & File Report"
        description={
          <Box>
            <Typography sx={{ fontSize: '0.875rem', color: '#475569', mb: 1 }}>
              You are approving this report for official NFIU submission. A ₦10,000 filing charge will apply.
            </Typography>
            {initialReport?.submittedByName && (
              <Box sx={{ bgcolor: '#f0f9ff', border: '1px solid #bae6fd', px: 1.5, py: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#0369a1' }}>
                  Submitted by <strong>{initialReport.submittedByName}</strong>
                  {initialReport.submittedAt && ` on ${new Date(initialReport.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </Typography>
              </Box>
            )}
          </Box>
        }
        resourceType="NFIU Report"
        resourceName={initialReport?.reference ?? initialReport?.title ?? ''}
      />

      {/* ── TOTP for changing existing credentials ── */}
      <TOTPConfirmation
        open={totpTarget !== null}
        onClose={() => setTotpTarget(null)}
        onConfirm={() => {
          const target = totpTarget
          setTotpTarget(null)
          setTotpUnlocked(target)
          setTimeout(() => {
            if (target === 'stamp') stampInputRef.current?.click()
            else                   sigInputRef.current?.click()
          }, 300)
        }}
        operation="update"
        title={totpTarget === 'stamp' ? 'Replace Official Stamp' : 'Replace Authorized Signature'}
        description={
          <Box>
            <Typography sx={{ fontSize: '0.875rem', color: '#475569', mb: 1 }}>
              Changing your official {totpTarget === 'stamp' ? 'stamp' : 'signature'} requires step-up authentication.
              After verifying, you can upload a new image.
            </Typography>
            <Box sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', p: 1.25 }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#92400e' }}>This change is audit-logged per CBN Baseline Standards §3.4.</Typography>
            </Box>
          </Box>
        }
        resourceType="Institution Credential"
        resourceName={totpTarget === 'stamp' ? 'Official Stamp' : 'Authorized Signature'}
      />

      {/* ── Status bar ── */}
      <Box sx={{ height: 28, flexShrink: 0, bgcolor: '#00288e', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', px: 2.5, gap: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: meta.color }} />
          <Typography sx={{ fontSize: '0.625rem', color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{meta.label}</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.625rem', color: '#334155' }}>|</Typography>
        <Typography sx={{ fontSize: '0.625rem', color: '#64748b' }}>
          Period: {periodStart && periodEnd ? `${periodStart} → ${periodEnd}` : 'Not set'}
        </Typography>
        <Typography sx={{ fontSize: '0.625rem', color: '#334155' }}>|</Typography>
        <Typography sx={{ fontSize: '0.625rem', color: '#64748b' }}>
          Narrative: {narrative.length} chars {narrative.length >= 20 ? '✓' : `(need ${20 - narrative.length} more)`}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: '0.625rem', color: '#475569' }}>OpenIV Compliance Platform · NFIU Filing Module</Typography>
      </Box>
    </Dialog>
  )
}
