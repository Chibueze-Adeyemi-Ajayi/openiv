import { useState } from 'react'
import {
  Dialog, Box, Typography, Stack, Button, IconButton, Divider,
} from '@mui/material'
import { colorPalette } from '@/theme'
import { nfiuApi, type NfiuReport } from '@/api/nfiu'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

// ── Type label map ────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  STR:        'Suspicious Transaction Report',
  CTR:        'Currency Transaction Report',
  SAR:        'Suspicious Activity Report',
  ITF:        'International Transfer Filing',
  PEP:        'PEP Disclosure',
  AML_RETURN: 'Monthly AML Return',
}

const GOAML_CODE: Record<string, string> = {
  STR:        'STR',
  CTR:        'CTR',
  SAR:        'SAR',
  ITF:        'EFTR',
  PEP:        'PEP',
  AML_RETURN: 'STR',
}

const TYPE_COLOR: Record<string, string> = {
  STR:        '#dc2626',
  CTR:        '#d97706',
  SAR:        '#7c3aed',
  ITF:        '#0891b2',
  PEP:        '#be185d',
  AML_RETURN: '#15803d',
}

// ── Filing steps ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: <FileDownloadOutlinedIcon sx={{ fontSize: '1.125rem' }} />,
    title: 'Download the goAML XML file',
    body: 'Click "Download XML" below. The file is pre-populated with your report data in the UNODC goAML v4 schema format accepted by the NFIU portal.',
    color: colorPalette.primary,
    bg: `${colorPalette.primary}0d`,
  },
  {
    icon: <OpenInNewRoundedIcon sx={{ fontSize: '1.125rem' }} />,
    title: 'Log in to the NFIU goAML portal',
    body: 'Navigate to goaml.nfiu.gov.ng and sign in with your institution\'s registered credentials. If you do not have an account, contact the NFIU Registration Desk.',
    color: '#1d4ed8',
    bg: '#eff6ff',
    link: { label: 'goaml.nfiu.gov.ng', href: 'https://goaml.nfiu.gov.ng' },
  },
  {
    icon: <ArticleOutlinedIcon sx={{ fontSize: '1.125rem' }} />,
    title: 'Create a new report submission',
    body: 'From the dashboard, go to Reports → New Report. Select the report type matching the one shown above. Choose "XML Upload" as your entry method.',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
  {
    icon: <CloudUploadOutlinedIcon sx={{ fontSize: '1.125rem' }} />,
    title: 'Upload the XML file',
    body: 'On the XML upload screen, attach the file you downloaded in Step 1. The portal will validate the schema automatically. Correct any validation errors before proceeding.',
    color: '#0891b2',
    bg: '#f0f9ff',
  },
  {
    icon: <VerifiedOutlinedIcon sx={{ fontSize: '1.125rem' }} />,
    title: 'Review, submit, and save the reference',
    body: 'Review the pre-filled fields, complete any fields marked mandatory by the portal, then submit. The portal will issue a goAML reference number — record it in the "Acknowledgement Ref" field of this report.',
    color: '#10b981',
    bg: '#f0fdf4',
  },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  report: NfiuReport | null
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GoAmlFilingGuide({ open, report, onClose }: Props) {
  const [downloading, setDownloading] = useState(false)
  const [downloaded,  setDownloaded]  = useState(false)
  const [dlError,     setDlError]     = useState<string | null>(null)

  const handleDownload = async () => {
    if (!report) return
    setDownloading(true)
    setDlError(null)
    try {
      await nfiuApi.downloadGoAml(report.id, report.reference)
      setDownloaded(true)
    } catch (e: any) {
      setDlError(e?.message ?? 'Download failed — please try again')
    } finally {
      setDownloading(false)
    }
  }

  if (!report) return null

  const typeLabel  = TYPE_LABEL[report.reportType]  ?? report.reportType
  const goAmlCode  = GOAML_CODE[report.reportType]  ?? 'STR'
  const typeColor  = TYPE_COLOR[report.reportType]  ?? '#64748b'
  const isAmlReturn = report.reportType === 'AML_RETURN'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 0, boxShadow: '0 24px 64px rgba(0,0,0,0.14)', maxHeight: '92vh' } }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box sx={{ px: 1, py: 0.25, bgcolor: `${typeColor}14` }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: typeColor, letterSpacing: '0.1em' }}>
                {report.reportType}
              </Typography>
            </Box>
            <Box sx={{ px: 1, py: 0.25, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748b', fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '0.08em' }}>
                {report.reference}
              </Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            Submit to NFIU goAML Portal
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mt: 0.25 }}>
            {typeLabel}
          </Typography>
        </Box>
        <IconButton disableRipple size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', mt: 0.25, '&:hover': { color: '#475569' } }}>
          <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
        </IconButton>
      </Box>

      {/* ── Scrollable body ──────────────────────────────────────────────────── */}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>

        {/* ── Report summary card ──────────────────────────────────────────── */}
        <Box sx={{ mx: 3, mt: 2.5, p: 2, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1.25 }}>
            Report summary
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            {[
              { label: 'Type',          value: typeLabel },
              { label: 'goAML code',    value: goAmlCode, mono: true },
              { label: 'Reference',     value: report.reference, mono: true },
              { label: 'Period',        value: `${report.periodStart} → ${report.periodEnd}` },
              report.subjectName  ? { label: 'Subject',    value: report.subjectName }  : null,
              report.amountNgn    ? { label: 'Amount',     value: `₦${report.amountNgn.toLocaleString()}` } : null,
              report.officerName  ? { label: 'Officer',    value: report.officerName }  : null,
              report.filingDate   ? { label: 'Filed on',   value: new Date(report.filingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) } : null,
            ].filter(Boolean).map((item: any) => (
              <Box key={item.label}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
                  {item.label}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#00288e', fontFamily: item.mono ? 'SF Mono, Monaco, monospace' : 'Jost', fontWeight: item.mono ? 400 : 600, wordBreak: 'break-all' }}>
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── AML_RETURN notice ────────────────────────────────────────────── */}
        {isAmlReturn && (
          <Box sx={{ mx: 3, mt: 2, px: 2, py: 1.5, bgcolor: '#fff7ed', border: '1px solid #fed7aa', display: 'flex', gap: 1.25 }}>
            <WarningAmberRoundedIcon sx={{ fontSize: '1rem', color: '#b45309', flexShrink: 0, mt: 0.125 }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#92400e', lineHeight: 1.6 }}>
              Monthly AML Returns are submitted as a <strong>batch of STR entries</strong> in goAML. Select report type <strong>STR</strong> on the portal and upload each transaction separately, or bundle them in a single XML. The generated file uses the STR schema.
            </Typography>
          </Box>
        )}

        {/* ── Steps ───────────────────────────────────────────────────────── */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1.75 }}>
            Filing steps
          </Typography>
          <Stack gap={0}>
            {STEPS.map((step, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.5, pb: i < STEPS.length - 1 ? 0 : 0 }}>
                {/* Step number + connector line */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <Box sx={{
                    width: 28, height: 28, borderRadius: '50%', bgcolor: step.bg,
                    border: `1.5px solid ${step.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: step.color, flexShrink: 0,
                  }}>
                    {step.icon}
                  </Box>
                  {i < STEPS.length - 1 && (
                    <Box sx={{ width: '1.5px', flex: 1, minHeight: 20, bgcolor: '#eef0f4', my: 0.5 }} />
                  )}
                </Box>

                {/* Content */}
                <Box sx={{ pb: i < STEPS.length - 1 ? 2 : 0, pt: 0.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.375 }}>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em' }}>
                      STEP {i + 1}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 0.375 }}>
                    {step.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.6 }}>
                    {step.body}
                  </Typography>
                  {step.link && (
                    <Box
                      component="a"
                      href={step.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.75,
                        fontSize: '0.75rem', fontWeight: 600, color: '#1d4ed8',
                        textDecoration: 'none', '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      <OpenInNewRoundedIcon sx={{ fontSize: '0.75rem' }} />
                      {step.link.label}
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* ── Schema notes ─────────────────────────────────────────────────── */}
        <Box sx={{ mx: 3, mb: 2.5, p: 2, bgcolor: '#f8fafc', border: '1px solid #eef0f4', display: 'flex', gap: 1.25 }}>
          <InfoOutlinedIcon sx={{ fontSize: '0.9375rem', color: '#64748b', flexShrink: 0, mt: 0.125 }} />
          <Stack gap={0.625}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
              About the generated XML
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', lineHeight: 1.6 }}>
              The file follows the <strong>UNODC goAML Data Model v4</strong> schema, the international standard used by FIUs in 140+ countries including the NFIU Nigeria.
              Fields without stored values are included as empty elements to satisfy the schema validator — complete them on the portal if required.
              The <code style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>fiu_ref_number</code> is left blank; the portal assigns it on successful submission.
            </Typography>
          </Stack>
        </Box>

      </Box>

      {/* ── Footer actions ───────────────────────────────────────────────────── */}
      <Divider />
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, bgcolor: '#fafbfc' }}>
        <Box>
          {downloaded && !dlError && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: '0.875rem', color: '#10b981' }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                XML downloaded — proceed to the portal
              </Typography>
            </Box>
          )}
          {dlError && (
            <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
              {dlError}
            </Typography>
          )}
        </Box>

        <Stack direction="row" gap={1}>
          <Button
            onClick={onClose}
            sx={{
              fontSize: '0.8125rem', fontFamily: 'Jost', fontWeight: 600,
              color: '#64748b', textTransform: 'none', px: 2, py: 1,
              borderRadius: 0, '&:hover': { bgcolor: '#f1f5f9' },
            }}
          >
            Close
          </Button>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            startIcon={
              downloaded
                ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1rem !important', color: '#ffffff' }} />
                : <FileDownloadOutlinedIcon sx={{ fontSize: '1rem !important', color: '#ffffff' }} />
            }
            sx={{
              bgcolor: downloaded ? '#10b981' : colorPalette.primary,
              color: '#ffffff',
              px: 2.25, py: 1, fontSize: '0.8125rem', fontWeight: 600,
              fontFamily: 'Jost', borderRadius: 0, textTransform: 'none',
              boxShadow: 'none',
              '& .MuiButton-startIcon': { color: '#ffffff' },
              '&:hover': { bgcolor: downloaded ? '#059669' : '#1e293b' },
              '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
            }}
          >
            {downloading ? 'Generating…' : downloaded ? 'Download again' : 'Download XML'}
          </Button>
        </Stack>
      </Box>
    </Dialog>
  )
}
