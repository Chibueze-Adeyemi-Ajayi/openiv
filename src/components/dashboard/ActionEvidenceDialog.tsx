import { useRef, useState } from 'react'
import { Box, Typography, CircularProgress } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import { colorPalette } from '@/theme'
import { documentApi } from '@/api/documents'

export interface EvidencePayload {
  reason: string
  documentId: number | null
  filename: string
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (payload: EvidencePayload) => void
  title: string
  actionLabel: string
  actionColor: string
  allowSkipDocument?: boolean
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt'
const MAX_MB   = 10

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ActionEvidenceDialog({ open, onClose, onConfirm, title, actionLabel, actionColor, allowSkipDocument }: Props) {
  const [reason,      setReason]      = useState('')
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadErr,   setUploadErr]   = useState<string | null>(null)
  const [docId,       setDocId]       = useState<number | null>(null)
  const [filename,    setFilename]    = useState<string>('')
  const [fileSize,    setFileSize]    = useState<number>(0)
  const [dragging,    setDragging]    = useState(false)
  const [skippedDoc,  setSkippedDoc]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reasonOk   = reason.trim().length >= 10
  const docSatisfied = uploadState === 'done' || (allowSkipDocument && skippedDoc)
  const canConfirm = reasonOk && docSatisfied

  const reset = () => {
    setReason('')
    setUploadState('idle')
    setUploadErr(null)
    setDocId(null)
    setFilename('')
    setFileSize(0)
    setSkippedDoc(false)
  }

  const handleClose = () => { reset(); onClose() }

