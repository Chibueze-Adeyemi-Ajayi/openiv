import { useState, useRef, useCallback } from 'react'
import { Box, Typography, Button, IconButton, Stack, Alert } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { colorPalette } from '@/theme'
import { transactionApi, type ImportRow } from '@/api/transactions'
import { authApi } from '@/api/auth'
import { teamApi } from '@/api/team'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import * as XLSX from 'xlsx'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'

type Step = 'choose' | 'upload' | 'preview' | 'api-warn'

interface ParsedRow extends ImportRow {
  _errors: string[]
}

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

const VALID_STATUSES = new Set(['pending', 'successful', 'failed'])

// ── CSV column aliases (snake_case from template OR human-friendly) ──────────
function col(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
    if (v !== undefined && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
    else cur += ch
  }
  result.push(cur.trim())
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').replace(/^"|"$/g, '') })
    return row
  })
}

async function fileToRows(file: File): Promise<Record<string, unknown>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  }
  const text = await file.text()
  return parseCSV(text)
}

function mapRow(raw: Record<string, unknown>): ParsedRow {
  const id           = col(raw, 'id', 'ID', 'Reference', 'reference', 'txn_id', 'TXN_ID')
  const customerId   = col(raw, 'customer_id', 'Customer ID', 'customerId')
  const customerName = col(raw, 'customer_name', 'Customer Name', 'customerName')
  const amtStr       = col(raw, 'amount', 'Amount')
  const amount       = amtStr ? Number(amtStr.replace(/[^0-9.-]/g, '')) : NaN
  const channel      = col(raw, 'channel', 'Channel')
  const counterparty = col(raw, 'counterparty', 'Counterparty')
  const riskStr      = col(raw, 'risk_score', 'Risk Score', 'riskScore', 'risk')
  const riskScore    = riskStr ? Number(riskStr) : 0
  const status       = (col(raw, 'status', 'Status') || 'pending') as any
  const location     = col(raw, 'location', 'Location') || undefined
  const latStr       = col(raw, 'lat', 'Lat', 'Latitude')
  const lngStr       = col(raw, 'lng', 'Lng', 'Longitude')
  const lat          = latStr ? Number(latStr) : undefined
  const lng          = lngStr ? Number(lngStr) : undefined
  const occurredAt   = col(raw, 'occurred_at', 'Occurred At', 'occurredAt', 'date', 'Date')
    || new Date().toISOString()
  const senderAccount    = col(raw, 'sender_account',    'Sender Account',    'senderAccount')    || undefined
  const senderBank       = col(raw, 'sender_bank',       'Sender Bank',       'senderBank')       || undefined
  const recipientName    = col(raw, 'recipient_name',    'Recipient Name',    'recipientName')    || undefined
  const recipientAccount = col(raw, 'recipient_account', 'Recipient Account', 'recipientAccount') || undefined
  const recipientBank    = col(raw, 'recipient_bank',    'Recipient Bank',    'recipientBank')    || undefined
  const currency         = col(raw, 'currency', 'Currency') || undefined
  const narration        = col(raw, 'narration', 'Narration', 'Description', 'description') || undefined
  const deviceId         = col(raw, 'device_id', 'Device ID', 'deviceId')   || undefined
  const ipAddress        = col(raw, 'ip_address', 'IP Address', 'ipAddress') || undefined

  const errors: string[] = []
  if (!id)                                       errors.push('Reference (id) is required')
  if (!customerId)                               errors.push('Customer ID is required')
  if (!customerName)                             errors.push('Customer name is required')
  if (isNaN(amount) || amount <= 0)              errors.push('Amount must be a positive number')
  if (!channel)                                  errors.push('Channel is required')
  if (!counterparty)                             errors.push('Counterparty is required')
  if (status && !VALID_STATUSES.has(status))     errors.push(`Status must be one of: ${[...VALID_STATUSES].join(', ')}`)
  if (riskScore < 0 || riskScore > 100)          errors.push('Risk score must be 0–100')

  return {
    id, customerId, customerName, amount: isNaN(amount) ? 0 : amount, channel, counterparty,
    riskScore, status, location, lat, lng, occurredAt,
    senderAccount, senderBank, recipientName, recipientAccount, recipientBank,
    currency, narration, deviceId, ipAddress,
    _errors: errors,
  }
}

