import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert,
  TextField, InputAdornment, Chip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined'
import { waitlistApi } from '@/api/waitlist'
import type { WaitlistEntry } from '@/api/waitlist'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    waitlistApi.list()
      .then(res => setEntries(res.entries))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load waitlist'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = entries.filter(e => {
    const q = search.toLowerCase()
    return !q
      || e.name.toLowerCase().includes(q)
      || e.email.toLowerCase().includes(q)
      || (e.description ?? '').toLowerCase().includes(q)
  })

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <HowToRegOutlinedIcon sx={{ fontSize: '1.75rem', color: '#1A46B8' }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1A1B22', lineHeight: 1.2 }}>
            Waitlist
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Everyone who signed up from the landing page
          </Typography>
        </Box>
        <Chip
          label={loading ? '…' : `${entries.length} sign-up${entries.length !== 1 ? 's' : ''}`}
          sx={{ ml: 'auto', fontWeight: 700, bgcolor: '#EFF6FF', color: '#1A46B8', fontSize: '0.8rem' }}
        />
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name, email or interest…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', md: 360 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: '1rem', color: '#94A3B8' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['#', 'Name', 'Email', 'Interests / Use Case', 'Joined'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', py: 1.5 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6, color: '#94A3B8' }}>
                    {search ? 'No matches.' : 'No waitlist entries yet.'}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((entry, idx) => (
                <TableRow key={entry.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell sx={{ color: '#94A3B8', fontSize: '0.78rem', width: 40 }}>
                    {idx + 1}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#1A1B22' }}>
                    {entry.name}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.82rem', color: '#334155' }}>
                    {entry.email}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.82rem', color: '#334155', maxWidth: 340 }}>
                    {entry.description
                      ? <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.4 }}>{entry.description}</Typography>
                      : <Typography sx={{ color: '#CBD5E1', fontSize: '0.8rem' }}>—</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                    {formatDate(entry.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
