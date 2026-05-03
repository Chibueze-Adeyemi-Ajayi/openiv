import {
  Box, Typography, Stack, Button, Chip, IconButton,
  Skeleton, Dialog, Collapse, TextField,
} from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { beamApi, type BeamApiKey, type BeamRecord } from '@/api/beam'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import TouchAppOutlinedIcon from '@mui/icons-material/TouchAppOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SmartphoneOutlinedIcon from '@mui/icons-material/SmartphoneOutlined'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import { useSandbox } from '@/contexts/SandboxContext'

// ── Syntax highlighting ───────────────────────────────────────────────────────

type Token = { text: string; color: string; italic?: boolean }

const C = {
  keyword: '#c792ea',
  string: '#c3e88d',
  number: '#f78c6c',
  comment: '#546e7a',
  func: '#82aaff',
  env: '#ffcb6b',
  url: '#80cbc4',
  punct: '#89ddff',
  plain: '#e2e8f0',
  operator: '#89ddff',
}

const KW_RE = new RegExp(
  `^(?:${[
    'curl', 'const', 'let', 'var', 'import', 'from', 'require', 'async', 'await',
    'function', 'return', 'if', 'else', 'try', 'catch', 'throw', 'new', 'class',
    'export', 'default', 'def', 'for', 'in', 'with', 'pass', 'raise', 'as', 'elif',
    'True', 'False', 'None', 'func', 'package', 'type', 'struct', 'interface',
    'public', 'private', 'protected', 'static', 'void', 'final', 'this',
    'print', 'println', 'true', 'false', 'null', 'undefined', 'nil',
    'bytes', 'json', 'http', 'time', 'net', 'os', 'fmt', 'uuid',
    'POST', 'GET', 'PUT', 'DELETE', 'PATCH', 'HEAD',
  ].join('|')})(?=[^a-zA-Z_0-9]|$)`,
)

const PATTERNS: Array<{ re: RegExp; color: string; italic?: boolean }> = [
  { re: /^#[^\n]*/, color: C.comment, italic: true },
  { re: /^\/\/[^\n]*/, color: C.comment, italic: true },
  { re: /^"(?:[^"\\]|\\.)*"/, color: C.string },
  { re: /^'(?:[^'\\]|\\.)*'/, color: C.string },
  { re: /^`(?:[^`\\]|\\.)*`/, color: C.string },
  { re: /^\$\{[^}]+\}/, color: C.env },
  { re: /^\$[A-Z_][A-Z_0-9]*/, color: C.env },
  { re: /^https?:\/\/[^\s'"\\),`]+/, color: C.url },
  { re: KW_RE, color: C.keyword },
  { re: /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, color: C.number },
  { re: /^[{}[\]();,]/, color: C.punct },
  { re: /^[:=<>+\-*/|&^~%!]/, color: C.operator },
  { re: /^[\\]/, color: C.punct },
  { re: /^[a-zA-Z_][a-zA-Z_0-9]*(?=\()/, color: C.func },
]

function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  let remaining = code
  while (remaining.length > 0) {
    let matched = false
    for (const { re, color, italic } of PATTERNS) {
      const m = re.exec(remaining)
      if (m) {
        tokens.push({ text: m[0], color, italic })
        remaining = remaining.slice(m[0].length)
        matched = true
        break
      }
    }
    if (!matched) {
      const last = tokens[tokens.length - 1]
      if (last && last.color === C.plain && !last.italic) last.text += remaining[0]
      else tokens.push({ text: remaining[0], color: C.plain })
      remaining = remaining.slice(1)
    }
  }
  return tokens
}

function SyntaxCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const tokens = useMemo(() => tokenize(code), [code])

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{
        bgcolor: '#0d1117', p: 2.5, overflowX: 'auto',
        fontFamily: 'SF Mono, Monaco, Consolas, monospace',
        fontSize: '0.75rem', lineHeight: 1.75,
        maxHeight: 380, overflowY: 'auto',
      }}>
        {tokens.map((t, i) => (
          <Box key={i} component="span" sx={{ color: t.color, fontStyle: t.italic ? 'italic' : 'normal', whiteSpace: 'pre' }}>
            {t.text}
          </Box>
        ))}
      </Box>
      <Button
        size="small"
        startIcon={
          copied
            ? <CheckRoundedIcon sx={{ fontSize: '0.75rem !important', color: '#10b981' }} />
            : <ContentCopyOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />
        }
        onClick={copy}
        sx={{
          position: 'absolute', top: 8, right: 8,
          fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600,
          color: copied ? '#10b981' : '#64748b', textTransform: 'none',
          px: 1, py: 0.375, borderRadius: 0, bgcolor: '#0d1117',
          '&:hover': { bgcolor: '#1e293b' },
          '& .MuiButton-startIcon': { mr: 0.375 },
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </Box>
  )
}

// ── Stream data ────────────────────────────────────────────────────────────────

type StreamId = 'transactions' | 'logins' | 'activity' | 'location' | 'devices' | 'otps'

interface StreamField { field: string; type: string; required: boolean; example: string }
interface Stream {
  id: StreamId; icon: React.ReactNode; title: string; desc: string
  status: 'connected' | 'partial' | 'disconnected'
  recordsToday: number; lastSeen: string; why: string; powers: string
  schema: StreamField[]
}