function downloadTemplate() {
  const header = 'id,customer_id,customer_name,amount,channel,counterparty,risk_score,status,location,lat,lng,occurred_at,sender_account,sender_bank,recipient_name,recipient_account,recipient_bank,currency,narration,device_id,ip_address'
  const example = `TXN-001,CUS-001,Adamu Ibrahim,14250000,Wire,Sokoto BDC Ltd,72,pending,Sokoto,13.0059,5.2476,${new Date().toISOString()},0124567890,Access Bank,Sokoto BDC Ltd,0034567891,GTBank,NGN,FX Settlement — USD Purchase,dev_a1b2c3,102.89.45.67`
  const blob = new Blob([header + '\n' + example], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'transactions_template.csv' })
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ImportTransactionsModal({ open, onClose, onImported }: Props) {
  const navigate   = useNavigate()
  const fileRef    = useRef<HTMLInputElement>(null)
  const [step,        setStep]       = useState<Step>('choose')
  const [dragOver,    setDragOver]   = useState(false)
  const [file,        setFile]       = useState<File | null>(null)
  const [parseError,  setParseError] = useState<string | null>(null)
  const [parsed,      setParsed]     = useState<ParsedRow[]>([])
  const [importing,   setImporting]  = useState(false)
  const [importError, setImportError]= useState<string | null>(null)
  const [checkingRole,setCheckingRole] = useState(false)
  const [totpOpen,    setTotpOpen]   = useState(false)

  const reset = useCallback(() => {
    setStep('choose'); setFile(null); setParseError(null); setParsed([])
    setImporting(false); setImportError(null); setDragOver(false); setCheckingRole(false)
    setTotpOpen(false)
  }, [])

  const handleClose = () => { reset(); onClose() }

  // ── file handling ──────────────────────────────────────────────────────────

  const processFile = useCallback(async (f: File) => {
    setParseError(null)
    setFile(f)
    try {
      const rawRows = await fileToRows(f)
      if (rawRows.length === 0) { setParseError('The file appears to be empty or has no data rows.'); return }
      if (rawRows.length > 500) { setParseError('Maximum 500 rows per import. Split into smaller files.'); return }
      const rows = rawRows.map(mapRow)
      setParsed(rows)
      setStep('preview')
    } catch {
      setParseError('Could not parse the file. Make sure it is a valid CSV or XLSX.')
    }
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }

  // ── API ingestion role check ───────────────────────────────────────────────

  const handleApiIngestion = async () => {
    setCheckingRole(true)
    try {
      const [sessionRes, rolesRes] = await Promise.all([authApi.session(), teamApi.listRoles()])
      const userRoleId = sessionRes.role ?? ''
      const roleObj    = rolesRes.roles.find(r => r.id === userRoleId)
      const roleName   = roleObj?.name ?? userRoleId
      const isDev      = roleName.toLowerCase() === 'developer' || userRoleId.toLowerCase() === 'developer'
      if (isDev) {
        handleClose()
        navigate('/dashboard/beam')
      } else {
        setStep('api-warn')
      }
    } catch {
      setStep('api-warn')
    } finally {
      setCheckingRole(false)
    }
  }

  // ── import submit ──────────────────────────────────────────────────────────

  // Step 1 — gate on TOTP
  const handleImport = () => {
    const valid = parsed.filter(r => r._errors.length === 0)
    if (valid.length === 0) return
    setTotpOpen(true)
  }

  // Step 2 — called by TOTPConfirmation.onConfirm after identity verified
  const executeImport = async () => {
    const valid = parsed.filter(r => r._errors.length === 0)
    setTotpOpen(false)
    setImporting(true)
    setImportError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const rows: ImportRow[] = valid.map(({ _errors: _e, ...r }) => r)
      const res = await transactionApi.importTransactions(rows)
      onImported()
      handleClose()
      console.info(`Imported ${res.imported} transactions`)
    } catch {
      setImportError('Import failed. Please try again or contact support.')
    } finally {
      setImporting(false)
    }
  }

  const validRows   = parsed.filter(r => r._errors.length === 0)
  const invalidRows = parsed.filter(r => r._errors.length > 0)

  if (!open) return null

  // ── modal widths per step ─────────────────────────────────────────────────
  const modalWidth = step === 'preview' ? 860 : 460

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={importing ? undefined : handleClose}
        sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', zIndex: 1290 }}
      />

      {/* Modal */}
      <Box sx={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `min(${modalWidth}px, 96vw)`,
        bgcolor: 'var(--card-bg)', zIndex: 1291,
        boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
        animation: 'modalIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        '@keyframes modalIn': { from: { opacity: 0, transform: 'translate(-50%,-48%) scale(0.97)' }, to: { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' } },
      }}>

        {/* ── STEP: choose ─────────────────────────────────────────────────── */}
        {step === 'choose' && (
          <Box sx={{ p: 3 }}>
            <ModalHeader title="Import Transactions" onClose={handleClose} />
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mb: 2.5 }}>
              How would you like to import your transaction data?
            </Typography>

            <Stack gap={1.25}>
              <OptionCard
                icon={<TableChartOutlinedIcon sx={{ fontSize: '1.5rem', color: colorPalette.primary }} />}
                title="CSV / XLSX"
                description="Upload a formatted spreadsheet file"
                onClick={() => setStep('upload')}
              />
              <OptionCard
                icon={<UploadFileOutlinedIcon sx={{ fontSize: '1.5rem', color: '#64748b' }} />}
                title="API Ingestion"
                description="Stream transactions in real-time via the openIV Beam API"
                onClick={handleApiIngestion}
                loading={checkingRole}
              />
            </Stack>
          </Box>
        )}

        {/* ── STEP: upload ─────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <Box sx={{ p: 3 }}>
            <ModalHeader
              title="Upload File"
              showBack
              onBack={() => { setStep('choose'); setFile(null); setParseError(null) }}
              onClose={handleClose}
            />
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mb: 2 }}>
              Accepted formats: <strong>.csv</strong> and <strong>.xlsx</strong> — up to 500 rows.
            </Typography>

            {/* Drop zone */}
            <Box
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              sx={{
                border: `2px dashed ${dragOver ? colorPalette.primary : '#cbd5e1'}`,
                bgcolor: dragOver ? `${colorPalette.primary}06` : 'var(--section-bg)',
                p: 4, textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
                '&:hover': { borderColor: colorPalette.primary, bgcolor: `${colorPalette.primary}06` },
              }}
            >
              <UploadFileOutlinedIcon sx={{ fontSize: '2rem', color: dragOver ? colorPalette.primary : '#94a3b8', mb: 1 }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                Drop your file here, or <Box component="span" sx={{ color: colorPalette.primary }}>browse</Box>
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 0.5 }}>
                CSV or XLSX, max 500 rows
              </Typography>
            </Box>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />

            {/* Selected file indicator */}
            {file && !parseError && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, px: 1.5, py: 1, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <CheckRoundedIcon sx={{ fontSize: '1rem', color: '#10b981' }} />
                <Typography sx={{ fontSize: '0.8125rem', color: '#065f46', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#6ee7b7' }}>
                  {(file.size / 1024).toFixed(1)} KB
                </Typography>
              </Box>
            )}

            {parseError && (
              <Alert severity="error" sx={{ mt: 1.5, borderRadius: 0 }}>{parseError}</Alert>
            )}

            {/* Template download */}
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box
                onClick={downloadTemplate}
                sx={{ fontSize: '0.8125rem', color: colorPalette.primary, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
              >
                Download template CSV
              </Box>
            </Box>
          </Box>
        )}

        {/* ── STEP: preview ────────────────────────────────────────────────── */}
        {step === 'preview' && (
          <Box sx={{ p: 3 }}>
            <ModalHeader
              title={`Preview — ${parsed.length} row${parsed.length !== 1 ? 's' : ''}`}
              showBack
              onBack={() => setStep('upload')}
              onClose={handleClose}
            />

            {invalidRows.length > 0 && (
              <Alert severity="warning" sx={{ borderRadius: 0, mb: 2, fontSize: '0.8125rem' }}>
                {invalidRows.length} row{invalidRows.length !== 1 ? 's' : ''} have errors and will be skipped.
                Only {validRows.length} valid row{validRows.length !== 1 ? 's' : ''} will be imported.
              </Alert>
            )}

            {importError && (
              <Alert severity="error" sx={{ borderRadius: 0, mb: 2, fontSize: '0.8125rem' }}>{importError}</Alert>
            )}

            {/* Preview table */}
            <Box sx={{ border: '1px solid var(--border-col)', maxHeight: 360, overflow: 'auto' }}>
              {/* Header */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '24px 1fr 110px 120px 110px 80px 90px 90px', gap: 1.5, px: 1.5, py: 1, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)', position: 'sticky', top: 0 }}>
                <Box />
                {['Reference', 'Customer ID', 'Customer Name', 'Amount', 'Channel', 'Status', 'Risk'].map(h => (
                  <Typography key={h} sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {h}
                  </Typography>
                ))}
              </Box>

              {parsed.map((row, i) => {
                const hasErr = row._errors.length > 0
                return (
                  <Box
                    key={i}
                    title={hasErr ? row._errors.join('\n') : undefined}
                    sx={{ display: 'grid', gridTemplateColumns: '24px 1fr 110px 120px 110px 80px 90px 90px', gap: 1.5, px: 1.5, py: 1.125, borderBottom: '1px solid var(--border-col)', bgcolor: hasErr ? '#fff7f7' : 'transparent', '&:last-child': { borderBottom: 'none' }, alignItems: 'center' }}
                  >
                    {hasErr
                      ? <ErrorOutlineRoundedIcon sx={{ fontSize: '0.875rem', color: '#ef4444' }} />
                      : <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#10b981' }} />
                    }
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: hasErr ? '#b91c1c' : '#00288e', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.id || <Box component="span" sx={{ color: '#ef4444', fontStyle: 'italic' }}>missing</Box>}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.customerId || '—'}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.customerName || '—'}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>{row.amount ? row.amount.toLocaleString() : '—'}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>{row.channel || '—'}</Typography>
                    <StatusBadge status={row.status || 'pending'} />
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{row.riskScore ?? 0}</Typography>
                  </Box>
                )
              })}
            </Box>

            {/* Footer */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2.5 }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {validRows.length} of {parsed.length} rows ready
              </Typography>
              <Stack direction="row" gap={1}>
                <Button
                  disableRipple onClick={() => setStep('upload')}
                  sx={{ color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'none', borderRadius: 0, border: '1px solid #e5e7eb', px: 2 }}
                >
                  Back
                </Button>
                <Button
                  disableRipple
                  disabled={validRows.length === 0 || importing}
                  onClick={handleImport}
                  startIcon={importing ? undefined : <CheckRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                  sx={{ bgcolor: colorPalette.primary, color: '#fff', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'none', borderRadius: 0, px: 2.5, '&:hover': { bgcolor: colorPalette.primary }, '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }}
                >
                  {importing ? 'Importing…' : `Import ${validRows.length} transaction${validRows.length !== 1 ? 's' : ''}`}
                </Button>

              </Stack>
            </Box>
          </Box>
        )}

        {/* ── STEP: api-warn ───────────────────────────────────────────────── */}
        {step === 'api-warn' && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
              <IconButton disableRipple size="small" onClick={handleClose} sx={{ borderRadius: 0, color: '#94a3b8' }}>
                <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
              </IconButton>
            </Box>

            <Box sx={{ width: 48, height: 48, bgcolor: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <WarningAmberRoundedIcon sx={{ fontSize: '1.5rem', color: '#d97706' }} />
            </Box>

            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 1 }}>
              API Ingestion
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.7, mb: 2 }}>
              This process is <strong>delicate &amp; technical</strong> and requires developer access
              to configure securely.
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.7, mb: 3 }}>
              Kindly contact your tech team or reach out to us directly:
            </Typography>

            <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', px: 2.5, py: 1.5, mb: 3, display: 'inline-block' }}>
              <Typography
                component="a"
                href="mailto:hello@openiv.ng"
                sx={{ fontSize: '0.9375rem', fontWeight: 700, color: colorPalette.primary, textDecoration: 'none', fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '-0.01em' }}
              >
                hello@openiv.ng
              </Typography>
            </Box>

            <Box>
              <Button
                disableRipple
                onClick={handleClose}
                sx={{ bgcolor: colorPalette.primary, color: '#fff', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', borderRadius: 0, px: 3, '&:hover': { bgcolor: colorPalette.primary } }}
              >
                Got it
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      <TOTPConfirmation
        open={totpOpen}
        onClose={() => setTotpOpen(false)}
        onConfirm={executeImport}
        operation="create"
        title="Confirm Import"
        description={`You are about to import ${validRows.length} transaction${validRows.length !== 1 ? 's' : ''}. Enter your authenticator code to proceed.`}
        itemsAffected={validRows.slice(0, 5).map(r => r.id)}
      />
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ModalHeader({ title, showBack, onBack, onClose }: {
  title: string; showBack?: boolean; onBack?: () => void; onClose: () => void
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      {showBack && (
        <IconButton disableRipple size="small" onClick={onBack} sx={{ borderRadius: 0, color: '#64748b', mr: 0.5, ml: -0.5, '&:hover': { color: 'var(--heading-color)' } }}>
          <ArrowBackRoundedIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      )}
      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', flex: 1 }}>
        {title}
      </Typography>
      <IconButton disableRipple size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: 'var(--on-surface-variant)' } }}>
        <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
      </IconButton>
    </Box>
  )
}

function OptionCard({ icon, title, description, onClick, loading }: {
  icon: React.ReactNode; title: string; description: string; onClick: () => void; loading?: boolean
}) {
  return (
    <Box
      onClick={loading ? undefined : onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.75,
        border: '1px solid var(--border-col)', cursor: loading ? 'wait' : 'pointer',
        transition: 'all 0.15s', bgcolor: 'transparent',
        '&:hover': loading ? {} : { borderColor: colorPalette.primary, bgcolor: `${colorPalette.primary}06` },
      }}
    >
      <Box sx={{ flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
          {description}
        </Typography>
      </Box>
      <ArrowForwardRoundedIcon sx={{ fontSize: '1rem', color: loading ? '#cbd5e1' : '#94a3b8' }} />
    </Box>
  )
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending:    { color: '#f59e0b', bg: '#fffbeb' },
  successful: { color: '#10b981', bg: '#f0fdf4' },
  failed:     { color: '#dc2626', bg: '#fef2f2' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 0.875, bgcolor: cfg.bg }}>
      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '18px' }}>
        {status}
      </Typography>
    </Box>
  )
}
