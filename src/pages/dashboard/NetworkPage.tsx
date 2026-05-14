import { useState, useMemo, useEffect } from 'react'
import {
  Box, Typography, Stack, Chip, TextField, InputAdornment,
  IconButton, Tooltip, Tab, Tabs,
} from '@mui/material'
import { colorPalette } from '@/theme'
import { networkApi, type NetworkLogEntry } from '@/api/network'
import SearchIcon from '@mui/icons-material/Search'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import RssFeedOutlinedIcon from '@mui/icons-material/RssFeedOutlined'
import WebhookOutlinedIcon from '@mui/icons-material/WebhookOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ReplayIcon from '@mui/icons-material/Replay'
import FilterListIcon from '@mui/icons-material/FilterList'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CallMadeIcon from '@mui/icons-material/CallMade'
import CallReceivedIcon from '@mui/icons-material/CallReceived'

// ── Types ────────────────────────────────────────────────────────────────────

type Source = 'beam' | 'webhook'
type SrcFilter = 'all' | 'beam' | 'webhook'
type StatusF = 'all' | '2xx' | '4xx' | '5xx'
type TimeF = '1h' | '6h' | '24h' | '7d'

interface Retry { attempt: number; ts: string; status: number; ms: number; err?: string }

interface Entry {
  id: string
  ts: string
  source: Source
  method: string
  endpoint: string
  stream?: string
  event?: string
  status: number
  ms: number
  bytes: number
  ip?: string
  customerId?: string
  txId?: string
  reqHeaders: Record<string, string>
  reqBody: string
  resHeaders?: Record<string, string>
  resBody?: string
  retries?: Retry[]
  error?: string
}

// ── Kept for legacy LOGS array (dead code — remove once LOGS is deleted) ─────
function ts(minutesAgo: number) {
  const d = new Date(); d.setMinutes(d.getMinutes() - minutesAgo); return d.toISOString()
}

// ── API helpers ───────────────────────────────────────────────────────────────

function getSince(timeF: TimeF): string {
  const cutoffMin = { '1h': 60, '6h': 360, '24h': 1440, '7d': 10080 }[timeF]
  return new Date(Date.now() - cutoffMin * 60_000).toISOString()
}

function mapApiEntry(e: NetworkLogEntry): Entry {
  let reqHeaders: Record<string, string> = {}
  let resHeaders: Record<string, string> | undefined
  try { reqHeaders = JSON.parse(e.reqHeaders) } catch { /* keep {} */ }
  if (e.resHeaders) try { resHeaders = JSON.parse(e.resHeaders) } catch { /* keep undefined */ }
  return {
    id: e.id,
    ts: e.ts,
    source: e.source,
    method: e.method,
    endpoint: e.endpoint,
    stream: e.source === 'beam' ? (e.stream ?? undefined) : undefined,
    event: e.source === 'webhook' ? (e.stream ?? undefined) : undefined,
    status: e.statusCode,
    ms: e.durationMs ?? 0,
    bytes: e.bytes ?? 0,
    ip: e.ip ?? undefined,
    reqHeaders,
    reqBody: e.reqBody ?? '',
    resHeaders,
    resBody: e.resBody ?? undefined,
    error: e.errorMessage ?? undefined,
  }
}