const streams: Stream[] = [
  {
    id: 'transactions', icon: <ReceiptLongOutlinedIcon />, title: 'Transactions',
    desc: 'Every credit, debit, transfer & FX flow as it lands on your core',
    status: 'connected', recordsToday: 84219, lastSeen: '2 sec ago',
    why: "The foundational stream. Without transactions, no risk score is possible. Beam the moment your core posts — even before settlement — so we can intercept.",
    powers: 'Risk scoring · STR/SAR · Velocity rules',
    schema: [
      { field: 'customer_id', type: 'string', required: true, example: 'CUS-001' },
      { field: 'customer_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'amount', type: 'number', required: true, example: '14250000' },
      { field: 'channel', type: 'string', required: true, example: 'Wire | Transfer | Mobile | ATM | POS' },
      { field: 'counterparty', type: 'string', required: true, example: 'Sokoto BDC Ltd' },
      { field: 'status', type: 'string', required: true, example: 'pending' },
      { field: 'location', type: 'string', required: true, example: 'Sokoto' },
      { field: 'lat', type: 'number', required: true, example: '13.0059' },
      { field: 'lng', type: 'number', required: true, example: '5.2476' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T17:56:29Z' },
      { field: 'sender_account', type: 'string', required: true, example: '0124567890' },
      { field: 'sender_bank', type: 'string', required: true, example: 'Access Bank' },
      { field: 'recipient_name', type: 'string', required: true, example: 'Sokoto BDC Ltd' },
      { field: 'recipient_account', type: 'string', required: true, example: '0034567891' },
      { field: 'recipient_bank', type: 'string', required: true, example: 'GTBank' },
      { field: 'currency', type: 'string', required: true, example: 'NGN' },
      { field: 'narration', type: 'string', required: true, example: 'FX Settlement — USD Purchase' },
      { field: 'device_id', type: 'string', required: true, example: 'dev_a1b2c3' },
      { field: 'ip_address', type: 'string', required: true, example: '102.89.45.67' },
    ],
  },
  {
    id: 'logins', icon: <LoginRoundedIcon />, title: 'User Logins',
    desc: 'Every authentication attempt — success, failure, or 2FA',
    status: 'connected', recordsToday: 41203, lastSeen: '4 sec ago',
    why: 'Login patterns reveal account-takeover precursors. We correlate failed attempts, IP anomalies and device fingerprints to score risk before money moves.',
    powers: 'Account-takeover · MFA bypass detection',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'user_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'activity_name', type: 'string', required: true, example: 'user login' },
      { field: 'note', type: 'string', required: true, example: 'User successfully logged into mobile app' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T14:21:11Z' },
      { field: 'outcome', type: 'enum', required: true, example: 'success | failed | 2fa_required' },
      { field: 'location', type: 'string', required: true, example: 'Lagos, NG' },
      { field: 'lat', type: 'number', required: true, example: '6.4541' },
      { field: 'lng', type: 'number', required: true, example: '3.3947' },
      { field: 'ip_address', type: 'string', required: true, example: '102.89.32.18' },
      { field: 'user_agent', type: 'string', required: true, example: 'iOS 17.4 / Chrome 124' },
      { field: 'device_id', type: 'string', required: false, example: 'DVC-8b32a1' },
    ],
  },
  {
    id: 'activity', icon: <TouchAppOutlinedIcon />, title: 'In-app Activity',
    desc: 'User actions inside your mobile / web app — sessions, taps, screen views',
    status: 'partial', recordsToday: 218450, lastSeen: '12 sec ago',
    why: 'Behavioral fingerprints — typing cadence, navigation flow, time-on-screen — let us spot when a session no longer "feels" like the legitimate user.',
    powers: 'Behavioral fingerprints · Session anomalies',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'user_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'activity_name', type: 'string', required: true, example: 'in-app activity' },
      { field: 'note', type: 'string', required: true, example: 'User viewed transfer confirmation screen' },
      { field: 'session_id', type: 'string', required: true, example: 'SES-3491f' },
      { field: 'event_name', type: 'string', required: true, example: 'beneficiary_added' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T14:22:00Z' },
      { field: 'location', type: 'string', required: true, example: 'Abuja, NG' },
      { field: 'lat', type: 'number', required: true, example: '9.0765' },
      { field: 'lng', type: 'number', required: true, example: '7.3986' },
      { field: 'ip_address', type: 'string', required: true, example: '105.112.34.12' },
      { field: 'screen', type: 'string', required: false, example: 'transfer/confirm' },
      { field: 'metadata', type: 'object', required: false, example: '{ "amount": 14250000 }' },
    ],
  },
  {
    id: 'location', icon: <LocationOnOutlinedIcon />, title: 'User Location',
    desc: 'GPS/IP-derived location signals on every interaction',
    status: 'connected', recordsToday: 41203, lastSeen: '8 sec ago',
    why: "Location is the strongest signal for SIM-swap and account-takeover. We compare every transaction against the customer's recent location footprint.",
    powers: 'OTP holds · Geo-impossibility · SIM-swap',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'user_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'activity_name', type: 'string', required: true, example: 'user location update' },
      { field: 'note', type: 'string', required: true, example: 'Location ping derived from GPS' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T14:22:00Z' },
      { field: 'location', type: 'string', required: true, example: 'Ikeja, Lagos' },
      { field: 'lat', type: 'number', required: true, example: '6.5244' },
      { field: 'lng', type: 'number', required: true, example: '3.3792' },
      { field: 'ip_address', type: 'string', required: true, example: '102.89.32.18' },
      { field: 'accuracy_m', type: 'number', required: false, example: '12' },
      { field: 'source', type: 'enum', required: true, example: 'gps | wifi | ip | cell' },
    ],
  },
  {
    id: 'devices', icon: <SmartphoneOutlinedIcon />, title: 'Device Fingerprints',
    desc: 'Hardware, OS, and behavioral fingerprints per session',
    status: 'partial', recordsToday: 12840, lastSeen: '1 min ago',
    why: 'New device detection is a top SIM-swap signal. We track which devices each user has historically used and trigger when an unfamiliar one initiates a high-value action.',
    powers: 'Device-of-record · New-device alerts',
    schema: [
      { field: 'device_id', type: 'string', required: true, example: 'DVC-8b32a1' },
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'user_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'activity_name', type: 'string', required: true, example: 'device registration' },
      { field: 'note', type: 'string', required: true, example: 'New device hardware footprint established' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T08:30:00Z' },
      { field: 'location', type: 'string', required: true, example: 'Port Harcourt, NG' },
      { field: 'lat', type: 'number', required: true, example: '4.8156' },
      { field: 'lng', type: 'number', required: true, example: '7.0498' },
      { field: 'ip_address', type: 'string', required: true, example: '197.210.64.12' },
      { field: 'os', type: 'string', required: true, example: 'iOS 17.4' },
      { field: 'model', type: 'string', required: false, example: 'iPhone 14 Pro' },
      { field: 'rooted_or_jailbroken', type: 'boolean', required: false, example: 'false' },
    ],
  },
  {
    id: 'otps', icon: <KeyOutlinedIcon />, title: 'OTP Events',
    desc: 'Every OTP request, send, retry, and successful verification',
    status: 'disconnected', recordsToday: 0, lastSeen: 'Never',
    why: 'OTP retry patterns are how we catch SIM-swappers in real time. Without this stream, we cannot hold suspicious transactions for verification.',
    powers: 'Real-time OTP defense · Hold-and-call',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'user_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'activity_name', type: 'string', required: true, example: 'otp verification' },
      { field: 'note', type: 'string', required: true, example: 'User completed OTP challenge for transfer' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T14:22:00Z' },
      { field: 'event_type', type: 'enum', required: true, example: 'requested | sent | verified | retry | failed' },
      { field: 'location', type: 'string', required: true, example: 'Enugu, NG' },
      { field: 'lat', type: 'number', required: true, example: '6.4413' },
      { field: 'lng', type: 'number', required: true, example: '7.4988' },
      { field: 'ip_address', type: 'string', required: true, example: '102.89.32.18' },
      { field: 'phone_msisdn', type: 'string', required: true, example: '+2348031234567' },
      { field: 'transaction_id', type: 'string', required: false, example: 'TXN-48721' },
      { field: 'attempt_count', type: 'number', required: false, example: '4' },
      { field: 'amount', type: 'number', required: false, example: '150000' },
      { field: 'beneficiary_account', type: 'string', required: false, example: '0123456789' },
    ],
  },
]

const statusConfig: Record<Stream['status'], { color: string; bg: string; label: string }> = {
  connected: { color: '#10b981', bg: '#f0fdf4', label: 'Connected' },
  partial: { color: '#f59e0b', bg: '#fffbeb', label: 'Partial' },
  disconnected: { color: '#dc2626', bg: '#fef2f2', label: 'Not connected' },
}

// ── Code samples ──────────────────────────────────────────────────────────────

type Lang = 'cURL' | 'Node.js' | 'Python' | 'Go'

function buildCurl(s: Stream) {
  const fields = s.schema.filter(f => f.required)
    .map(f => `    "${f.field}": ${f.type === 'number' || f.type === 'boolean' ? f.example : `"${f.example}"`}`)
    .join(',\n')
  return `curl -X POST https://api.openiv.io/api/v1/beam/${s.id} \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "X-Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
${fields}
  }'`
}

function buildNode(s: Stream) {
  const fields = s.schema.filter(f => f.required)
    .map(f => `    ${f.field}: ${f.type === 'number' || f.type === 'boolean' ? f.example : `'${f.example}'`},`)
    .join('\n')
  const fn = s.title.replace(/\s+/g, '')
  return `const axios = require('axios')
const { v4: uuid } = require('uuid')

const client = axios.create({
  baseURL: 'https://api.openiv.io/api/v1/beam',
  headers: { 'Authorization': \`Bearer \${process.env.OPENIV_BEAM_KEY}\` },
})

async function beam${fn}(data) {
  const response = await client.post('/${s.id}', {
${fields}
  }, { headers: { 'X-Idempotency-Key': uuid() } })
  return response.data  // { ok: true, recordId: ... }
}`
}

function buildPython(s: Stream) {
  const fields = s.schema.filter(f => f.required)
    .map(f => `        '${f.field}': ${f.type === 'number' ? f.example : f.type === 'boolean' ? f.example.charAt(0).toUpperCase() + f.example.slice(1) : `'${f.example}'`},`)
    .join('\n')
  return `import httpx, uuid, os

client = httpx.Client(
    base_url='https://api.openiv.io/api/v1/beam',
    headers={'Authorization': f'Bearer {os.environ["OPENIV_BEAM_KEY"]}'},
)

def beam_${s.id}(data: dict) -> dict:
    response = client.post('/${s.id}',
        json={
${fields}
        },
        headers={'X-Idempotency-Key': str(uuid.uuid4())},
    )
    response.raise_for_status()
    return response.json()  # {'ok': True, 'recordId': ...}`
}

function buildGo(s: Stream) {
  const fn = s.title.split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join('')
  const fields = s.schema.filter(f => f.required)
    .map(f => `        "${f.field}": ${f.type === 'number' ? f.example : `"${f.example}"`},`)
    .join('\n')
  return `package beam

import (
    "bytes"; "encoding/json"; "fmt"
    "net/http"; "os"
    "github.com/google/uuid"
)

func Beam${fn}(data map[string]any) error {
    payload, _ := json.Marshal(map[string]any{
${fields}
    })
    req, _ := http.NewRequest("POST",
        "https://api.openiv.io/api/v1/beam/${s.id}",
        bytes.NewReader(payload))
    req.Header.Set("Authorization", "Bearer "+os.Getenv("OPENIV_BEAM_KEY"))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-Idempotency-Key", uuid.New().String())
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return fmt.Errorf("beam: %w", err) }
    defer resp.Body.Close()
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("rejected: HTTP %d", resp.StatusCode)
    }
    return nil
}`
}

// ── Beam log helpers ──────────────────────────────────────────────────────────

const STREAM_LABELS: Record<string, string> = {
  transactions: 'Transactions', logins: 'User Logins', activity: 'In-app Activity',
  location: 'User Location', devices: 'Device FP', otps: 'OTP Events',
}
const STREAM_COLORS: Record<string, { bg: string; color: string }> = {
  transactions: { bg: '#eff6ff', color: '#2563eb' },
  logins: { bg: '#f0fdf4', color: '#16a34a' },
  activity: { bg: '#fdf4ff', color: '#9333ea' },
  location: { bg: '#fff7ed', color: '#ea580c' },
  devices: { bg: '#f8fafc', color: '#475569' },
  otps: { bg: '#fef2f2', color: '#dc2626' },
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  const go = () => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600) }
  return (
    <Button size="small" onClick={go}
      startIcon={done
        ? <CheckRoundedIcon sx={{ fontSize: '0.75rem !important', color: '#10b981' }} />
        : <ContentCopyOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
      sx={{ fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600, color: done ? '#10b981' : '#64748b', textTransform: 'none', px: 1, py: 0.375, borderRadius: 0, '&:hover': { bgcolor: '#f8fafc' }, '& .MuiButton-startIcon': { mr: 0.375 } }}>
      {done ? 'Copied' : 'Copy'}
    </Button>
  )
}

function RecordRow({ record }: { record: BeamRecord }) {
  const [expanded, setExpanded] = useState(false)
  const pretty = useMemo(() => prettyJson(record.payload), [record.payload])
  const cfg = STREAM_COLORS[record.stream] ?? { bg: '#f8fafc', color: '#475569' }

  let preview = ''
  try {
    const obj = JSON.parse(record.payload)
    const keys = Object.keys(obj).slice(0, 3)
    preview = keys.map(k => `"${k}": ${JSON.stringify(obj[k])}`).join(', ')
    if (Object.keys(obj).length > 3) preview += ', …'
  } catch { preview = record.payload.slice(0, 80) }

  return (
    <Box sx={{ borderBottom: '1px solid #f4f5f7', '&:last-child': { borderBottom: 'none' } }}>
      <Box
        onClick={() => setExpanded(p => !p)}
        data-ai-analyzable="true"
        data-ai-description={`Live Beam Record: ${record.stream.toUpperCase()}. received: ${fmtRelative(record.receivedAt)}. payload: ${preview}`}
        sx={{ px: 3, py: 1.5, display: 'grid', gridTemplateColumns: '110px 1fr 80px 80px 28px', gap: 1.5, alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' }, transition: 'background 0.15s' }}
      >
        <Box sx={{ display: 'inline-flex', px: 1, py: 0.375, bgcolor: cfg.bg }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: cfg.color }}>
            {(STREAM_LABELS[record.stream] ?? record.stream).toUpperCase()}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {'{ ' + preview + ' }'}
        </Typography>
        <Box sx={{ display: 'inline-flex', px: 1, py: 0.375, bgcolor: '#f0fdf4' }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: '#10b981' }}>RECEIVED</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>{fmtRelative(record.receivedAt)}</Typography>
        <Box sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
          {expanded ? <ExpandLessRoundedIcon sx={{ fontSize: '1rem' }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: '1rem' }} />}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #eef0f4', p: 2.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            {[
              ['Record ID', String(record.id)],
              ['Stream', record.stream],
              ['Status', record.status],
              ['Idempotency key', record.idempotencyKey ?? '—'],
              ['Received at', new Date(record.receivedAt).toLocaleString()],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', mb: 0.25 }}>{label}</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#0f172a' }}>{value}</Typography>
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', mb: 0.75 }}>PAYLOAD</Typography>
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ bgcolor: '#0d1117', color: '#e2e8f0', p: 2, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', lineHeight: 1.7, whiteSpace: 'pre', overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
              {pretty}
            </Box>
            <Box sx={{ position: 'absolute', top: 6, right: 6 }}><CopyText text={pretty} /></Box>
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}

