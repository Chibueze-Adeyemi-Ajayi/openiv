import { Box, Typography, Stack, Button, TextField } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { useState } from 'react'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import LinkRoundedIcon from '@mui/icons-material/LinkRounded'
import ApiRoundedIcon from '@mui/icons-material/ApiRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'

type SourceType = 'file' | 'url' | 'api'

const previewData = [
  { txnId: 'TXN-30482', date: '2026-04-19', amount: '₦450,000', from: 'ACC-2840', to: 'ACC-9281', channel: 'Mobile', mapped: true },
  { txnId: 'TXN-30481', date: '2026-04-19', amount: '₦14,200,000', from: 'ACC-1729', to: 'EXT-WIRE', channel: 'Wire', mapped: true },
  { txnId: 'TXN-30480', date: '2026-04-19', amount: '₦820,000', from: 'ACC-3847', to: 'ACC-1209', channel: 'PoS', mapped: true },
  { txnId: 'TXN-30479', date: '2026-04-19', amount: '₦5,400,000', from: 'ACC-9281', to: 'EXT-FX', channel: 'Wire', mapped: true },
  { txnId: 'TXN-30478', date: '2026-04-19', amount: '₦230,000', from: 'ACC-8472', to: 'ACC-3847', channel: 'Mobile', mapped: false },
  { txnId: 'TXN-30477', date: '2026-04-19', amount: '₦1,800,000', from: 'ACC-2840', to: 'ACC-7261', channel: 'PoS', mapped: true },
]