const LOGS: Entry[] = [
  {
    id: 'b001', ts: ts(2), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/transactions', stream: 'transactions',
    status: 201, ms: 142, bytes: 1240, ip: '102.89.32.18',
    customerId: 'CUST-0012', txId: 'TXN-48721',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-a1b2c3d4', 'User-Agent': 'fcmb-sdk/2.1.0 node/18.20.0' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0012', transaction_id: 'TXN-48721', amount: 150000, currency: 'NGN', channel: 'mobile', merchant_name: 'Shoprite Lagos', merchant_category: 'GROCERY', device_id: 'DEV-99821', ip_address: '102.89.32.18', geo_lat: 6.4541, geo_lng: 3.3947, occurred_at: '2026-04-28T09:58:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json', 'X-Request-ID': 'req-a1b2c3d4', 'X-Processing-Time': '142ms' },
    resBody: JSON.stringify({ ok: true, ingestId: 'ING-00881', riskScore: 12, streamed: true }, null, 2),
  },
  {
    id: 'w001', ts: ts(4), source: 'webhook', method: 'POST',
    endpoint: 'https://api.fcmb.com/webhooks/fraud-ops', event: 'tx.flagged',
    status: 200, ms: 340, bytes: 892, ip: '196.52.43.2',
    customerId: 'CUST-0012', txId: 'TXN-48721',
    reqHeaders: { 'Content-Type': 'application/json', 'X-OpenIV-Signature': 'sha256=8f14e45f…', 'X-OpenIV-Event': 'tx.flagged', 'X-Delivery-ID': 'dlv-00771', 'User-Agent': 'OpenIV-Webhooks/1.4' },
    reqBody: JSON.stringify({ event: 'tx.flagged', deliveryId: 'dlv-00771', timestamp: '2026-04-28T09:56:00Z', data: { txId: 'TXN-48721', customerId: 'CUST-0012', riskScore: 87, flags: ['velocity_spike', 'new_device'], amount: 150000, channel: 'mobile' } }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ received: true }, null, 2),
  },
  {
    id: 'b002', ts: ts(9), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/transactions', stream: 'transactions',
    status: 201, ms: 89, bytes: 980, ip: '197.210.54.71',
    customerId: 'CUST-0087', txId: 'TXN-48688',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-f9e8d7c6' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0087', transaction_id: 'TXN-48688', amount: 45000, currency: 'NGN', channel: 'ussd', device_fingerprint: 'fp-abc123', occurred_at: '2026-04-28T09:51:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json', 'X-Request-ID': 'req-f9e8d7c6' },
    resBody: JSON.stringify({ ok: true, ingestId: 'ING-00880', riskScore: 5 }, null, 2),
  },
  {
    id: 'b003', ts: ts(14), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/transactions', stream: 'transactions',
    status: 422, ms: 67, bytes: 410, ip: '102.89.32.18',
    customerId: 'CUST-0044', txId: 'TXN-48650',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-00112233' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0044', transaction_id: 'TXN-48650', currency: 'NGN', channel: 'pos' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ error: 'validation', detail: '"amount" is required and must be a positive number', fields: ['amount'], requestId: 'req-00112233' }, null, 2),
    error: 'Validation error: missing required field "amount"',
  },
  {
    id: 'w002', ts: ts(18), source: 'webhook', method: 'POST',
    endpoint: 'https://api.fcmb.com/webhooks/fraud-ops', event: 'tx.blocked',
    status: 200, ms: 278, bytes: 760, ip: '196.52.43.2',
    customerId: 'CUST-0031', txId: 'TXN-48620',
    reqHeaders: { 'Content-Type': 'application/json', 'X-OpenIV-Signature': 'sha256=3c59dc04…', 'X-OpenIV-Event': 'tx.blocked', 'X-Delivery-ID': 'dlv-00768' },
    reqBody: JSON.stringify({ event: 'tx.blocked', deliveryId: 'dlv-00768', timestamp: '2026-04-28T09:42:00Z', data: { txId: 'TXN-48620', customerId: 'CUST-0031', riskScore: 94, blockReason: 'FAILED_CASCADE', amount: 890000 } }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ received: true }, null, 2),
  },
  {
    id: 'b004', ts: ts(22), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/logins', stream: 'logins',
    status: 201, ms: 210, bytes: 640, ip: '41.58.102.9',
    customerId: 'CUST-0099',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-44aabb99' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0099', device_id: 'DEV-10032', channel: 'mobile', ip_address: '41.58.102.9', user_agent: 'FCMB Mobile/4.2 iOS/17.4', occurred_at: '2026-04-28T09:38:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ ok: true, ingestId: 'ING-00879' }, null, 2),
  },
  {
    id: 'w003', ts: ts(31), source: 'webhook', method: 'POST',
    endpoint: 'https://api.fcmb.com/webhooks/fraud-ops', event: 'tx.flagged',
    status: 503, ms: 4921, bytes: 0, ip: '196.52.43.2',
    customerId: 'CUST-0055', txId: 'TXN-48590',
    reqHeaders: { 'Content-Type': 'application/json', 'X-OpenIV-Signature': 'sha256=9ef4c21b…', 'X-OpenIV-Event': 'tx.flagged', 'X-Delivery-ID': 'dlv-00762' },
    reqBody: JSON.stringify({ event: 'tx.flagged', deliveryId: 'dlv-00762', timestamp: '2026-04-28T09:29:00Z', data: { txId: 'TXN-48590', customerId: 'CUST-0055', riskScore: 82, amount: 250000 } }, null, 2),
    resBody: '503 Service Unavailable',
    error: 'Endpoint returned 503 — retried 3×, resolved on attempt 3',
    retries: [
      { attempt: 1, ts: ts(31), status: 503, ms: 4921, err: '503 Service Unavailable' },
      { attempt: 2, ts: ts(26), status: 503, ms: 4610, err: '503 Service Unavailable' },
      { attempt: 3, ts: ts(21), status: 200, ms: 312 },
    ],
  },
  {
    id: 'b005', ts: ts(38), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/otps', stream: 'otps',
    status: 201, ms: 156, bytes: 820, ip: '197.210.54.71',
    customerId: 'CUST-0021', txId: 'TXN-48555',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-cc5544bb' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0021', transaction_id: 'TXN-48555', otp_type: 'sms', channel: 'transfer', attempt_count: 3, customer_name: 'Amaka Okoye', ip_address: '197.210.54.71', amount: 75000, beneficiary_account: '0123456789', device_model: 'Samsung Galaxy S23', occurred_at: '2026-04-28T09:22:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ ok: true, ingestId: 'ING-00875', alert: false }, null, 2),
  },
  {
    id: 'w004', ts: ts(45), source: 'webhook', method: 'POST',
    endpoint: 'https://api.fcmb.com/webhooks/compliance', event: 'case.opened',
    status: 200, ms: 412, bytes: 1100, ip: '196.52.43.2',
    reqHeaders: { 'Content-Type': 'application/json', 'X-OpenIV-Signature': 'sha256=a1b2c3d4…', 'X-OpenIV-Event': 'case.opened', 'X-Delivery-ID': 'dlv-00755' },
    reqBody: JSON.stringify({ event: 'case.opened', deliveryId: 'dlv-00755', timestamp: '2026-04-28T09:15:00Z', data: { caseId: 'CASE-1124', customerId: 'CUST-0021', severity: 'high', triggers: ['otp_bombing', 'velocity_spike'], assignedTo: 'compliance@fcmb.com' } }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ received: true, caseAcknowledged: 'CASE-1124' }, null, 2),
  },
  {
    id: 'b006', ts: ts(52), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/otps', stream: 'otps',
    status: 500, ms: 3214, bytes: 290, ip: '41.58.102.9',
    customerId: 'CUST-0066',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-ffe00aa1' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0066', otp_type: 'email', channel: 'login', attempt_count: 1, occurred_at: '2026-04-28T09:08:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ error: 'internal', message: 'upstream processing timeout', requestId: 'req-ffe00aa1' }, null, 2),
    error: 'Internal server error: upstream processing timeout after 3214ms',
  },
  {
    id: 'b007', ts: ts(74), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/activity', stream: 'activity',
    status: 201, ms: 72, bytes: 520, ip: '197.210.54.71',
    customerId: 'CUST-0034',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-11223344' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0034', action: 'profile_update', resource: 'beneficiary', ip_address: '197.210.54.71', occurred_at: '2026-04-28T08:46:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ ok: true, ingestId: 'ING-00870' }, null, 2),
  },
  {
    id: 'w006', ts: ts(82), source: 'webhook', method: 'POST',
    endpoint: 'https://api.fcmb.com/webhooks/fraud-ops', event: 'case.escalated',
    status: 401, ms: 148, bytes: 180, ip: '196.52.43.2',
    reqHeaders: { 'Content-Type': 'application/json', 'X-OpenIV-Signature': 'sha256=d4e5f6a7…', 'X-OpenIV-Event': 'case.escalated', 'X-Delivery-ID': 'dlv-00741' },
    reqBody: JSON.stringify({ event: 'case.escalated', deliveryId: 'dlv-00741', timestamp: '2026-04-28T08:38:00Z', data: { caseId: 'CASE-1119', escalatedTo: 'head_of_compliance', priority: 'critical' } }, null, 2),
    resHeaders: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="fraud-ops"' },
    resBody: JSON.stringify({ error: 'Unauthorized', message: 'API key expired — please rotate in OpenIV dashboard' }, null, 2),
    error: '401 Unauthorized — endpoint API key expired',
    retries: [
      { attempt: 1, ts: ts(82), status: 401, ms: 148, err: '401 Unauthorized' },
      { attempt: 2, ts: ts(77), status: 401, ms: 139, err: '401 Unauthorized' },
      { attempt: 3, ts: ts(72), status: 401, ms: 141, err: '401 Unauthorized — retries exhausted' },
    ],
  },
  {
    id: 'b008', ts: ts(95), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/transactions', stream: 'transactions',
    status: 201, ms: 118, bytes: 1060, ip: '41.58.102.9',
    customerId: 'CUST-0018', txId: 'TXN-48490',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-99887766' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0018', transaction_id: 'TXN-48490', amount: 320000, currency: 'NGN', channel: 'internet', merchant_name: 'GTB Online', occurred_at: '2026-04-28T08:25:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ ok: true, ingestId: 'ING-00866', riskScore: 22 }, null, 2),
  },
  {
    id: 'b009', ts: ts(108), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/devices', stream: 'devices',
    status: 201, ms: 134, bytes: 880, ip: '102.89.32.18',
    customerId: 'CUST-0054',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-aabbccdd' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0054', device_id: 'DEV-20044', fingerprint: 'fp-def456', model: 'iPhone 14 Pro', os: 'iOS 17.3', app_version: '4.2.1', occurred_at: '2026-04-28T08:12:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ ok: true, ingestId: 'ING-00862', newDevice: true }, null, 2),
  },
  {
    id: 'w007', ts: ts(120), source: 'webhook', method: 'POST',
    endpoint: 'https://api.fcmb.com/webhooks/fraud-ops', event: 'tx.flagged',
    status: 200, ms: 440, bytes: 820, ip: '196.52.43.2',
    customerId: 'CUST-0018', txId: 'TXN-48490',
    reqHeaders: { 'Content-Type': 'application/json', 'X-OpenIV-Signature': 'sha256=f1e2d3c4…', 'X-OpenIV-Event': 'tx.flagged', 'X-Delivery-ID': 'dlv-00735' },
    reqBody: JSON.stringify({ event: 'tx.flagged', deliveryId: 'dlv-00735', timestamp: '2026-04-28T08:00:00Z', data: { txId: 'TXN-48490', customerId: 'CUST-0018', riskScore: 78, flags: ['new_device'], amount: 320000 } }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ received: true }, null, 2),
  },
  {
    id: 'b010', ts: ts(145), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/logins', stream: 'logins',
    status: 201, ms: 98, bytes: 590, ip: '197.210.54.71',
    customerId: 'CUST-0073',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-55667788' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0073', device_id: 'DEV-30015', channel: 'internet', ip_address: '197.210.54.71', occurred_at: '2026-04-28T07:35:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ ok: true, ingestId: 'ING-00858' }, null, 2),
  },
  {
    id: 'b011', ts: ts(168), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/locations', stream: 'locations',
    status: 201, ms: 88, bytes: 440, ip: '41.58.102.9',
    customerId: 'CUST-0041',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-eeff0011' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0041', geo_lat: 6.6018, geo_lng: 3.3515, accuracy_m: 15, source: 'gps', occurred_at: '2026-04-28T07:12:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ ok: true, ingestId: 'ING-00854' }, null, 2),
  },
  {
    id: 'w008', ts: ts(180), source: 'webhook', method: 'POST',
    endpoint: 'https://api.fcmb.com/webhooks/compliance', event: 'sar.filed',
    status: 200, ms: 560, bytes: 1380, ip: '196.52.43.2',
    reqHeaders: { 'Content-Type': 'application/json', 'X-OpenIV-Signature': 'sha256=2b3c4d5e…', 'X-OpenIV-Event': 'sar.filed', 'X-Delivery-ID': 'dlv-00720' },
    reqBody: JSON.stringify({ event: 'sar.filed', deliveryId: 'dlv-00720', timestamp: '2026-04-28T07:00:00Z', data: { sarId: 'SAR-0091', customerId: 'CUST-0021', filedBy: 'adaeze.chukwu@fcmb.com', nfiuRef: 'NFIU/2026/04/0091', totalAmount: 2400000, patternCount: 9 } }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ received: true, complianceAck: 'SAR-0091' }, null, 2),
  },
  {
    id: 'b012', ts: ts(200), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/transactions', stream: 'transactions',
    status: 400, ms: 54, bytes: 310, ip: '102.89.32.18',
    reqHeaders: { 'Authorization': 'Bearer INVALID_TOKEN', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0011', amount: 10000 }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ error: 'unauthorized', detail: 'JWT signature invalid or expired', code: 'TOKEN_EXPIRED' }, null, 2),
    error: '400 Unauthorized: JWT signature invalid or expired',
  },
  {
    id: 'b013', ts: ts(240), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/transactions', stream: 'transactions',
    status: 201, ms: 165, bytes: 1180, ip: '197.210.54.71',
    customerId: 'CUST-0061', txId: 'TXN-48320',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-33221100' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0061', transaction_id: 'TXN-48320', amount: 500000, currency: 'NGN', channel: 'mobile', merchant_name: 'Jumia', occurred_at: '2026-04-28T06:00:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ ok: true, ingestId: 'ING-00849', riskScore: 34 }, null, 2),
  },
  {
    id: 'w009', ts: ts(280), source: 'webhook', method: 'POST',
    endpoint: 'https://api.fcmb.com/webhooks/fraud-ops', event: 'tx.flagged',
    status: 429, ms: 92, bytes: 140, ip: '196.52.43.2',
    customerId: 'CUST-0061', txId: 'TXN-48320',
    reqHeaders: { 'Content-Type': 'application/json', 'X-OpenIV-Signature': 'sha256=9a8b7c6d…', 'X-OpenIV-Event': 'tx.flagged', 'X-Delivery-ID': 'dlv-00712' },
    reqBody: JSON.stringify({ event: 'tx.flagged', deliveryId: 'dlv-00712', timestamp: '2026-04-28T05:20:00Z', data: { txId: 'TXN-48320', riskScore: 80 } }, null, 2),
    resHeaders: { 'Content-Type': 'application/json', 'Retry-After': '60', 'X-RateLimit-Limit': '100', 'X-RateLimit-Remaining': '0' },
    resBody: JSON.stringify({ error: 'rate_limit_exceeded', retryAfter: 60 }, null, 2),
    error: '429 Too Many Requests — retry after 60s',
    retries: [
      { attempt: 1, ts: ts(280), status: 429, ms: 92, err: '429 Rate Limited' },
      { attempt: 2, ts: ts(279), status: 200, ms: 288 },
    ],
  },
  {
    id: 'b014', ts: ts(330), source: 'beam', method: 'POST',
    endpoint: '/api/v1/ingest/otps', stream: 'otps',
    status: 201, ms: 188, bytes: 750, ip: '41.58.102.9',
    customerId: 'CUST-0092', txId: 'TXN-48210',
    reqHeaders: { 'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpbnN0…', 'Content-Type': 'application/json', 'X-Institution-ID': 'INST-58', 'X-Request-ID': 'req-abcdef12' },
    reqBody: JSON.stringify({ customer_id: 'CUST-0092', transaction_id: 'TXN-48210', otp_type: 'sms', channel: 'transfer', attempt_count: 5, amount: 1200000, beneficiary_account: '9876543210', occurred_at: '2026-04-28T04:30:00Z' }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ ok: true, ingestId: 'ING-00842', alert: true, alertId: 'OTP-ALERT-0342' }, null, 2),
  },
  {
    id: 'w010', ts: ts(360), source: 'webhook', method: 'POST',
    endpoint: 'https://api.fcmb.com/webhooks/fraud-ops', event: 'tx.flagged',
    status: 200, ms: 302, bytes: 870, ip: '196.52.43.2',
    customerId: 'CUST-0092', txId: 'TXN-48210',
    reqHeaders: { 'Content-Type': 'application/json', 'X-OpenIV-Signature': 'sha256=7f8e9d0c…', 'X-OpenIV-Event': 'tx.flagged', 'X-Delivery-ID': 'dlv-00704' },
    reqBody: JSON.stringify({ event: 'tx.flagged', deliveryId: 'dlv-00704', timestamp: '2026-04-28T04:00:00Z', data: { txId: 'TXN-48210', riskScore: 91, flags: ['otp_bombing', 'high_amount'], amount: 1200000 } }, null, 2),
    resHeaders: { 'Content-Type': 'application/json' },
    resBody: JSON.stringify({ received: true }, null, 2),
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(code: number) {
  if (code >= 500) return { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' }
  if (code >= 400) return { bg: '#fff7ed', text: '#d97706', border: '#fed7aa' }
  return { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' }
}

function fmtMs(ms: number) {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + 's'
  return ms + 'ms'
}

function fmtBytes(b: number) {
  if (b === 0) return '—'
  if (b < 1024) return b + ' B'
  return (b / 1024).toFixed(1) + ' KB'
}

function fmtRel(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function fmtAbs(iso: string) {
  return new Intl.DateTimeFormat('en-NG', {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(iso))
}

function matchesStatus(code: number, f: StatusF) {
  if (f === 'all') return true
  if (f === '2xx') return code >= 200 && code < 300
  if (f === '4xx') return code >= 400 && code < 500
  return code >= 500
}

function matchesTime(iso: string, f: TimeF) {
  const cutoff = { '1h': 60, '6h': 360, '24h': 1440, '7d': 10080 }[f]
  const diffMin = (Date.now() - new Date(iso).getTime()) / 60000
  return diffMin <= cutoff
}

function makeCurl(e: Entry) {
  const base = e.source === 'beam'
    ? 'https://api.openiv.io'
    : e.endpoint
  const url = e.source === 'beam' ? base + e.endpoint : e.endpoint
  const headers = Object.entries(e.reqHeaders)
    .map(([k, v]) => `  -H '${k}: ${v}'`)
    .join(' \\\n')
  return `curl -X ${e.method} '${url}' \\\n${headers} \\\n  -d '${e.reqBody.replace(/\n/g, '').replace(/  +/g, ' ')}'`
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: Source }) {
  const isBeam = source === 'beam'
  return (
    <Stack direction="row" spacing={0.5} alignItems="center"
      sx={{ px: 0.75, py: 0.25, bgcolor: isBeam ? '#eff6ff' : '#f5f3ff', borderRadius: '3px' }}>
      {isBeam
        ? <RssFeedOutlinedIcon sx={{ fontSize: '0.65rem', color: '#2563eb' }} />
        : <WebhookOutlinedIcon sx={{ fontSize: '0.65rem', color: '#7c3aed' }} />}
      <Typography sx={{
        fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em',
        color: isBeam ? '#2563eb' : '#7c3aed', fontFamily: 'Jost'
      }}>
        {isBeam ? 'BEAM' : 'HOOK'}
      </Typography>
    </Stack>
  )
}

function StatusBadge({ code }: { code: number }) {
  const c = statusColor(code)
  return (
    <Box sx={{ px: 0.75, py: 0.25, bgcolor: c.bg, border: `1px solid ${c.border}`, borderRadius: '3px', display: 'inline-flex' }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: c.text, fontFamily: 'monospace' }}>
        {code}
      </Typography>
    </Box>
  )
}

function LatencyBar({ ms, maxMs }: { ms: number; maxMs: number }) {
  const pct = Math.min(100, (ms / maxMs) * 100)
  const color = ms > 2000 ? '#dc2626' : ms > 800 ? '#f59e0b' : '#10b981'
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 80 }}>
      <Box sx={{ flex: 1, height: 4, bgcolor: '#f1f5f9', borderRadius: 2 }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, borderRadius: 2 }} />
      </Box>
      <Typography sx={{ fontSize: '0.6875rem', fontFamily: 'monospace', color: '#475569', minWidth: 44, textAlign: 'right' }}>
        {fmtMs(ms)}
      </Typography>
    </Stack>
  )
}