  const uploadFile = async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadErr(`File exceeds ${MAX_MB} MB limit`)
      return
    }
    setUploadState('uploading')
    setUploadErr(null)
    setFilename(file.name)
    setFileSize(file.size)
    try {
      const result = await documentApi.upload(file)
      setDocId(result.id)
      setFilename(result.filename)
      setUploadState('done')
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'Upload failed')
      setUploadState('error')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm({ reason: reason.trim(), documentId: skippedDoc ? null : docId, filename })
    reset()
  }

  if (!open) return null

  return (
    <>
      <Box onClick={handleClose}
        sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.45)', zIndex: 1450 }} />
      <Box sx={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 460, bgcolor: 'var(--card-bg)', zIndex: 1451,
        boxShadow: '0 24px 64px rgba(15,23,42,0.2)',
        animation: 'evidFadeIn 0.2s ease',
        '@keyframes evidFadeIn': {
          from: { opacity: 0, transform: 'translate(-50%, -48%)' },
          to:   { opacity: 1, transform: 'translate(-50%, -50%)' },
        },
      }}>

        {/* Header */}
        <Box sx={{ px: 2.5, pt: 2.25, pb: 1.75, borderBottom: '1px solid var(--border-col)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
              {title}
            </Typography>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', mt: 0.5,
              px: 0.875, py: 0.25, bgcolor: `${actionColor}12`, border: `1px solid ${actionColor}30` }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: actionColor,
                textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {actionLabel}
              </Typography>
            </Box>
          </Box>
          <Box onClick={handleClose} sx={{ cursor: 'pointer', color: '#94a3b8', mt: 0.25,
            '&:hover': { color: 'var(--on-surface-variant)' }, display: 'flex' }}>
            <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: 2.5, py: 2 }}>

          {/* Reason */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>
              Reason <Box component="span" sx={{ color: '#dc2626' }}>*</Box>
            </Typography>
            <Box component="textarea"
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              placeholder="Provide a clear reason for this action (min. 10 characters)…"
              rows={3}
              sx={{
                width: '100%', boxSizing: 'border-box', display: 'block', resize: 'none',
                border: `1px solid ${reason.length > 0 && !reasonOk ? '#dc2626' : '#e2e8f0'}`,
                px: 1.25, py: 0.875,
                fontSize: '0.8125rem', fontFamily: 'Jost, sans-serif',
                color: 'var(--heading-color)', bgcolor: 'var(--card-bg)', outline: 'none',
                '&:focus': { borderColor: colorPalette.primary, bgcolor: 'var(--card-bg)' },
                '&::placeholder': { color: '#94a3b8' },
              }}
            />
            {reason.length > 0 && !reasonOk && (
              <Typography sx={{ fontSize: '0.6875rem', color: '#dc2626', mt: 0.5 }}>
                Minimum 10 characters required
              </Typography>
            )}
          </Box>

          {/* Document upload */}
          <Box sx={{ mb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Supporting Document {!allowSkipDocument && <Box component="span" sx={{ color: '#dc2626' }}>*</Box>}
                {allowSkipDocument && <Box component="span" sx={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (optional)</Box>}
              </Typography>
              {allowSkipDocument && !skippedDoc && uploadState !== 'done' && (
                <Typography onClick={() => setSkippedDoc(true)} sx={{ fontSize: '0.6875rem', color: colorPalette.primary, fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                  Skip
                </Typography>
              )}
              {allowSkipDocument && skippedDoc && (
                <Typography onClick={() => setSkippedDoc(false)} sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'var(--on-surface-variant)' } }}>
                  Add document
                </Typography>
              )}
            </Box>

            {skippedDoc ? (
              <Box sx={{ p: 1.5, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>No document — proceeding without evidence file</Typography>
              </Box>
            ) : uploadState === 'done' ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1,
                p: 1.25, bgcolor: '#f0fdf4', border: '1px solid #86efac' }}>
                <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1.125rem', color: '#10b981', flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)',
                    fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {filename}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>
                    {fmtSize(fileSize)} · Uploaded
                  </Typography>
                </Box>
                <Box onClick={() => { setUploadState('idle'); setDocId(null); setFilename(''); setFileSize(0) }}
                  sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', cursor: 'pointer',
                    flexShrink: 0, '&:hover': { color: '#dc2626' } }}>
                  Remove
                </Box>
              </Box>
            ) : (
              <Box
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => uploadState !== 'uploading' && fileRef.current?.click()}
                sx={{
                  border: `1.5px dashed ${dragging ? colorPalette.primary : uploadState === 'error' ? '#dc2626' : '#e2e8f0'}`,
                  bgcolor: dragging ? `${colorPalette.primary}06` : '#fafbfc',
                  p: 2.5, textAlign: 'center',
                  cursor: uploadState === 'uploading' ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': uploadState !== 'uploading' ? { borderColor: colorPalette.primary, bgcolor: `${colorPalette.primary}04` } : {},
                }}
              >
                <input ref={fileRef} type="file" accept={ACCEPTED}
                  onChange={handleFileChange} style={{ display: 'none' }} />

                {uploadState === 'uploading' ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={24} sx={{ color: colorPalette.primary }} />
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontFamily: 'Jost' }}>
                      Uploading {filename}…
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <UploadFileOutlinedIcon sx={{ fontSize: '1.75rem', color: '#94a3b8', mb: 0.75 }} />
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.375 }}>
                      {uploadState === 'error' ? 'Upload failed — try again' : 'Click or drag a file here'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                      PDF, Word, Excel, image · Max {MAX_MB} MB
                    </Typography>
                  </>
                )}
              </Box>
            )}

            {uploadErr && (
              <Typography sx={{ fontSize: '0.6875rem', color: '#dc2626', mt: 0.625, fontWeight: 500 }}>
                {uploadErr}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2.5, pb: 2.25, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Box onClick={handleClose}
            sx={{ px: 2, py: 0.875, border: '1px solid var(--border-col)', cursor: 'pointer',
              color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
              transition: 'all 0.15s', '&:hover': { borderColor: '#94a3b8', color: 'var(--on-surface-variant)' } }}>
            Cancel
          </Box>
          <Box onClick={handleConfirm} sx={{
            px: 2.25, py: 0.875, cursor: canConfirm ? 'pointer' : 'not-allowed',
            bgcolor: canConfirm ? actionColor : '#e2e8f0',
            color:   canConfirm ? '#ffffff'   : '#94a3b8',
            fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost',
            transition: 'all 0.15s',
            '&:hover': canConfirm ? { opacity: 0.88 } : {},
          }}>
            Confirm
          </Box>
        </Box>
      </Box>
    </>
  )
}
