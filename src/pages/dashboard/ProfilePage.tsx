import { Box, Typography, TextField, Button, InputAdornment, IconButton, Tooltip } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useRef } from 'react'
import { useProfile } from '@/contexts/ProfileContext'
import { profileApi } from '@/api/profile'
import { resolveMediaUrl } from '@/api/client'
import { setLoginAvatar, setLoginName } from '@/onboarding/state'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined'

function getInitials(name?: string | null, email?: string | null) {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/)
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase()
  }
  return email?.[0]?.toUpperCase() ?? '?'
}

function passwordStrength(pw: string) {
  if (!pw) return { score: 0, label: '', color: '#e2e8f0', segs: [] as string[] }
  let s = 0
  if (pw.length >= 8)           s++
  if (pw.length >= 12)          s++
  if (/[A-Z]/.test(pw))         s++
  if (/[0-9]/.test(pw))         s++
  if (/[^A-Za-z0-9]/.test(pw))  s++
  const map = [
    { score: 1, label: 'Weak',        color: '#ef4444', segs: ['#ef4444','#e2e8f0','#e2e8f0','#e2e8f0','#e2e8f0'] },
    { score: 2, label: 'Fair',        color: '#f59e0b', segs: ['#f59e0b','#f59e0b','#e2e8f0','#e2e8f0','#e2e8f0'] },
    { score: 3, label: 'Good',        color: '#3b82f6', segs: ['#3b82f6','#3b82f6','#3b82f6','#e2e8f0','#e2e8f0'] },
    { score: 4, label: 'Strong',      color: '#10b981', segs: ['#10b981','#10b981','#10b981','#10b981','#e2e8f0'] },
    { score: 5, label: 'Very Strong', color: '#059669', segs: ['#059669','#059669','#059669','#059669','#059669'] },
  ]
  return map[Math.min(s, 5) - 1] ?? { score: 0, label: '', color: '#e2e8f0', segs: [] as string[] }
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  try { return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) } catch { return iso }
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator', cco: 'Chief Compliance Officer',
  analyst: 'Analyst', developer: 'Developer', auditor: 'Auditor',
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 0, fontSize: '0.875rem', fontFamily: 'Jost',
    '& fieldset': { borderColor: 'var(--border-col)' },
    '&:hover fieldset': { borderColor: '#cbd5e1' },
    '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
    '&.Mui-disabled': { bgcolor: 'var(--section-bg)' },
    '&.Mui-disabled fieldset': { borderColor: 'var(--border-col)' },
  },
  '& .MuiInputLabel-root': { fontFamily: 'Jost', fontSize: '0.875rem' },
  '& .MuiInputLabel-root.Mui-focused': { color: colorPalette.primary },
  '& .MuiInputBase-input.Mui-disabled': { color: '#94a3b8', WebkitTextFillColor: '#94a3b8' },
}