function JsonView({ text }: { text: string }) {
  const highlighted = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span style="color:#7c3aed">"$1"</span>:')
    .replace(/: "([^"\\]*(?:\\.[^"\\]*)*)"/g, ': <span style="color:#0369a1">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:#059669">$1</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:#ea580c">$1</span>')
  return (
    <Box component="pre"
      dangerouslySetInnerHTML={{ __html: highlighted }}
      sx={{
        m: 0, fontSize: '0.75rem', fontFamily: 'SF Mono, Fira Code, Consolas, monospace',
        color: '#334155', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        overflowX: 'hidden'
      }}
    />
  )
}

function HeadersView({ headers }: { headers: Record<string, string> }) {
  return (
    <Stack spacing={0.25}>
      {Object.entries(headers).map(([k, v]) => (
        <Box key={k} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
          <Typography sx={{
            fontSize: '0.6875rem', fontWeight: 700, color: '#7c3aed',
            fontFamily: 'monospace', flexShrink: 0, minWidth: 180
          }}>{k}:</Typography>
          <Typography sx={{
            fontSize: '0.6875rem', color: '#334155', fontFamily: 'monospace',
            wordBreak: 'break-all'
          }}>{v}</Typography>
        </Box>
      ))}
    </Stack>
  )
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Box
      data-ai-analyzable="true"
      data-ai-description={`Network Performance KPI: ${label}. current value: ${value}. status: ${sub || 'N/A'}.`}
      sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', px: 2.5, py: 2 }}>
      <Typography sx={{
        fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.625
      }}>{label}</Typography>
      <Typography sx={{
        fontSize: '1.5rem', fontWeight: 700, color: accent ?? '#00288e',
        fontFamily: 'Jost', lineHeight: 1
      }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.5 }}>{sub}</Typography>}
    </Box>
  )
}

