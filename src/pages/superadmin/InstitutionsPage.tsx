import { useEffect, useState } from 'react'
import {
  Box, Typography, Stack, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import { superAdminApi, type InstitutionItem } from '@/api/superAdmin'

const cellSx = { fontFamily: 'Jost', fontSize: '0.8125rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', py: 1.5, px: 2 }
const headCellSx = { fontFamily: 'Jost', fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.07em', borderBottom: '1px solid #e2e8f0', py: 1.25, px: 2, bgcolor: '#fafbfc' }

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ inst: InstitutionItem; action: 'active' | 'suspended' } | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await superAdminApi.listInstitutions()
      setInstitutions(res.institutions)
    } catch {
      setError('Failed to load institutions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const submitStatusChange = async () => {
    if (!confirmModal) return
    setActing(true)
    setActionError(null)
    try {
      const updated = await superAdminApi.updateInstitutionStatus(confirmModal.inst.id, confirmModal.action)
      setInstitutions((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      setSuccessMsg(`"${updated.name}" is now ${updated.status}.`)
      setConfirmModal(null)
    } catch {
      setActionError('Could not update status. Please try again.')
    } finally {
      setActing(false)
    }
  }

  const stats = {
    total: institutions.length,
    active: institutions.filter((i) => i.status === 'active').length,
    suspended: institutions.filter((i) => i.status === 'suspended').length,
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1.5rem', color: '#00288e', letterSpacing: '-0.02em' }}>
          Institutions
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mt: 0.5, fontFamily: 'Jost' }}>
          All provisioned institutions on the platform.
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg(null)} sx={{ mb: 3, borderRadius: 0, fontFamily: 'Jost' }}>
          {successMsg}
        </Alert>
      )}

      {/* Stats */}
      {!loading && !error && (
        <Stack direction="row" gap={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total', value: stats.total, color: '#00288e' },
            { label: 'Active', value: stats.active, color: '#16a34a' },
            { label: 'Suspended', value: stats.suspended, color: '#dc2626' },
          ].map(({ label, value, color }) => (
            <Box key={label} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', px: 3, py: 2, flex: 1 }}>
              <Typography sx={{ fontFamily: 'Jost', fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label}
              </Typography>
              <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1.75rem', color, lineHeight: 1.2, mt: 0.5 }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      {/* Table */}
      <Box sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} sx={{ color: '#00288e' }} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2, borderRadius: 0 }}>{error}</Alert>
        ) : institutions.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontFamily: 'Jost', fontSize: '0.875rem' }}>
              No institutions yet.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={headCellSx}>Institution</TableCell>
                  <TableCell sx={headCellSx}>Type</TableCell>
                  <TableCell sx={headCellSx}>CBN Code</TableCell>
                  <TableCell sx={headCellSx}>Status</TableCell>
                  <TableCell sx={headCellSx}>Joined</TableCell>
                  <TableCell sx={headCellSx} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {institutions.map((inst) => (
                  <TableRow key={inst.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontWeight: 600, fontFamily: 'Jost', fontSize: '0.8125rem', color: '#0f172a' }}>
                        {inst.name}
                      </Typography>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: '#94a3b8' }}>
                        ID: {inst.id}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontFamily: 'Jost', fontSize: '0.8125rem', color: '#475569' }}>
                        {inst.type.replace('_', ' ')}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: inst.cbnCode ? '#1e293b' : '#cbd5e1' }}>
                        {inst.cbnCode || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Chip
                        label={inst.status}
                        size="small"
                        sx={{
                          borderRadius: 0.5, height: 22,
                          fontFamily: 'Jost', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
                          bgcolor: inst.status === 'active' ? '#f0fdf4' : '#fef2f2',
                          color: inst.status === 'active' ? '#16a34a' : '#dc2626',
                          border: `1px solid ${inst.status === 'active' ? '#bbf7d0' : '#fecaca'}`,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontFamily: 'Jost', fontSize: '0.8125rem', color: '#64748b' }}>
                        {new Date(inst.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      {inst.id !== 1 && (
                        <Button
                          size="small"
                          startIcon={
                            inst.status === 'active'
                              ? <BlockRoundedIcon sx={{ fontSize: '0.875rem !important' }} />
                              : <CheckCircleOutlineRoundedIcon sx={{ fontSize: '0.875rem !important' }} />
                          }
                          onClick={() => setConfirmModal({ inst, action: inst.status === 'active' ? 'suspended' : 'active' })}
                          sx={{
                            textTransform: 'none', fontFamily: 'Jost', fontSize: '0.75rem', borderRadius: 0, px: 1.5, py: 0.5,
                            color: inst.status === 'active' ? '#dc2626' : '#16a34a',
                            border: `1px solid ${inst.status === 'active' ? '#fecaca' : '#bbf7d0'}`,
                            '&:hover': { bgcolor: inst.status === 'active' ? '#fef2f2' : '#f0fdf4' },
                          }}
                        >
                          {inst.status === 'active' ? 'Suspend' : 'Activate'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmModal} onClose={() => !acting && setConfirmModal(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 0 } } }}>
        {confirmModal && (
          <>
            <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1rem', color: confirmModal.action === 'suspended' ? '#dc2626' : '#16a34a', pb: 0.5 }}>
              {confirmModal.action === 'suspended' ? 'Suspend Institution' : 'Activate Institution'}
            </DialogTitle>
            <DialogContent>
              <Typography sx={{ fontFamily: 'Jost', fontSize: '0.875rem', color: '#475569' }}>
                {confirmModal.action === 'suspended'
                  ? `"${confirmModal.inst.name}" will be suspended. Their dashboard access will be blocked immediately.`
                  : `"${confirmModal.inst.name}" will be reactivated. Their team will regain full access.`}
              </Typography>
              {actionError && (
                <Alert severity="error" sx={{ mt: 1.5, borderRadius: 0, fontFamily: 'Jost' }}>{actionError}</Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
              <Button
                onClick={() => setConfirmModal(null)}
                disabled={acting}
                sx={{ textTransform: 'none', fontFamily: 'Jost', color: '#64748b', borderRadius: 0 }}
              >
                Cancel
              </Button>
              <Button
                onClick={submitStatusChange}
                disabled={acting}
                sx={{
                  textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, borderRadius: 0, px: 2.5,
                  bgcolor: confirmModal.action === 'suspended' ? '#dc2626' : '#16a34a',
                  color: '#ffffff', boxShadow: 'none',
                  '&:hover': { bgcolor: confirmModal.action === 'suspended' ? '#b91c1c' : '#15803d', boxShadow: 'none' },
                  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
                }}
              >
                {acting ? 'Processing…' : confirmModal.action === 'suspended' ? 'Yes, Suspend' : 'Yes, Activate'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