function Feedback({ ok, text }: { ok: boolean; text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, px: 2, py: 1.125, bgcolor: ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}` }}>
      {ok
        ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '0.9rem', color: '#16a34a', flexShrink: 0 }} />
        : <ErrorOutlineRoundedIcon sx={{ fontSize: '0.9rem', color: '#dc2626', flexShrink: 0 }} />}
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, color: ok ? '#166534' : '#991b1b', fontFamily: 'Jost' }}>
        {text}
      </Typography>
    </Box>
  )
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ color: '#94a3b8', display: 'flex' }}>{icon}</Box>
      <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'Jost' }}>
        <Box component="span" sx={{ fontWeight: 600, color: 'var(--on-surface-variant)' }}>{label}:</Box> {value}
      </Typography>
    </Box>
  )
}

export default function ProfilePage() {
  const { profile, refreshProfile, updateProfile } = useProfile()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Personal info ─────────────────────────────────────────────────────────
  const [fullName,   setFullName]   = useState(profile?.fullName  ?? '')
  const [jobTitle,   setJobTitle]   = useState(profile?.jobTitle  ?? '')
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoMsg,    setInfoMsg]    = useState<{ ok: boolean; text: string } | null>(null)

  if (profile && fullName === '' && profile.fullName) setFullName(profile.fullName)
  if (profile && jobTitle === '' && profile.jobTitle) setJobTitle(profile.jobTitle)

  const handleSaveInfo = async () => {
    setInfoSaving(true); setInfoMsg(null)
    try {
      await profileApi.update({ fullName: fullName.trim() || undefined, jobTitle: jobTitle.trim() || undefined })
      if (fullName.trim()) await setLoginName(fullName.trim())
      refreshProfile()
      setInfoMsg({ ok: true, text: 'Profile updated successfully.' })
    } catch {
      setInfoMsg({ ok: false, text: 'Update failed. Please try again.' })
    } finally { setInfoSaving(false) }
  }

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError,     setAvatarError]     = useState<string | null>(null)
  const [localAvatarUrl,  setLocalAvatarUrl]  = useState<string | null>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setAvatarError('Only image files are accepted.'); return }
    if (file.size > 5 * 1024 * 1024)    { setAvatarError('Image must be under 5 MB.'); return }
    setAvatarError(null)
    setAvatarUploading(true)
    const preview = URL.createObjectURL(file)
    setLocalAvatarUrl(preview)
    try {
      const result = await profileApi.uploadAvatar(file)
      updateProfile({ avatarUrl: result.avatarUrl })
      setLocalAvatarUrl(result.avatarUrl)
      // Keep login cache in sync so the biometric login page shows the new photo
      await setLoginAvatar(result.avatarUrl)
      try {
        const raw = localStorage.getItem('openiv.bioHint')
        if (raw) {
          const hint = JSON.parse(raw)
          localStorage.setItem('openiv.bioHint', JSON.stringify({ ...hint, avatarUrl: result.avatarUrl }))
        }
      } catch { /* ignore */ }
      refreshProfile()
    } catch (err) {
      setAvatarError((err as Error).message ?? 'Upload failed.')
      setLocalAvatarUrl(null)
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  // ── Password change ───────────────────────────────────────────────────────
  const [current,     setCurrent]     = useState('')
  const [next,        setNext]        = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext,    setShowNext]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwSaving,    setPwSaving]    = useState(false)
  const [pwMsg,       setPwMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  const strength   = passwordStrength(next)
  const pwMatch    = next.length > 0 && confirm.length > 0 && next === confirm
  const pwMismatch = confirm.length > 0 && next !== confirm

  const handleChangePassword = async () => {
    if (!current || !next || !pwMatch) return
    setPwSaving(true); setPwMsg(null)
    try {
      await profileApi.changePassword(current, next)
      setCurrent(''); setNext(''); setConfirm('')
      setPwMsg({ ok: true, text: 'Password updated successfully.' })
    } catch (e: unknown) {
      setPwMsg({ ok: false, text: (e as { detail?: string })?.detail ?? 'Failed to change password.' })
    } finally { setPwSaving(false) }
  }

  const displayAvatarUrl = localAvatarUrl ?? resolveMediaUrl(profile?.avatarUrl)
  const initials         = getInitials(profile?.fullName, profile?.email)
  const roleLabel        = ROLE_LABELS[profile?.role ?? ''] ?? (profile?.role ?? '—')

  return (
    <Box sx={{ bgcolor: 'var(--app-bg)', minHeight: '100%' }}>

      {/* ── Profile header card ───────────────────────────────────────────── */}
      <Box sx={{ bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
        {/* Accent stripe */}
        <Box sx={{ height: 4, bgcolor: colorPalette.primary }} />

        <Box sx={{ px: 4, py: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>

          {/* Avatar + upload button */}
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--border-col)', bgcolor: 'var(--section-bg)' }}>
              {displayAvatarUrl ? (
                <Box component="img" src={displayAvatarUrl} alt={profile?.fullName ?? ''} sx={{ width: '100%', height: '100%', objectFit: 'cover', opacity: avatarUploading ? 0.5 : 1, transition: 'opacity 0.2s' }} />
              ) : (
                <Box sx={{ width: '100%', height: '100%', bgcolor: colorPalette.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.375rem', fontWeight: 700, fontFamily: 'Jost', color: '#ffffff', letterSpacing: '-0.01em' }}>
                  {initials}
                </Box>
              )}
              {avatarUploading && (
                <Box sx={{ position: 'absolute', inset: 3, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
                </Box>
              )}
            </Box>
            <Tooltip title="Upload photo" placement="right">
              <Box
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 24, height: 24, borderRadius: '50%',
                  bgcolor: colorPalette.primary, border: '2px solid #ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'background 0.15s',
                  '&:hover': { bgcolor: '#1e3a8a' },
                }}
              >
                <CameraAltOutlinedIcon sx={{ fontSize: '0.75rem', color: '#fff' }} />
              </Box>
            </Tooltip>
          </Box>

          {/* Name / title / email */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--on-surface)', fontFamily: 'Jost', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
              {profile?.fullName ?? profile?.email ?? '—'}
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mt: 0.25 }}>
              {profile?.jobTitle ?? <Box component="span" sx={{ fontStyle: 'italic', color: '#94a3b8' }}>No job title set</Box>}
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', mt: 0.5 }}>
              {profile?.email}
            </Typography>
            {avatarError && (
              <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', mt: 0.5 }}>{avatarError}</Typography>
            )}
          </Box>

          {/* Badges + meta */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 1, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
              <Box sx={{ px: 1.5, py: 0.375, bgcolor: `${colorPalette.primary}0d`, border: `1px solid ${colorPalette.primary}25` }}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {roleLabel}
                </Typography>
              </Box>
              <Box sx={{ px: 1.5, py: 0.375, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--on-surface-variant)', fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {profile?.accountType ?? '—'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: { xs: 'flex-start', md: 'flex-end' } }}>
              <MetaItem icon={<CalendarTodayOutlinedIcon sx={{ fontSize: '0.75rem' }} />} label="Member since" value={fmtDate(profile?.createdAt)} />
              <MetaItem icon={<LockResetOutlinedIcon sx={{ fontSize: '0.75rem' }} />} label="Password last changed" value={profile?.passwordUpdatedAt ? fmtDate(profile.passwordUpdatedAt) : 'Never'} />
            </Box>
          </Box>
        </Box>

        {/* Status strip */}
        <Box sx={{ px: 4, py: 1.25, borderTop: '1px solid var(--border-col)', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {[
            { ok: true,               label: 'Email Verified' },
            { ok: !!profile?.passwordUpdatedAt, label: profile?.passwordUpdatedAt ? 'Password Set' : 'Default Password Active' },
            { ok: true,               label: 'Session Active' },
          ].map(s => (
            <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: s.ok ? '#10b981' : '#f59e0b', flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: s.ok ? '#065f46' : '#92400e', fontFamily: 'Jost' }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <Box sx={{ px: 4, py: 4 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, maxWidth: 1100 }}>

          {/* ── Personal Information ──────────────────────────────────── */}
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ width: 30, height: 30, bgcolor: `${colorPalette.primary}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colorPalette.primary, flexShrink: 0 }}>
                <PersonOutlineRoundedIcon sx={{ fontSize: '1rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--on-surface)', fontFamily: 'Jost' }}>Personal Information</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>Your display name and title shown across the platform</Typography>
              </Box>
            </Box>
            <Box sx={{ px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField label="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} fullWidth size="small"
                InputProps={{ startAdornment: <InputAdornment position="start"><BadgeOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} /></InputAdornment> }} sx={inputSx} />
              <TextField label="Job Title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} fullWidth size="small"
                placeholder="e.g. Head of Compliance"
                InputProps={{ startAdornment: <InputAdornment position="start"><WorkOutlineOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} /></InputAdornment> }} sx={inputSx} />
              <TextField label="Email Address" value={profile?.email ?? ''} disabled fullWidth size="small"
                InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} /></InputAdornment> }}
                helperText="Contact your administrator to change your email address"
                sx={{ ...inputSx, '& .MuiFormHelperText-root': { fontFamily: 'Jost', fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 } }} />

              {/* Role / Account read-only grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {[
                  { label: 'System Role',   value: roleLabel,                icon: <ShieldOutlinedIcon sx={{ fontSize: '0.875rem', color: '#94a3b8' }} /> },
                  { label: 'Account Type',  value: profile?.accountType ?? '—', icon: <VerifiedUserOutlinedIcon sx={{ fontSize: '0.875rem', color: '#94a3b8' }} /> },
                ].map(item => (
                  <Box key={item.label} sx={{ border: '1px solid var(--border-col)', p: 1.5, bgcolor: 'var(--section-bg)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.375 }}>
                      {item.icon}
                      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost' }}>{item.value}</Typography>
                  </Box>
                ))}
              </Box>

              {infoMsg && <Feedback ok={infoMsg.ok} text={infoMsg.text} />}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={handleSaveInfo} disabled={infoSaving}
                  sx={{ bgcolor: colorPalette.primary, color: '#fff', py: 1, px: 2.5, borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.8125rem', boxShadow: 'none', minWidth: 120,
                    '&:hover': { bgcolor: '#1e3a8a', boxShadow: 'none' }, '&:disabled': { bgcolor: '#94a3b8', color: '#fff' } }}>
                  {infoSaving ? 'Saving…' : 'Save Changes'}
                </Button>
              </Box>
            </Box>
          </Box>

          {/* ── Account Security ──────────────────────────────────────── */}
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ width: 30, height: 30, bgcolor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
                <SecurityOutlinedIcon sx={{ fontSize: '1rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--on-surface)', fontFamily: 'Jost' }}>Account Security</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>Update your password — CBN AML complexity requirements apply</Typography>
              </Box>
            </Box>
            <Box sx={{ px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

              {/* Last change info */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
                <LockResetOutlinedIcon sx={{ fontSize: '1rem', color: '#64748b', flexShrink: 0 }} />
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', fontFamily: 'Jost' }}>Last password change</Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                    {profile?.passwordUpdatedAt ? fmtDate(profile.passwordUpdatedAt) : 'Never changed — update recommended'}
                  </Typography>
                </Box>
              </Box>

              <TextField label="Current Password" type={showCurrent ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)} fullWidth size="small"
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" disableRipple onClick={() => setShowCurrent(v => !v)} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: 'var(--on-surface-variant)' } }}>{showCurrent ? <VisibilityOffOutlinedIcon sx={{ fontSize: '1rem' }} /> : <VisibilityOutlinedIcon sx={{ fontSize: '1rem' }} />}</IconButton></InputAdornment> }}
                sx={inputSx} />

              <Box>
                <TextField label="New Password" type={showNext ? 'text' : 'password'} value={next} onChange={e => setNext(e.target.value)} fullWidth size="small"
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" disableRipple onClick={() => setShowNext(v => !v)} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: 'var(--on-surface-variant)' } }}>{showNext ? <VisibilityOffOutlinedIcon sx={{ fontSize: '1rem' }} /> : <VisibilityOutlinedIcon sx={{ fontSize: '1rem' }} />}</IconButton></InputAdornment> }}
                  sx={inputSx} />
                {next && (
                  <Box sx={{ mt: 1 }}>
                    <Box sx={{ display: 'flex', gap: 0.375, mb: 0.5 }}>
                      {strength.segs.map((c, i) => <Box key={i} sx={{ flex: 1, height: 3, bgcolor: c, transition: 'background 0.2s' }} />)}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'Jost' }}>8+ chars · uppercase · number · symbol</Typography>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: strength.color, fontFamily: 'Jost' }}>{strength.label}</Typography>
                    </Box>
                  </Box>
                )}
              </Box>

              <TextField label="Confirm New Password" type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                error={pwMismatch} helperText={pwMismatch ? 'Passwords do not match' : pwMatch ? '✓ Passwords match' : ''} fullWidth size="small"
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" disableRipple onClick={() => setShowConfirm(v => !v)} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: 'var(--on-surface-variant)' } }}>{showConfirm ? <VisibilityOffOutlinedIcon sx={{ fontSize: '1rem' }} /> : <VisibilityOutlinedIcon sx={{ fontSize: '1rem' }} />}</IconButton></InputAdornment> }}
                sx={{ ...inputSx, '& .MuiFormHelperText-root': { fontFamily: 'Jost', fontSize: '0.6875rem', color: pwMismatch ? '#dc2626' : pwMatch ? '#16a34a' : undefined } }} />

              {/* Requirements */}
              {next && (
                <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 1.75 }}>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.875 }}>Requirements</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {[
                      { ok: next.length >= 8,           text: 'At least 8 characters' },
                      { ok: /[A-Z]/.test(next),         text: 'One uppercase letter'  },
                      { ok: /[0-9]/.test(next),         text: 'One number'            },
                      { ok: /[^A-Za-z0-9]/.test(next),  text: 'One special character' },
                    ].map(r => (
                      <Box key={r.text} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 13, height: 13, borderRadius: '50%', bgcolor: r.ok ? '#10b981' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {r.ok && <Box sx={{ width: 5, height: 5, bgcolor: '#fff', borderRadius: '50%' }} />}
                        </Box>
                        <Typography sx={{ fontSize: '0.6875rem', color: r.ok ? '#065f46' : '#94a3b8', fontFamily: 'Jost', fontWeight: r.ok ? 600 : 400 }}>{r.text}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {pwMsg && <Feedback ok={pwMsg.ok} text={pwMsg.text} />}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={handleChangePassword} disabled={!current || !next || !confirm || pwMismatch || pwSaving}
                  sx={{ bgcolor: 'var(--on-surface)', color: '#fff', py: 1, px: 2.5, borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.8125rem', boxShadow: 'none', minWidth: 140,
                    '&:hover': { bgcolor: 'var(--on-surface)', boxShadow: 'none' }, '&:disabled': { bgcolor: '#94a3b8', color: '#fff' } }}>
                  {pwSaving ? 'Updating…' : 'Update Password'}
                </Button>
              </Box>
            </Box>
          </Box>

        </Box>
      </Box>
    </Box>
  )
}