export default function IngestionPage() {
  const [source, setSource] = useState<SourceType>('file')
  const [uploaded, setUploaded] = useState(false)

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Configure
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Data Ingestion
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Bring transactions, customers, and historical records into OpenIV — preview before going live
          </Typography>
        </Box>

        {/* Source selector */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          {[
            { id: 'file' as SourceType, icon: <CloudUploadOutlinedIcon sx={{ fontSize: '1.5rem' }} />, title: 'Upload file', desc: 'XLSX, CSV up to 250MB' },
            { id: 'url' as SourceType, icon: <LinkRoundedIcon sx={{ fontSize: '1.5rem' }} />, title: 'Fetch from URL', desc: 'HTTPS, scheduled refresh' },
            { id: 'api' as SourceType, icon: <ApiRoundedIcon sx={{ fontSize: '1.5rem' }} />, title: 'Direct API stream', desc: 'Real-time push from your core' },
          ].map((s) => (
            <Box
              key={s.id}
              onClick={() => setSource(s.id)}
              data-ai-analyzable="true"
              data-ai-description={`Data Ingestion Source: ${s.title}. type: ${s.id}. capabilities: ${s.desc}.`}
              sx={{
                p: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid',
                borderColor: source === s.id ? colorPalette.primary : '#eef0f4',
                cursor: 'pointer',
                transition: 'all 0.18s',
                position: 'relative',
                '&:hover': { borderColor: source === s.id ? colorPalette.primary : '#cbd5e1' },
                '&::before': source === s.id ? {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '3px',
                  bgcolor: colorPalette.primary,
                } : {},
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: source === s.id ? colorPalette.primary : `${colorPalette.primary}10`,
                  color: source === s.id ? '#ffffff' : colorPalette.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1.5,
                  transition: 'all 0.18s',
                }}
              >
                {s.icon}
              </Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.25 }}>
                {s.title}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>{s.desc}</Typography>
            </Box>
          ))}
        </Box>

        {/* Source config */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3 }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              {source === 'file' && 'Upload spreadsheet'}
              {source === 'url' && 'Configure URL source'}
              {source === 'api' && 'API connection details'}
            </Typography>
          </Box>

          <Box sx={{ p: 3 }}>
            {source === 'file' && (
              <Box
                onClick={() => setUploaded(true)}
                sx={{
                  border: '2px dashed',
                  borderColor: uploaded ? colorPalette.primary : '#cbd5e1',
                  bgcolor: uploaded ? `${colorPalette.primary}06` : '#fafbfc',
                  p: 5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: colorPalette.primary, bgcolor: `${colorPalette.primary}06` },
                }}
              >
                {uploaded ? (
                  <Stack alignItems="center" gap={1.25}>
                    <CheckCircleOutlineRoundedIcon sx={{ fontSize: '2.5rem', color: '#10b981' }} />
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                      transactions_apr_2026.xlsx
                    </Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                      8,420 rows · 12 columns · 1.4 MB
                    </Typography>
                  </Stack>
                ) : (
                  <Stack alignItems="center" gap={1.25}>
                    <CloudUploadOutlinedIcon sx={{ fontSize: '2.5rem', color: '#94a3b8' }} />
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                      Drop your file here or click to browse
                    </Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                      XLSX, CSV — up to 250MB. We auto-detect headers and infer schema.
                    </Typography>
                  </Stack>
                )}
              </Box>
            )}

            {source === 'url' && (
              <Stack gap={2}>
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 0.875, fontFamily: 'Jost' }}>
                    Source URL
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="https://core.fcmb.com/api/transactions.csv"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#f5f3fb',
                        borderRadius: 0,
                        '& fieldset': { border: '1px solid transparent' },
                        '&.Mui-focused fieldset': { borderColor: colorPalette.primary },
                      },
                      '& input': { fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.8125rem', py: '14px', px: '14px' },
                    }}
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 0.875, fontFamily: 'Jost' }}>
                    Refresh schedule
                  </Typography>
                  <Stack direction="row" gap={1}>
                    {['Manual', 'Hourly', 'Every 6h', 'Daily', 'Real-time'].map((s, i) => (
                      <Box
                        key={s}
                        sx={{
                          px: 2,
                          py: 1,
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          fontFamily: 'Jost',
                          color: i === 1 ? '#ffffff' : '#475569',
                          bgcolor: i === 1 ? colorPalette.primary : '#f8fafc',
                          border: '1px solid',
                          borderColor: i === 1 ? colorPalette.primary : '#eef0f4',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          '&:hover': { borderColor: colorPalette.primary },
                        }}
                      >
                        {s}
                      </Box>
                    ))}
                  </Stack>
                </Box>
                <Button onClick={() => setUploaded(true)} sx={{ alignSelf: 'flex-start', bgcolor: colorPalette.primary, color: '#ffffff', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#1a3896' } }}>
                  Test Connection & Preview
                </Button>
              </Stack>
            )}

            {source === 'api' && (
              <Box sx={{ bgcolor: '#0f172a', color: '#e2e8f0', p: 2.5, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', lineHeight: 1.7, whiteSpace: 'pre', overflowX: 'auto' }}>
{`POST https://api.openiv.io/v1/ingest
Authorization: Bearer ${'<YOUR_API_KEY>'}
Content-Type: application/json

{
  "transaction_id": "TXN-48721",
  "amount": 14250000,
  "currency": "NGN",
  "channel": "wire",
  "from_account": "ACC-1729",
  "to_account": "EXT-WIRE",
  "timestamp": "2026-04-19T14:22:00Z"
}`}
              </Box>
            )}
          </Box>
        </Box>

        {/* Preview Section */}
        {uploaded && (
          <Box sx={{ animation: 'fadeIn 0.3s ease', '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3 }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    Preview · 8,420 records detected
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    Showing first 6 rows · Review schema mapping below
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1.125rem', color: '#10b981' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>
                    Schema validated
                  </Typography>
                </Box>
              </Box>

              {/* Eureka schema insight */}
              <Box 
                data-ai-analyzable="true"
                data-ai-description="Eureka Schema Mapping Insight: Automated column detection and mapping recommendations for your uploaded data. Currently proposing map for 'ref_code' to 'internal_reference'."
                sx={{ bgcolor: `${colorPalette.primary}06`, border: `1px solid ${colorPalette.primary}15`, mx: 3, mt: 2, p: 1.75, display: 'flex', gap: 1.25 }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem', color: colorPalette.primary, mt: 0.125, flexShrink: 0 }} />
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colorPalette.primary, mb: 0.25 }}>
                    Eureka detected your schema
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.55 }}>
                    Auto-mapped 11 of 12 columns to OpenIV's transaction schema. Column "ref_code" doesn't match — would you like to map it as <strong>internal_reference</strong>?
                  </Typography>
                </Box>
              </Box>

              {/* Mini Table */}
              <Box sx={{ overflowX: 'auto', m: 3, mt: 2 }}>
                <Box sx={{ display: 'inline-block', minWidth: '100%' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '130px 110px 130px 100px 100px 90px 80px', gap: 0, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
                    {['Txn ID', 'Date', 'Amount', 'From', 'To', 'Channel', 'Mapped'].map((h) => (
                      <Box key={h} sx={{ px: 1.5, py: 1.25 }}>
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          {h}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {previewData.map((row, i) => (
                    <Box
                      key={i}
                      data-ai-analyzable="true"
                      data-ai-description={`Data Preview Row: ${row.txnId}. amount: ${row.amount}. date: ${row.date}. channel: ${row.channel}. status: ${row.mapped ? 'Mapped successfully' : 'Mapping required'}.`}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '130px 110px 130px 100px 100px 90px 80px',
                        gap: 0,
                        borderBottom: i === previewData.length - 1 ? 'none' : '1px solid #f4f5f7',
                        '&:hover': { bgcolor: '#fafbfc' },
                      }}
                    >
                      <Box sx={{ px: 1.5, py: 1.25 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#0f172a' }}>{row.txnId}</Typography>
                      </Box>
                      <Box sx={{ px: 1.5, py: 1.25 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#475569' }}>{row.date}</Typography>
                      </Box>
                      <Box sx={{ px: 1.5, py: 1.25 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>{row.amount}</Typography>
                      </Box>
                      <Box sx={{ px: 1.5, py: 1.25 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>{row.from}</Typography>
                      </Box>
                      <Box sx={{ px: 1.5, py: 1.25 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>{row.to}</Typography>
                      </Box>
                      <Box sx={{ px: 1.5, py: 1.25 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#475569' }}>{row.channel}</Typography>
                      </Box>
                      <Box sx={{ px: 1.5, py: 1.25 }}>
                        {row.mapped ? (
                          <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1rem', color: '#10b981' }} />
                        ) : (
                          <WarningAmberRoundedIcon sx={{ fontSize: '1rem', color: '#f59e0b' }} />
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>

            {/* Action Bar */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.25 }}>
                  Ready to ingest
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                  8,420 records will be processed against your active rules. Estimated time: 18 seconds.
                </Typography>
              </Box>
              <Button
                onClick={() => setUploaded(false)}
                sx={{
                  bgcolor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #e5e7eb',
                  px: 2.25,
                  py: 1.125,
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
                sx={{
                  bgcolor: colorPalette.primary,
                  color: '#ffffff',
                  px: 3,
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
                Ingest 8,420 Records
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </DashboardLayout>
  )
}