// ── API key modal ─────────────────────────────────────────────────────────────

interface ApiKeyModalProps { 
  open: boolean; 
  onClose: () => void;
  keyInfo: BeamApiKey | null;
  onKeyUpdated: () => void;
}

function ApiKeyModal({ open, onClose, keyInfo, onKeyUpdated }: ApiKeyModalProps) {
  const [loading, setLoading] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [keyCopied, setKeyCopied] = useState(false)

  const [genTotpOpen, setGenTotpOpen] = useState(false)
  const [revokeTotpOpen, setRevokeTotpOpen] = useState(false)

  useEffect(() => { if (open) { setNewKey(null) } }, [open])

  const handleGenerate = async () => {
    try {
      const res = await beamApi.generateApiKey()
      setNewKey(res.apiKey)
      onKeyUpdated()
    } finally { setGenTotpOpen(false) }
  }

  const handleRevoke = async () => {
    try { await beamApi.revokeApiKey(); setNewKey(null); onKeyUpdated() }
    finally { setRevokeTotpOpen(false) }
  }

  const copyKey = () => {
    if (!newKey) return
    navigator.clipboard.writeText(newKey)
    setKeyCopied(true)
    setTimeout(() => setKeyCopied(false), 2000)
  }

  const anyTotpOpen = genTotpOpen || revokeTotpOpen

  return (
    <>
      {/* disableEnforceFocus lets the TOTP overlay steal focus from this Dialog */}
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableEnforceFocus={anyTotpOpen}
        PaperProps={{ sx: { borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <VpnKeyOutlinedIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
            <Box>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Beam API Key</Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.125 }}>Authenticate your server when beaming data to OpenIV</Typography>
            </Box>
          </Box>
          <IconButton disableRipple size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#475569' } }}>
            <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
          </IconButton>
        </Box>

        <Box sx={{ px: 3, py: 3 }}>
          {loading ? (
            <Stack gap={2}><Skeleton height={60} /><Skeleton height={40} /></Stack>
          ) : (
            <Stack gap={2.5}>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost' }}>Current key</Typography>
                  <Box sx={{ px: 1, py: 0.375, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', bgcolor: keyInfo ? '#f0fdf4' : '#f8fafc', color: keyInfo ? '#10b981' : '#94a3b8' }}>
                    {keyInfo ? 'ACTIVE' : 'NOT SET'}
                  </Box>
                </Box>
                {keyInfo ? (
                  <>
                    <Typography sx={{ fontSize: '0.875rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#0f172a', mb: 0.5 }}>
                      {keyInfo.prefix}••••••••••••••••••
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                      Created {new Date(keyInfo.createdAt).toLocaleDateString()}{keyInfo.lastUsedAt ? ` · Last used ${new Date(keyInfo.lastUsedAt).toLocaleDateString()}` : ' · Never used'}
                    </Typography>
                  </>
                ) : (
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontStyle: 'italic' }}>
                    No API key set. You can still use the "Beam Test" tool below via your dashboard session, or generate a key to integrate your server.
                  </Typography>
                )}
              </Box>

              {newKey && (
                <Box sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#10b981', mb: 1, letterSpacing: '0.08em' }}>
                    YOUR KEY — COPY NOW, SHOWN ONLY ONCE
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ flex: 1, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: '#0f172a', wordBreak: 'break-all' }}>{newKey}</Typography>
                    <Button
                      onClick={copyKey}
                      startIcon={keyCopied
                        ? <CheckRoundedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />
                        : <ContentCopyOutlinedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />}
                      sx={{ flexShrink: 0, bgcolor: keyCopied ? '#10b981' : colorPalette.primary, color: '#ffffff', px: 1.5, py: 0.75, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '& .MuiButton-startIcon': { color: '#ffffff', mr: 0.5 }, '&:hover': { bgcolor: keyCopied ? '#10b981' : '#1a3896' } }}>
                      <Box component="span" sx={{ color: '#ffffff' }}>{keyCopied ? 'Copied' : 'Copy'}</Box>
                    </Button>
                  </Box>
                </Box>
              )}

              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                Pass this key in the <Box component="span" sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.7rem', color: colorPalette.primary }}>Authorization: Bearer</Box> header of every beam request. Store it in your secrets manager — OpenIV never shows it again.
              </Typography>

              <Box sx={{ display: 'flex', gap: 1 }}>
                {newKey ? (
                  /* Just generated — copy it, then close */
                  <Button
                    onClick={onClose}
                    startIcon={<CheckRoundedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />}
                    sx={{ flex: 1, bgcolor: '#10b981', color: '#ffffff', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '& .MuiButton-startIcon': { color: '#ffffff' }, '&:hover': { bgcolor: '#059669' } }}
                  >
                    <Box component="span" sx={{ color: '#ffffff' }}>Done</Box>
                  </Button>
                ) : keyInfo ? (
                  /* Pre-existing key — offer management actions */
                  <>
                    <Button
                      onClick={() => setGenTotpOpen(true)}
                      startIcon={<VpnKeyOutlinedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />}
                      sx={{ flex: 1, bgcolor: colorPalette.primary, color: '#ffffff', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '& .MuiButton-startIcon': { color: '#ffffff' }, '&:hover': { bgcolor: '#1a3896' } }}
                    >
                      <Box component="span" sx={{ color: '#ffffff' }}>Regenerate key</Box>
                    </Button>
                    <Button
                      onClick={() => setRevokeTotpOpen(true)}
                      startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
                      sx={{ border: '1px solid #fecaca', color: '#dc2626', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#fef2f2' } }}
                    >
                      Revoke
                    </Button>
                  </>
                ) : (
                  /* No key yet — generate first time */
                  <Button
                    onClick={() => setGenTotpOpen(true)}
                    startIcon={<VpnKeyOutlinedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />}
                    sx={{ flex: 1, bgcolor: colorPalette.primary, color: '#ffffff', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '& .MuiButton-startIcon': { color: '#ffffff' }, '&:hover': { bgcolor: '#1a3896' } }}
                  >
                    <Box component="span" sx={{ color: '#ffffff' }}>Generate key</Box>
                  </Button>
                )}
              </Box>
            </Stack>
          )}
        </Box>
      </Dialog>

      <TOTPConfirmation
        open={genTotpOpen}
        onClose={() => setGenTotpOpen(false)}
        onConfirm={handleGenerate}
        operation={keyInfo ? 'update' : 'create'}
        title={keyInfo ? 'Regenerate beam API key' : 'Generate beam API key'}
        description={keyInfo ? 'Regenerating immediately invalidates the existing key. Update your servers before deploying.' : 'Generating an API key allows your server to authenticate when beaming data to OpenIV.'}
        resourceType="Beam API key"
        resourceName="Institution beam API key"
        changes={keyInfo ? [{ field: 'API Key', from: 'Current key', to: 'New generated key' }] : undefined}
      />
      <TOTPConfirmation
        open={revokeTotpOpen}
        onClose={() => setRevokeTotpOpen(false)}
        onConfirm={handleRevoke}
        operation="delete"
        title="Revoke beam API key"
        description="Revoking the key immediately stops all beam ingestion. Beams will be rejected with 401 until a new key is generated."
        resourceType="Beam API key"
        resourceName="Institution beam API key"
      />
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DataBeamingPage() {
  const [keyInfo, setKeyInfo] = useState<BeamApiKey | null>(null)
  const [loadingKey, setLoadingKey] = useState(true)

  const loadKey = useCallback(async () => {
    try {
      const res = await beamApi.getApiKeyInfo()
      setKeyInfo(res.key)
    } finally {
      setLoadingKey(false)
    }
  }, [])

  useEffect(() => { loadKey() }, [loadKey])

  const [activeStream, setActiveStream] = useState<StreamId>('transactions')
  const [activeLang, setActiveLang] = useState<Lang>('cURL')
  const [apiKeyOpen, setApiKeyOpen] = useState(false)
  const { sandboxEnabled, setSandboxEnabled } = useSandbox()
  const [sendingTest, setSendingTest] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)
  const [editablePayload, setEditablePayload] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Initialize payload when stream changes
  useEffect(() => {
    const streamObj = streams.find(s => s.id === activeStream)!
    const payload: any = {}
    streamObj.schema.forEach(f => {
      payload[f.field] = f.type === 'number' ? Number(f.example) : f.example === 'true' ? true : f.example === 'false' ? false : f.example
    })
    setEditablePayload(JSON.stringify(payload, null, 2))
    setJsonError(null)
  }, [activeStream])

  const handleSendTest = async () => {
    if (!sandboxEnabled) {
      setSandboxEnabled(true)
      return
    }

    if (!keyInfo) {
      setApiKeyOpen(true)
      return
    }

    try {
      const parsed = JSON.parse(editablePayload)
      setJsonError(null)

      setSendingTest(true)
      await beamApi.sendTestPayload(activeStream, parsed)
      setTestSuccess(true)
      setTimeout(() => setTestSuccess(false), 3000)
      loadRecords() // refresh list
    } catch (err) {
      if (err instanceof SyntaxError) {
        setJsonError('Invalid JSON format')
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setJsonError(`Test beam failed: ${msg}`)
        console.error('Test beam failed', err)
      }
    } finally {
      setSendingTest(false)
    }
  }

  // ── Live beam records ─────────────────────────────────────────────────────
  const [allRecords, setAllRecords] = useState<import('@/api/beam').BeamRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(true)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadRecords = useCallback(async () => {
    try {
      const res = await beamApi.listRecords()
      setAllRecords(res.records)
    } catch {
      // silent — keep showing whatever we had before
    } finally {
      setRecordsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRecords()
    refreshTimerRef.current = setInterval(loadRecords, 30_000)
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [loadRecords])

  // ── Derived per-stream stats from real data ───────────────────────────────
  const liveStreamStats = useMemo(() => {
    const map: Record<string, { count: number; lastSeen: string | null }> = {}
    const streamIds: StreamId[] = ['transactions', 'logins', 'activity', 'location', 'devices', 'otps']
    streamIds.forEach(id => { map[id] = { count: 0, lastSeen: null } })
    allRecords.forEach(r => {
      if (map[r.stream]) {
        map[r.stream].count++
        if (!map[r.stream].lastSeen || r.receivedAt > map[r.stream].lastSeen!) {
          map[r.stream].lastSeen = r.receivedAt
        }
      }
    })
    return map
  }, [allRecords])

  const activeStreamRecords = useMemo(
    () => allRecords.filter(r => r.stream === activeStream).slice(0, 8),
    [allRecords, activeStream],
  )

  const stream = streams.find(s => s.id === activeStream)!
  const langs: Lang[] = ['cURL', 'Node.js', 'Python', 'Go']
  const codeByLang: Record<Lang, string> = {
    'cURL': buildCurl(stream),
    'Node.js': buildNode(stream),
    'Python': buildPython(stream),
    'Go': buildGo(stream),
  }

  const connected = streams.filter(s => (liveStreamStats[s.id]?.count ?? 0) > 0).length
  const totalRecords = allRecords.length

  const healthMetrics = useMemo(() => {
    const durations = allRecords.map(r => r.durationMs).filter((d): d is number => d != null && d > 0).sort((a, b) => a - b)
    const medianLatency = durations.length > 0
      ? `${durations[Math.floor(durations.length / 2)]}ms`
      : '—'

    const rejected = allRecords.filter(r => r.status === 'rejected' || r.status === 'error').length
    const validity = totalRecords > 0
      ? `${((1 - rejected / totalRecords) * 100).toFixed(2)}%`
      : '—'

    return { medianLatency, validity, rejected }
  }, [allRecords, totalRecords])

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>Configure</Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>Beam to OpenIV</Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', maxWidth: 720 }}>
              Stream the six signals that power real-time fraud defense.
            </Typography>
          </Box>
          <Stack direction="row" gap={1.25} sx={{ mt: 0.75, flexShrink: 0 }}>
            <Button
              startIcon={<VpnKeyOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              onClick={() => setApiKeyOpen(true)}
              sx={{ border: '1px solid #eef0f4', bgcolor: '#ffffff', color: '#475569', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' } }}>
              API Key
            </Button>
          </Stack>
        </Box>

        {/* Health KPIs */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Streams connected', value: recordsLoading ? '…' : `${connected}/${streams.length}`, sub: recordsLoading ? 'Loading…' : connected === streams.length ? 'Full coverage' : `${streams.length - connected} pending` },
            { label: 'Records received', value: recordsLoading ? '…' : totalRecords.toLocaleString(), sub: 'last 100 across all streams' },
            { label: 'Median latency', value: recordsLoading ? '…' : healthMetrics.medianLatency, sub: 'from your core to OpenIV' },
            { label: 'Schema validity', value: recordsLoading ? '…' : healthMetrics.validity, sub: healthMetrics.rejected > 0 ? `${healthMetrics.rejected} rejected total` : 'No rejections' },
          ].map(s => (
            <Box
              key={s.label}
              data-ai-analyzable="true"
              data-ai-description={`Ingestion KPI: ${s.label}. current value: ${s.value}. status: ${s.sub}.`}
              sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.25 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.625 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.1, mb: 0.5 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{s.sub}</Typography>
            </Box>
          ))}
        </Box>

        {/* Stream picker */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1.5, mb: 3 }}>
          {streams.map(s => {
            const isActive = s.id === activeStream
            const live = liveStreamStats[s.id]
            const liveCount = live?.count ?? 0
            const hasData = liveCount > 0
            const dotColor = recordsLoading ? '#94a3b8' : hasData ? '#10b981' : '#dc2626'
            const countLabel = recordsLoading ? '…' : hasData ? `${liveCount.toLocaleString()} recv'd` : 'No data'
            return (
              <Box
                key={s.id}
                onClick={() => setActiveStream(s.id)}
                data-ai-analyzable="true"
                data-ai-description={`Data Stream: ${s.title}. status: ${statusConfig[s.status].label.toUpperCase()}. records today: ${liveCount.toLocaleString()}. description: ${s.desc}.`}
                sx={{ bgcolor: '#ffffff', border: '1px solid', borderColor: isActive ? colorPalette.primary : '#eef0f4', p: 2, cursor: 'pointer', position: 'relative', transition: 'all 0.18s', '&:hover': { borderColor: isActive ? colorPalette.primary : '#cbd5e1' }, '&::before': isActive ? { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', bgcolor: colorPalette.primary } : {} }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Box sx={{ width: 32, height: 32, bgcolor: isActive ? colorPalette.primary : `${colorPalette.primary}10`, color: isActive ? '#ffffff' : colorPalette.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' }}>{s.icon}</Box>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dotColor, transition: 'background 0.4s' }} />
                </Box>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.25 }}>{s.title}</Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {countLabel}
                </Typography>
              </Box>
            )
          })}
        </Box>

        {/* Detail panel */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
          <Stack gap={3}>
            {/* Why box */}
            <Box
              data-ai-analyzable="true"
              data-ai-description={`Eureka Insight: Importance of the ${stream.title} stream. powers: ${stream.powers}. reason: ${stream.why}`}
              sx={{ bgcolor: colorPalette.primary, color: '#ffffff', p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.125rem' }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Why beam {stream.title.toLowerCase()}?</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.55, mb: 1.5, fontFamily: 'Jost' }}>{stream.why}</Typography>
              <Box>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>Powers</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{stream.powers}</Typography>
              </Box>
            </Box>


            {/* Schema */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Schema · {stream.title}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>{stream.schema.filter(f => f.required).length} required · {stream.schema.length} total fields</Typography>
                </Box>
                <Chip label={statusConfig[stream.status].label.toUpperCase()} size="small" sx={{ bgcolor: statusConfig[stream.status].bg, color: statusConfig[stream.status].color, fontWeight: 700, fontSize: '0.625rem', letterSpacing: '0.1em', borderRadius: 0, height: 22 }} />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px', px: 3, py: 1.25, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
                {['Field & example', 'Type', 'Required'].map(h => (
                  <Typography key={h} sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</Typography>
                ))}
              </Box>
              {stream.schema.map((f, i) => (
                <Box key={f.field} sx={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px', px: 3, py: 1.5, alignItems: 'center', borderBottom: i === stream.schema.length - 1 ? 'none' : '1px solid #f4f5f7', '&:hover': { bgcolor: '#fafbfc' } }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace' }}>{f.field}</Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', mt: 0.25 }}>e.g. {f.example}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#f59e0b', fontFamily: 'SF Mono, Monaco, monospace', fontWeight: 600 }}>{f.type}</Typography>
                  {f.required ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1rem', color: '#10b981' }} /> : <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>optional</Typography>}
                </Box>
              ))}
            </Box>
          </Stack>

          <Stack gap={3}>
            {/* Code sample */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>How to beam</Typography>
                <Box sx={{ display: 'flex' }}>
                  {langs.map(lang => (
                    <Box key={lang} onClick={() => setActiveLang(lang)} sx={{ px: 1.5, py: 0.75, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', transition: 'all 0.15s', color: activeLang === lang ? colorPalette.primary : '#64748b', bgcolor: activeLang === lang ? `${colorPalette.primary}08` : 'transparent', borderBottom: activeLang === lang ? `2px solid ${colorPalette.primary}` : '2px solid transparent', '&:hover': { color: colorPalette.primary } }}>
                      {lang}
                    </Box>
                  ))}
                </Box>
              </Box>
              <SyntaxCode code={codeByLang[activeLang]} />
            </Box>

            {/* Simulation Box - Beam Test Transaction */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PlayCircleOutlineIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Beam Test Transaction</Typography>
                </Box>
                {sandboxEnabled && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.375, bgcolor: '#fff7ed', border: '1px solid #ffedd5' }}>
                    <ScienceOutlinedIcon sx={{ fontSize: '0.85rem', color: '#c2410c' }} />
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#c2410c', letterSpacing: '0.05em' }}>SANDBOX MODE</Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 1 }}>
                  Edit the payload below to simulate a custom {stream.title.toLowerCase()} event:
                </Typography>
                <TextField
                  multiline
                  rows={8}
                  fullWidth
                  value={editablePayload}
                  onChange={(e) => setEditablePayload(e.target.value)}
                  error={!!jsonError}
                  helperText={jsonError}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.75rem',
                      fontFamily: 'SF Mono, Monaco, monospace',
                      bgcolor: '#f8fafc',
                      borderRadius: 0,
                      '& fieldset': { borderColor: '#e2e8f0' },
                      '&:hover fieldset': { borderColor: '#cbd5e1' },
                    }
                  }}
                />
              </Box>

              <Button
                fullWidth
                disabled={sendingTest}
                onClick={handleSendTest}
                startIcon={
                  !sandboxEnabled 
                    ? <ScienceOutlinedIcon /> 
                    : !keyInfo 
                      ? <VpnKeyOutlinedIcon /> 
                      : testSuccess 
                        ? <CheckCircleOutlineRoundedIcon /> 
                        : <PlayCircleOutlineIcon />
                }
                sx={{
                  bgcolor: (!sandboxEnabled || !keyInfo) ? '#fff7ed' : testSuccess ? '#10b981' : colorPalette.primary,
                  color: (!sandboxEnabled || !keyInfo) ? '#c2410c' : '#ffffff',
                  border: (!sandboxEnabled || !keyInfo) ? '1px solid #ffedd5' : 'none',
                  py: 1.25,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  fontFamily: 'Jost',
                  textTransform: 'none',
                  borderRadius: 0,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: (!sandboxEnabled || !keyInfo) ? '#ffedd5' : testSuccess ? '#10b981' : '#1a3896' },
                  '&.Mui-disabled': { bgcolor: '#f1f5f9', color: '#94a3b8' }
                }}
              >
                {!sandboxEnabled 
                  ? 'Switch to Sandbox to Test' 
                  : !keyInfo 
                    ? 'Get API Key to Get Started'
                    : sendingTest 
                      ? 'Beaming...' 
                      : testSuccess 
                        ? 'Success! Check Logs' 
                        : `Beam Test ${stream.title} Record`}
              </Button>
            </Box>

            {/* Recent payloads */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Recent payloads</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>Last events received on this stream</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                  <Box sx={{
                    width: 6, height: 6, borderRadius: '50%',
                    bgcolor: recordsLoading ? '#94a3b8' : activeStreamRecords.length > 0 ? '#10b981' : '#94a3b8',
                    animation: !recordsLoading && activeStreamRecords.length > 0 ? 'pulse 2s infinite' : 'none',
                    '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                  }} />
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: !recordsLoading && activeStreamRecords.length > 0 ? '#10b981' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {recordsLoading ? 'loading' : activeStreamRecords.length > 0 ? 'live' : 'idle'}
                  </Typography>
                  <IconButton
                    size="small" onClick={loadRecords} disabled={recordsLoading}
                    sx={{ ml: 0.5, borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary, bgcolor: `${colorPalette.primary}08` } }}
                  >
                    <RefreshRoundedIcon sx={{ fontSize: '0.875rem' }} />
                  </IconButton>
                </Box>
              </Box>
              <Stack>
                {recordsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Box key={i} sx={{ px: 3, py: 1.5, borderBottom: '1px solid #f4f5f7', display: 'flex', gap: 2 }}>
                      <Skeleton variant="rectangular" width={90} height={18} />
                      <Skeleton variant="rectangular" width="60%" height={18} />
                      <Skeleton variant="rectangular" width={60} height={18} />
                    </Box>
                  ))
                ) : activeStreamRecords.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <ErrorOutlineRoundedIcon sx={{ fontSize: '2rem', color: '#94a3b8', mb: 1 }} />
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', mb: 0.5 }}>No payloads on this stream yet</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: 320, mx: 'auto', mb: 2 }}>Generate an API key and instrument your core to start beaming.</Typography>
                    <Button onClick={() => setApiKeyOpen(true)} sx={{ bgcolor: colorPalette.primary, color: '#ffffff', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#1a3896' } }}>
                      Get API Key
                    </Button>
                  </Box>
                ) : (
                  activeStreamRecords.map(r => <RecordRow key={r.id} record={r} />)
                )}
              </Stack>
            </Box>
          </Stack>
        </Box>

        {/* Auth reference */}
        <Box sx={{ mt: 3, bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Authentication & headers</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>Required on every beam request</Typography>
          </Box>
          <Box sx={{ px: 3, py: 2.5 }}>
            <Stack gap={0}>
              {[
                { header: 'Authorization', value: 'Bearer $OPENIV_BEAM_KEY', desc: 'Your institution beam API key.' },
                { header: 'Content-Type', value: 'application/json', desc: 'All payloads must be JSON.' },
                { header: 'X-Idempotency-Key', value: '<uuid-v4>', desc: 'Unique per request — re-use to safely retry without duplicating records.' },
              ].map(({ header, value, desc }) => (
                <Box key={header} sx={{ display: 'grid', gridTemplateColumns: '220px 240px 1fr', gap: 2, alignItems: 'flex-start', py: 1.25, borderBottom: '1px solid #f4f5f7', '&:last-child': { borderBottom: 'none' } }}>
                  <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: colorPalette.primary, fontWeight: 600 }}>{header}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#ffcb6b', bgcolor: '#0d1117', px: 1, py: 0.25 }}>{value}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{desc}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
      </Box>

      <ApiKeyModal 
        open={apiKeyOpen} 
        onClose={() => setApiKeyOpen(false)} 
        keyInfo={keyInfo}
        onKeyUpdated={loadKey}
      />
    </DashboardLayout>
  )
}