// Hourly throughput bars (last 24h)
function ThroughputChart({ entries }: { entries: Entry[] }) {
  const buckets: { beam: number; hook: number }[] = Array.from({ length: 24 }, () => ({ beam: 0, hook: 0 }))
  const now = Date.now()
  entries.forEach(e => {
    const hAgo = Math.floor((now - new Date(e.ts).getTime()) / 3_600_000)
    if (hAgo >= 0 && hAgo < 24) {
      const idx = 23 - hAgo
      if (e.source === 'beam') buckets[idx].beam++
      else buckets[idx].hook++
    }
  })
  const max = Math.max(...buckets.map(b => b.beam + b.hook), 1)
  return (
    <Stack direction="row" spacing={0.375} alignItems="flex-end" sx={{ height: 56 }}>
      {buckets.map((b, i) => {
        const total = b.beam + b.hook
        const totalH = Math.max(4, (total / max) * 52)
        const beamH = total > 0 ? (b.beam / total) * totalH : 0
        const hookH = totalH - beamH
        return (
          <Tooltip key={i} title={`${24 - i}h ago — Beam: ${b.beam}, Webhook: ${b.hook}`} placement="top">
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', cursor: 'default' }}>
              <Box sx={{ height: hookH, bgcolor: '#7c3aed', opacity: 0.7, borderRadius: '1px 1px 0 0' }} />
              <Box sx={{ height: beamH, bgcolor: colorPalette.primary, borderRadius: beamH > 0 ? '1px 1px 0 0' : 0 }} />
            </Box>
          </Tooltip>
        )
      })}
    </Stack>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const [srcF, setSrcF] = useState<SrcFilter>('all')
  const [statF, setStatF] = useState<StatusF>('all')
  const [timeF, setTimeF] = useState<TimeF>('24h')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Entry | null>(null)
  const [detailTab, setDetailTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const [logs, setLogs] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    networkApi.getLogs({
      source: srcF !== 'all' ? srcF : undefined,
      status: statF !== 'all' ? statF : undefined,
      since: getSince(timeF),
      q: search || undefined,
      limit: 200,
    })
      .then(res => setLogs(res.entries.map(mapApiEntry)))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [srcF, statF, timeF, search])

  const filtered = useMemo(() => logs.filter(e => {
    if (srcF !== 'all' && e.source !== srcF) return false
    if (!matchesStatus(e.status, statF)) return false
    if (!matchesTime(e.ts, timeF)) return false
    if (search) {
      const q = search.toLowerCase()
      if (!e.endpoint.toLowerCase().includes(q) &&
        !(e.customerId ?? '').toLowerCase().includes(q) &&
        !(e.txId ?? '').toLowerCase().includes(q) &&
        !(e.stream ?? e.event ?? '').toLowerCase().includes(q)) return false
    }
    return true
  }), [logs, srcF, statF, timeF, search])

  const kpis = useMemo(() => {
    const total = filtered.length
    const ok = filtered.filter(e => e.status < 400).length
    const errors = filtered.filter(e => e.status >= 400).length
    const latencies = filtered.map(e => e.ms).sort((a, b) => a - b)
    const avgMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0
    const p95 = percentile(latencies, 95)
    return { total, successRate: total ? ((ok / total) * 100).toFixed(1) : '—', avgMs, p95, errors }
  }, [filtered])

  const maxMs = useMemo(() => Math.max(...filtered.map(e => e.ms), 1), [filtered])

  const statusDist = useMemo(() => {
    const s2 = filtered.filter(e => e.status < 300).length
    const s4 = filtered.filter(e => e.status >= 400 && e.status < 500).length
    const s5 = filtered.filter(e => e.status >= 500).length
    const t = filtered.length || 1
    return { s2, s4, s5, p2: (s2 / t * 100).toFixed(0), p4: (s4 / t * 100).toFixed(0), p5: (s5 / t * 100).toFixed(0) }
  }, [filtered])

  const latPercentiles = useMemo(() => {
    const sorted = [...filtered].map(e => e.ms).sort((a, b) => a - b)
    return { p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99) }
  }, [filtered])

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
  }

  const filterBtn = (active: boolean) => ({
    px: 1.5, py: 0.625, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
    fontFamily: 'Jost', border: '1px solid',
    bgcolor: active ? colorPalette.primary : '#ffffff',
    color: active ? '#ffffff' : '#475569',
    borderColor: active ? colorPalette.primary : '#e2e8f0',
    transition: 'all 0.15s',
    '&:hover': { borderColor: colorPalette.primary, color: active ? '#ffffff' : colorPalette.primary },
  })

  return (
    <Box sx={{ p: 4, pb: 2 }}>
      {/* ── Page heading ── */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{
          fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary,
          letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75
        }}>Configuration</Typography>
        <Typography sx={{
          fontSize: '1.625rem', fontWeight: 700, color: '#00288e',
          fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5
        }}>Network & Traffic</Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
          Unified view of inbound beam events and outbound webhook deliveries — filter, inspect, replay, debug.
        </Typography>
      </Box>

      {/* ── KPI bar ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, mb: 3 }}>
        <KpiCard label="Total Requests" value={String(kpis.total)} sub={`last ${timeF}`} />
        <KpiCard label="Success Rate" value={`${kpis.successRate}%`}
          accent={parseFloat(kpis.successRate) < 95 ? '#d97706' : '#10b981'} sub="status < 400" />
        <KpiCard label="Avg Latency" value={fmtMs(kpis.avgMs)}
          accent={kpis.avgMs > 1000 ? '#dc2626' : kpis.avgMs > 500 ? '#d97706' : undefined} />
        <KpiCard label="P95 Latency" value={fmtMs(kpis.p95)}
          accent={kpis.p95 > 2000 ? '#dc2626' : kpis.p95 > 1000 ? '#d97706' : undefined} />
        <KpiCard label="Errors" value={String(kpis.errors)}
          accent={kpis.errors > 0 ? '#dc2626' : '#10b981'} sub="status ≥ 400" />
      </Box>

      {/* ── Filters ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        {/* Source */}
        <Stack direction="row" sx={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {(['all', 'beam', 'webhook'] as SrcFilter[]).map(s => (
            <Box
              key={s}
              onClick={() => setSrcF(s)}
              data-ai-analyzable="true"
              data-ai-description={`Filter network traffic by source: ${s === 'all' ? 'All Sources' : s === 'beam' ? 'Inbound Beam SDK' : 'Outbound Webhooks'}.`}
              sx={filterBtn(srcF === s)}>
              {s === 'all' ? 'All Sources' : s === 'beam' ? '↑ Beam' : '↓ Webhooks'}
            </Box>
          ))}
        </Stack>
        {/* Status */}
        <Stack direction="row" sx={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {(['all', '2xx', '4xx', '5xx'] as StatusF[]).map(s => (
            <Box
              key={s}
              onClick={() => setStatF(s)}
              data-ai-analyzable="true"
              data-ai-description={`Filter network traffic by HTTP status code: ${s === 'all' ? 'Any Status' : s}.`}
              sx={filterBtn(statF === s)}>
              {s === 'all' ? 'Any Status' : s}
            </Box>
          ))}
        </Stack>
        {/* Time range */}
        <Stack direction="row" sx={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {(['1h', '6h', '24h', '7d'] as TimeF[]).map(t => (
            <Box key={t} onClick={() => setTimeF(t)} sx={filterBtn(timeF === t)}>{t}</Box>
          ))}
        </Stack>
        {/* Search */}
        <TextField
          size="small" placeholder="Search endpoint, customer, txn…"
          value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} /></InputAdornment> }}
          sx={{
            ml: 'auto', minWidth: 260,
            '& .MuiOutlinedInput-root': {
              borderRadius: '2px', fontSize: '0.8125rem',
              bgcolor: '#f8fafc', '& fieldset': { borderColor: '#e2e8f0' }
            },
          }}
        />
        <Tooltip title={`${filtered.length} entries`}>
          <Chip label={filtered.length} size="small"
            sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, borderRadius: '3px', height: 28 }} />
        </Tooltip>
      </Box>
      {/* </Box> */}


      {/* ── Main split: table + inspector ── */}
      <Box sx={{ display: 'flex', height: 'calc(100vh - 390px)', minHeight: 380, mx: 4, mb: 3, border: '1px solid #eef0f4', overflow: 'hidden' }}>

        {/* Log table */}
        <Box sx={{ flex: selected ? '0 0 55%' : '1', overflow: 'auto', borderRight: selected ? '1px solid #eef0f4' : 'none' }}>
          {/* Table header */}
          <Box sx={{
            display: 'grid', gridTemplateColumns: '90px 70px 52px 1fr 58px 130px 72px',
            px: 2, py: 1.25, bgcolor: '#f8fafc', borderBottom: '1px solid #eef0f4', position: 'sticky', top: 0, zIndex: 1
          }}>
            {['Time', 'Source', 'Method', 'Endpoint / Stream', 'Status', 'Latency', 'Size'].map(h => (
              <Typography key={h} sx={{
                fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.08em'
              }}>{h}</Typography>
            ))}
          </Box>

          {loading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>Loading…</Typography>
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <FilterListIcon sx={{ fontSize: '2rem', color: '#cbd5e1', mb: 1 }} />
              <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No entries match the current filters</Typography>
            </Box>
          ) : filtered.map(e => {
            const isSelected = selected?.id === e.id
            const sc = statusColor(e.status)
            const tag = e.stream ?? e.event ?? ''
            return (
              <Box key={e.id} onClick={() => { setSelected(isSelected ? null : e); setDetailTab(0) }}
                data-ai-analyzable="true"
                data-ai-description={`Network Log Entry: ${e.source.toUpperCase()} ${e.method} ${e.endpoint}. status: ${e.status}. duration: ${e.ms}ms. size: ${fmtBytes(e.bytes)}.${e.stream || e.event ? ' tag: ' + (e.stream || e.event) : ''}`}
                sx={{
                  display: 'grid', gridTemplateColumns: '90px 70px 52px 1fr 58px 130px 72px',
                  px: 2, py: 1.125, alignItems: 'center',
                  borderBottom: '1px solid #f4f5f7',
                  bgcolor: isSelected ? `${colorPalette.primary}0a` : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                  '&:hover': { bgcolor: isSelected ? `${colorPalette.primary}0f` : '#f8fafc' },
                  ...(e.status >= 400 && !isSelected && { borderLeft: `2px solid ${sc.border}` }),
                }}>
                <Tooltip title={fmtAbs(e.ts)} placement="right">
                  <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'monospace' }}>
                    {fmtRel(e.ts)}
                  </Typography>
                </Tooltip>
                <SourceBadge source={e.source} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {e.source === 'beam'
                    ? <CallReceivedIcon sx={{ fontSize: '0.7rem', color: '#2563eb' }} />
                    : <CallMadeIcon sx={{ fontSize: '0.7rem', color: '#7c3aed' }} />}
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#00288e', fontFamily: 'monospace' }}>
                    {e.method}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{
                    fontSize: '0.75rem', color: '#00288e', fontFamily: 'monospace',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {e.source === 'webhook'
                      ? e.endpoint.replace('https://', '').replace('http://', '')
                      : e.endpoint}
                  </Typography>
                  {tag && (
                    <Typography sx={{
                      fontSize: '0.5625rem', color: e.source === 'beam' ? '#2563eb' : '#7c3aed',
                      fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase'
                    }}>
                      {tag}
                    </Typography>
                  )}
                </Box>
                <StatusBadge code={e.status} />
                <LatencyBar ms={e.ms} maxMs={maxMs} />
                <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'monospace' }}>
                  {fmtBytes(e.bytes)}
                </Typography>
              </Box>
            )
          })}
        </Box>

        {/* Detail inspector */}
        {selected && (
          <Box sx={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Inspector header */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f8fafc', flexShrink: 0 }}>
              <Box sx={{ px: 0.75, py: 0.25, bgcolor: '#1e293b', borderRadius: '3px' }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace' }}>
                  {selected.method}
                </Typography>
              </Box>
              <Typography sx={{
                fontSize: '0.75rem', color: '#00288e', fontFamily: 'monospace', flex: 1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}>
                {selected.endpoint}
              </Typography>
              <StatusBadge code={selected.status} />
              <IconButton size="small" onClick={() => setSelected(null)}
                sx={{ color: '#94a3b8', p: 0.25, '&:hover': { color: '#475569' } }}>
                <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Box>

            {/* Tabs */}
            <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)}
              sx={{
                borderBottom: '1px solid #eef0f4', minHeight: 36, flexShrink: 0,
                '& .MuiTab-root': { minHeight: 36, fontSize: '0.75rem', fontFamily: 'Jost', textTransform: 'none', py: 0.75, px: 1.5 },
                '& .Mui-selected': { color: `${colorPalette.primary} !important`, fontWeight: 600 },
                '& .MuiTabs-indicator': { bgcolor: colorPalette.primary, height: '2px' },
              }}>
              <Tab label="Overview" />
              <Tab label="Request" />
              <Tab label="Response" />
              <Tab label="cURL" />
            </Tabs>

            {/* Tab content */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>

              {/* ── Overview ── */}
              {detailTab === 0 && (
                <Stack spacing={2}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    {[
                      ['Time', fmtAbs(selected.ts)],
                      ['Latency', fmtMs(selected.ms)],
                      ['Size', fmtBytes(selected.bytes)],
                      ['Source IP', selected.ip ?? '—'],
                      ['Customer', selected.customerId ?? '—'],
                      ['Txn ID', selected.txId ?? '—'],
                      ['Stream', selected.stream ?? selected.event ?? '—'],
                      ['Retries', selected.retries ? `${selected.retries.length} attempts` : '—'],
                    ].map(([k, v]) => (
                      <Box key={k}>
                        <Typography sx={{
                          fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8',
                          textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25
                        }}>{k}</Typography>
                        <Typography sx={{
                          fontSize: '0.75rem', color: '#00288e', fontFamily: 'monospace',
                          wordBreak: 'break-all'
                        }}>{v}</Typography>
                      </Box>
                    ))}
                  </Box>

                  {selected.error && (
                    <Box sx={{ display: 'flex', gap: 1, p: 1.5, bgcolor: '#fef2f2', border: '1px solid #fca5a5' }}>
                      <ErrorOutlineIcon sx={{ fontSize: '0.875rem', color: '#dc2626', flexShrink: 0, mt: 0.125 }} />
                      <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', lineHeight: 1.5 }}>
                        {selected.error}
                      </Typography>
                    </Box>
                  )}

                  {selected.retries && selected.retries.length > 0 && (
                    <Box>
                      <Typography sx={{
                        fontSize: '0.6875rem', fontWeight: 700, color: '#475569',
                        textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1
                      }}>
                        Retry Timeline
                      </Typography>
                      <Stack spacing={0.75}>
                        {selected.retries.map(r => {
                          const ok = r.status < 400
                          return (
                            <Box key={r.attempt} sx={{
                              display: 'flex', alignItems: 'center', gap: 1.25,
                              p: 1, bgcolor: ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${ok ? '#86efac' : '#fca5a5'}`
                            }}>
                              <Box sx={{
                                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                bgcolor: ok ? '#10b981' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                {ok
                                  ? <CheckCircleOutlineIcon sx={{ fontSize: '0.75rem', color: '#fff' }} />
                                  : <ReplayIcon sx={{ fontSize: '0.75rem', color: '#fff' }} />}
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                                    Attempt {r.attempt}
                                  </Typography>
                                  <StatusBadge code={r.status} />
                                  <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'monospace' }}>
                                    {fmtMs(r.ms)}
                                  </Typography>
                                </Stack>
                                <Typography sx={{ fontSize: '0.6rem', color: '#94a3b8', fontFamily: 'monospace', mt: 0.25 }}>
                                  {fmtAbs(r.ts)}{r.err ? ` — ${r.err}` : ''}
                                </Typography>
                              </Box>
                            </Box>
                          )
                        })}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}

              {/* ── Request ── */}
              {detailTab === 1 && (
                <Stack spacing={2}>
                  <Box>
                    <Typography sx={{
                      fontSize: '0.6875rem', fontWeight: 700, color: '#475569',
                      textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.875
                    }}>Headers</Typography>
                    <Box sx={{ p: 1.25, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                      <HeadersView headers={selected.reqHeaders} />
                    </Box>
                  </Box>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.875 }}>
                      <Typography sx={{
                        fontSize: '0.6875rem', fontWeight: 700, color: '#475569',
                        textTransform: 'uppercase', letterSpacing: '0.08em'
                      }}>Body</Typography>
                      <Tooltip title={copied ? 'Copied!' : 'Copy body'}>
                        <IconButton size="small" onClick={() => copy(selected.reqBody)}
                          sx={{ color: '#94a3b8', p: 0.375 }}>
                          <ContentCopyIcon sx={{ fontSize: '0.875rem' }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Box sx={{ p: 1.5, bgcolor: '#00288e', border: '1px solid #1e293b', overflow: 'auto', maxHeight: 340 }}>
                      <Box component="pre"
                        dangerouslySetInnerHTML={{
                          __html: selected.reqBody
                            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                            .replace(/"([^"]+)":/g, '<span style="color:#a78bfa">"$1"</span>:')
                            .replace(/: "([^"]*)"/g, ': <span style="color:#7dd3fc">"$1"</span>')
                            .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:#4ade80">$1</span>')
                            .replace(/: (true|false|null)/g, ': <span style="color:#fb923c">$1</span>')
                        }}
                        sx={{
                          m: 0, fontSize: '0.75rem', fontFamily: 'SF Mono, Fira Code, monospace',
                          color: '#e2e8f0', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                        }}
                      />
                    </Box>
                  </Box>
                </Stack>
              )}

              {/* ── Response ── */}
              {detailTab === 2 && (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <StatusBadge code={selected.status} />
                    <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'monospace' }}>
                      {fmtMs(selected.ms)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'monospace' }}>
                      {fmtBytes(selected.bytes)}
                    </Typography>
                  </Stack>
                  {selected.resHeaders && (
                    <Box>
                      <Typography sx={{
                        fontSize: '0.6875rem', fontWeight: 700, color: '#475569',
                        textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.875
                      }}>Headers</Typography>
                      <Box sx={{ p: 1.25, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                        <HeadersView headers={selected.resHeaders} />
                      </Box>
                    </Box>
                  )}
                  {selected.resBody && (
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.875 }}>
                        <Typography sx={{
                          fontSize: '0.6875rem', fontWeight: 700, color: '#475569',
                          textTransform: 'uppercase', letterSpacing: '0.08em'
                        }}>Body</Typography>
                        <Tooltip title={copied ? 'Copied!' : 'Copy body'}>
                          <IconButton size="small" onClick={() => copy(selected.resBody!)}
                            sx={{ color: '#94a3b8', p: 0.375 }}>
                            <ContentCopyIcon sx={{ fontSize: '0.875rem' }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <Box sx={{ p: 1.5, bgcolor: '#00288e', border: '1px solid #1e293b', overflow: 'auto', maxHeight: 320 }}>
                        <Box component="pre"
                          dangerouslySetInnerHTML={{
                            __html: selected.resBody
                              .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                              .replace(/"([^"]+)":/g, '<span style="color:#a78bfa">"$1"</span>:')
                              .replace(/: "([^"]*)"/g, ': <span style="color:#7dd3fc">"$1"</span>')
                              .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:#4ade80">$1</span>')
                              .replace(/: (true|false|null)/g, ': <span style="color:#fb923c">$1</span>')
                          }}
                          sx={{
                            m: 0, fontSize: '0.75rem', fontFamily: 'SF Mono, Fira Code, monospace',
                            color: '#e2e8f0', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                </Stack>
              )}

              {/* ── cURL ── */}
              {detailTab === 3 && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography sx={{
                      fontSize: '0.6875rem', fontWeight: 700, color: '#475569',
                      textTransform: 'uppercase', letterSpacing: '0.08em'
                    }}>Replay with cURL</Typography>
                    <Box onClick={() => copy(makeCurl(selected))}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, cursor: 'pointer',
                        bgcolor: copied ? '#f0fdf4' : colorPalette.primary, border: '1px solid',
                        borderColor: copied ? '#86efac' : colorPalette.primary, transition: 'all 0.15s'
                      }}>
                      <ContentCopyIcon sx={{ fontSize: '0.75rem', color: copied ? '#10b981' : '#fff' }} />
                      <Typography sx={{
                        fontSize: '0.6875rem', fontWeight: 700,
                        color: copied ? '#10b981' : '#fff', fontFamily: 'Jost'
                      }}>
                        {copied ? 'Copied!' : 'Copy'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ p: 1.75, bgcolor: '#00288e', border: '1px solid #1e293b', overflow: 'auto' }}>
                    <Box component="pre" sx={{
                      m: 0, fontSize: '0.7rem', fontFamily: 'SF Mono, Fira Code, monospace',
                      color: '#e2e8f0', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                    }}>
                      {makeCurl(selected)}
                    </Box>
                  </Box>
                  <Box sx={{ mt: 1.5, p: 1.25, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                    <Stack direction="row" spacing={0.75} alignItems="flex-start">
                      <InfoOutlinedIcon sx={{ fontSize: '0.875rem', color: '#64748b', mt: 0.125 }} />
                      <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', lineHeight: 1.6 }}>
                        This reconstructed cURL reflects the original request headers and body. Bearer token may have expired — regenerate in the Beam or Webhook settings before replaying.
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Empty inspector state */}
        {!selected && (
          <Box sx={{ display: 'none' }} />
        )}
      </Box>

      {/* ── Analytics section ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 2.5, mx: 4, mb: 4 }}>

        {/* Throughput chart */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                Request Volume
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.25 }}>Hourly — last 24 h</Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 8, height: 8, bgcolor: colorPalette.primary, borderRadius: '1px' }} />
                <Typography sx={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'Jost', fontWeight: 600 }}>BEAM</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 8, height: 8, bgcolor: '#7c3aed', opacity: 0.7, borderRadius: '1px' }} />
                <Typography sx={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'Jost', fontWeight: 600 }}>WEBHOOK</Typography>
              </Stack>
            </Stack>
          </Stack>
          <ThroughputChart entries={filtered} />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
            <Typography sx={{ fontSize: '0.6rem', color: '#94a3b8', fontFamily: 'monospace' }}>-24h</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#94a3b8', fontFamily: 'monospace' }}>-12h</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#94a3b8', fontFamily: 'monospace' }}>now</Typography>
          </Stack>
        </Box>

        {/* Latency percentiles */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 3 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 0.25 }}>
            Latency Distribution
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mb: 2 }}>Across filtered entries</Typography>
          {[
            { label: 'P50', val: latPercentiles.p50, color: '#10b981' },
            { label: 'P95', val: latPercentiles.p95, color: '#f59e0b' },
            { label: 'P99', val: latPercentiles.p99, color: '#dc2626' },
          ].map(({ label, val, color }) => {
            const pct = Math.min(100, (val / Math.max(latPercentiles.p99, 1)) * 100)
            return (
              <Box key={label} sx={{ mb: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', fontFamily: 'Jost' }}>{label}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color, fontFamily: 'monospace' }}>{fmtMs(val)}</Typography>
                </Stack>
                <Box sx={{ height: 6, bgcolor: '#f1f5f9', borderRadius: 3 }}>
                  <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, borderRadius: 3, transition: 'width 0.4s' }} />
                </Box>
              </Box>
            )
          })}
          <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid #eef0f4' }}>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
              <AccessTimeIcon sx={{ fontSize: '0.75rem', color: '#94a3b8' }} />
              <Typography sx={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                SLA Target: 500ms
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: '0.75rem', color: latPercentiles.p95 <= 500 ? '#10b981' : '#dc2626', fontWeight: 700, fontFamily: 'Jost' }}>
              {latPercentiles.p95 <= 500 ? '✓ P95 within SLA' : `✗ P95 exceeds SLA by ${fmtMs(latPercentiles.p95 - 500)}`}
            </Typography>
          </Box>
        </Box>

        {/* Status distribution */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 3 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 0.25 }}>
            Status Distribution
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mb: 2 }}>By response class</Typography>
          <Box sx={{ height: 10, bgcolor: '#f1f5f9', borderRadius: 2, overflow: 'hidden', display: 'flex', mb: 2 }}>
            {Number(statusDist.p2) > 0 && <Box sx={{ flex: statusDist.s2, bgcolor: '#10b981', transition: 'flex 0.4s' }} />}
            {Number(statusDist.p4) > 0 && <Box sx={{ flex: statusDist.s4, bgcolor: '#f59e0b', transition: 'flex 0.4s' }} />}
            {Number(statusDist.p5) > 0 && <Box sx={{ flex: statusDist.s5, bgcolor: '#dc2626', transition: 'flex 0.4s' }} />}
          </Box>
          {[
            { label: '2xx Success', count: statusDist.s2, pct: statusDist.p2, color: '#10b981', bg: '#f0fdf4' },
            { label: '4xx Client Error', count: statusDist.s4, pct: statusDist.p4, color: '#d97706', bg: '#fffbeb' },
            { label: '5xx Server Error', count: statusDist.s5, pct: statusDist.p5, color: '#dc2626', bg: '#fef2f2' },
          ].map(({ label, count, pct, color, bg }) => (
            <Stack key={label} direction="row" justifyContent="space-between" alignItems="center"
              sx={{ py: 0.875, px: 1.25, mb: 0.5, bgcolor: bg, borderRadius: '3px' }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ width: 8, height: 8, bgcolor: color, borderRadius: '50%' }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'Jost' }}>{label}</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color, fontFamily: 'Jost' }}>{count}</Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'monospace' }}>{pct}%</Typography>
              </Stack>
            </Stack>
          ))}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Total requests</Typography>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
              {filtered.length}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box >
  )
}
