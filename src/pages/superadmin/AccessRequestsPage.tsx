import { useEffect, useState } from 'react'
import {
  Box, Typography, Stack, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Divider,
} from '@mui/material'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { superAdminApi, type AccessRequestItem } from '@/api/superAdmin'

type Tab = 'pending' | 'approved' | 'rejected'

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

const statusColor = (s: string): 'warning' | 'success' | 'error' | 'default' => {
  if (s === 'pending') return 'warning'
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'error'
  return 'default'
}

const cellSx = { fontFamily: 'Jost', fontSize: '0.8125rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', py: 1.5, px: 2 }
const headCellSx = { fontFamily: 'Jost', fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.07em', borderBottom: '1px solid #e2e8f0', py: 1.25, px: 2, bgcolor: '#fafbfc' }

export default function AccessRequestsPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [requests, setRequests] = useState<AccessRequestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [detail, setDetail] = useState<AccessRequestItem | null>(null)
  const [actionModal, setActionModal] = useState<{ type: 'approve' | 'reject'; request: AccessRequestItem } | null>(null)
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const load = async (status: Tab) => {
    setLoading(true)
    setError(null)
    try {
      const res = await superAdminApi.listRequests(status)
      setRequests(res.requests)
    } catch {
      setError('Failed to load requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(tab) }, [tab])

  const openAction = (type: 'approve' | 'reject', req: AccessRequestItem) => {
    setActionModal({ type, request: req })
    setNotes('')
    setActionError(null)
    setDetail(null)
  }

  const submitAction = async () => {
    if (!actionModal) return
    setActing(true)
    setActionError(null)
    try {
      if (actionModal.type === 'approve') {
        const res = await superAdminApi.approveRequest(actionModal.request.id, notes || undefined)
        setSuccessMsg(`✓ Approved. Institution "${res.institutionName}" created. Invite sent to ${actionModal.request.contactEmail}.`)
      } else {
        await superAdminApi.rejectRequest(actionModal.request.id, notes || undefined)
        setSuccessMsg(`Request from ${actionModal.request.contactEmail} rejected.`)
      }
      setActionModal(null)
      load(tab)
    } catch {
      setActionError('Action failed. Please try again.')
    } finally {
      setActing(false)
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1.5rem', color: '#00288e', letterSpacing: '-0.02em' }}>
          Access Requests
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mt: 0.5, fontFamily: 'Jost' }}>
          Review and action institution onboarding requests.
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg(null)} sx={{ mb: 3, borderRadius: 0, fontFamily: 'Jost' }}>
          {successMsg}
        </Alert>
      )}

      {/* Tabs */}
      <Stack direction="row" sx={{ borderBottom: '1px solid #e2e8f0', mb: 0 }}>
        {TAB_LABELS.map(({ key, label }) => (
          <Box
            key={key}
            onClick={() => setTab(key)}
            sx={{
              px: 3, py: 1.5, cursor: 'pointer',
              fontFamily: 'Jost', fontSize: '0.875rem', fontWeight: tab === key ? 600 : 500,
              color: tab === key ? '#00288e' : '#64748b',
              borderBottom: tab === key ? '2px solid #00288e' : '2px solid transparent',
              mb: '-1px',
              transition: 'all 0.15s',
              '&:hover': { color: '#00288e' },
            }}
          >
            {label}
          </Box>
        ))}
      </Stack>

      {/* Table */}
      <Box sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: 'none' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} sx={{ color: '#00288e' }} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2, borderRadius: 0 }}>{error}</Alert>
        ) : requests.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontFamily: 'Jost', fontSize: '0.875rem' }}>
              No {tab} requests.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={headCellSx}>Institution</TableCell>
                  <TableCell sx={headCellSx}>Contact</TableCell>
                  <TableCell sx={headCellSx}>Role</TableCell>
                  <TableCell sx={headCellSx}>Type</TableCell>
                  <TableCell sx={headCellSx}>Submitted</TableCell>
                  <TableCell sx={headCellSx}>Status</TableCell>
                  <TableCell sx={headCellSx} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontWeight: 600, fontFamily: 'Jost', fontSize: '0.8125rem', color: '#0f172a' }}>
                        {req.institutionName}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontFamily: 'Jost', fontSize: '0.8125rem' }}>{req.contactName}</Typography>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>{req.contactEmail}</Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontFamily: 'Jost', fontSize: '0.8125rem', color: req.jobTitle ? '#1e293b' : '#cbd5e1' }}>
                        {req.jobTitle || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontFamily: 'Jost', fontSize: '0.8125rem', color: '#475569' }}>
                        {req.institutionType.replace('_', ' ')}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontFamily: 'Jost', fontSize: '0.8125rem', color: '#64748b' }}>
                        {new Date(req.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Chip
                        label={req.status}
                        color={statusColor(req.status)}
                        size="small"
                        sx={{ fontFamily: 'Jost', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', borderRadius: 0.5, height: 22 }}
                      />
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      <Stack direction="row" gap={0.5} justifyContent="flex-end">
                        <Button
                          size="small"
                          startIcon={<VisibilityOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                          onClick={() => setDetail(req)}
                          sx={{ textTransform: 'none', fontFamily: 'Jost', fontSize: '0.75rem', color: '#64748b', borderRadius: 0, px: 1.25, py: 0.5, border: '1px solid #e2e8f0', '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' } }}
                        >
                          View
                        </Button>
                        {req.status === 'pending' && (
                          <>
                            <Button
                              size="small"
                              startIcon={<CheckCircleOutlineRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
                              onClick={() => openAction('approve', req)}
                              sx={{ textTransform: 'none', fontFamily: 'Jost', fontSize: '0.75rem', color: '#16a34a', borderRadius: 0, px: 1.25, py: 0.5, border: '1px solid #bbf7d0', '&:hover': { bgcolor: '#f0fdf4', borderColor: '#86efac' } }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              startIcon={<CancelOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                              onClick={() => openAction('reject', req)}
                              sx={{ textTransform: 'none', fontFamily: 'Jost', fontSize: '0.75rem', color: '#dc2626', borderRadius: 0, px: 1.25, py: 0.5, border: '1px solid #fecaca', '&:hover': { bgcolor: '#fef2f2', borderColor: '#fca5a5' } }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 0 } } }}>
        {detail && (
          <>
            <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 700, color: '#00288e', fontSize: '1.0625rem', pb: 1 }}>
              Request Details
            </DialogTitle>
            <DialogContent>
              <Stack gap={1.5}>
                {[
                  ['Institution', detail.institutionName],
                  ['Type', detail.institutionType],
                  ['Contact Name', detail.contactName],
                  ['Email', detail.contactEmail],
                  ['Phone', detail.contactPhone || '—'],
                  ['Job Title', detail.jobTitle || '—'],
                  ['Use Case', detail.description || '—'],
                  ['Review Notes', detail.reviewNotes || '—'],
                ].map(([label, value]) => (
                  <Box key={label}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Jost' }}>
                      {label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#1e293b', fontFamily: label === 'Email' ? 'monospace' : 'Jost', mt: 0.25 }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
              {detail.status === 'pending' && (
                <>
                  <Button onClick={() => openAction('approve', detail)} sx={{ textTransform: 'none', fontFamily: 'Jost', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 0, '&:hover': { bgcolor: '#f0fdf4' } }}>
                    Approve
                  </Button>
                  <Button onClick={() => openAction('reject', detail)} sx={{ textTransform: 'none', fontFamily: 'Jost', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 0, '&:hover': { bgcolor: '#fef2f2' } }}>
                    Reject
                  </Button>
                </>
              )}
              <Button onClick={() => setDetail(null)} sx={{ textTransform: 'none', fontFamily: 'Jost', color: '#64748b', borderRadius: 0 }}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={!!actionModal} onClose={() => !acting && setActionModal(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 0 } } }}>
        {actionModal && (
          <>
            <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1rem', color: actionModal.type === 'approve' ? '#16a34a' : '#dc2626', pb: 0.5 }}>
              {actionModal.type === 'approve' ? 'Approve Request' : 'Reject Request'}
            </DialogTitle>
            <DialogContent>
              <Typography sx={{ fontFamily: 'Jost', fontSize: '0.875rem', color: '#475569', mb: 2 }}>
                {actionModal.type === 'approve'
                  ? `This will create an institution for "${actionModal.request.institutionName}" and send an invitation to ${actionModal.request.contactEmail}.`
                  : `This will reject the request from "${actionModal.request.institutionName}".`}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', fontFamily: 'Jost', mb: 0.75 }}>
                Notes (optional)
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                placeholder={actionModal.type === 'approve' ? 'e.g. Verified CBN license, approved for Tier 1 access.' : 'e.g. Could not verify CBN registration number.'}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={acting}
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: 0, fontFamily: 'Jost', fontSize: '0.875rem' },
                  '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#00288e', borderWidth: '1px' },
                }}
              />
              {actionError && (
                <Alert severity="error" sx={{ mt: 1.5, borderRadius: 0, fontFamily: 'Jost', fontSize: '0.8125rem' }}>{actionError}</Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
              <Button
                onClick={() => setActionModal(null)}
                disabled={acting}
                sx={{ textTransform: 'none', fontFamily: 'Jost', color: '#64748b', borderRadius: 0 }}
              >
                Cancel
              </Button>
              <Button
                onClick={submitAction}
                disabled={acting}
                sx={{
                  textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, borderRadius: 0, px: 2.5,
                  bgcolor: actionModal.type === 'approve' ? '#16a34a' : '#dc2626',
                  color: '#ffffff', boxShadow: 'none',
                  '&:hover': { bgcolor: actionModal.type === 'approve' ? '#15803d' : '#b91c1c', boxShadow: 'none' },
                  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
                }}
              >
                {acting ? 'Processing…' : actionModal.type === 'approve' ? 'Confirm & Send Invite' : 'Confirm Rejection'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
