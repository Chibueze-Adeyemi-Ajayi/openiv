import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box, Typography, Stack, Button, IconButton, Skeleton,
  Select, MenuItem, FormControl, Tabs, Tab, Collapse,
} from '@mui/material'
import { colorPalette } from '@/theme'
import { webhookApi, type WebhookDelivery, type WebhookEndpoint } from '@/api/webhooks'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { useNavigate } from 'react-router-dom'

// ── Helpers ───────────────────────────────────────────────────────────────────

function prettyJson(raw: string | null): string {
  if (!raw) return ''
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function shortId(id: string | null): string {
  if (!id) return '—'
  const parts = id.split('_')
  return parts[parts.length - 1]?.slice(0, 8) ?? id.slice(-8)
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'pending' | 'delivered' | 'failed' }) {
  const config = {
    delivered: { bg: '#f0fdf4', color: '#10b981', dot: '#10b981' },
    failed: { bg: '#fef2f2', color: '#dc2626', dot: '#dc2626' },
    pending: { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' },
  }[status]
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.375, bgcolor: config.bg }}>
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: config.dot, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', color: config.color }}>
        {status.toUpperCase()}
      </Typography>
    </Box>
  )
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <Button
      size="small"
      startIcon={copied
        ? <CheckRoundedIcon sx={{ fontSize: '0.75rem !important', color: '#10b981' }} />
        : <ContentCopyOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
      onClick={copy}
      sx={{
        fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600,
        color: copied ? '#10b981' : '#64748b', textTransform: 'none',
        px: 1, py: 0.375, borderRadius: 0,
        '&:hover': { bgcolor: 'var(--section-bg)' },
        '& .MuiButton-startIcon': { mr: 0.375 },
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}

// ── Syntax highlighting ───────────────────────────────────────────────────────

type SToken = { text: string; color: string; italic?: boolean }

const SC = {
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

const SKW = [
  'curl', 'const', 'let', 'var', 'import', 'from', 'require', 'async', 'await',
  'function', 'return', 'if', 'else', 'try', 'catch', 'throw', 'new', 'class',
  'export', 'default', 'def', 'for', 'in', 'with', 'pass', 'raise', 'as', 'elif',
  'True', 'False', 'None', 'func', 'package', 'type', 'struct', 'interface',
  'public', 'private', 'protected', 'static', 'void', 'final', 'this',
  'print', 'println', 'true', 'false', 'null', 'undefined', 'nil',
  'bytes', 'json', 'http', 'time', 'net', 'os', 'fmt', 'uuid',
  'POST', 'GET', 'PUT', 'DELETE', 'PATCH', 'HEAD',
].join('|')

const SKW_RE = new RegExp(`^(?:${SKW})(?=[^a-zA-Z_0-9]|$)`)

const SPATTERNS: Array<{ re: RegExp; color: string; italic?: boolean }> = [
  { re: /^#[^\n]*/, color: SC.comment, italic: true },
  { re: /^\/\/[^\n]*/, color: SC.comment, italic: true },
  { re: /^"(?:[^"\\]|\\.)*"/, color: SC.string },
  { re: /^'(?:[^'\\]|\\.)*'/, color: SC.string },
  { re: /^`(?:[^`\\]|\\.)*`/, color: SC.string },
  { re: /^\$\{[^}]+\}/, color: SC.env },
  { re: /^\$[A-Z_][A-Z_0-9]*/, color: SC.env },
  { re: /^https?:\/\/[^\s'"\\),`]+/, color: SC.url },
  { re: SKW_RE, color: SC.keyword },
  { re: /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, color: SC.number },
  { re: /^[{}[\]();,]/, color: SC.punct },
  { re: /^[:=<>+\-*/|&^~%!]/, color: SC.operator },
  { re: /^[\\]/, color: SC.punct },
  { re: /^[a-zA-Z_][a-zA-Z_0-9]*(?=\()/, color: SC.func },
]

function syntaxTokenize(code: string): SToken[] {
  const tokens: SToken[] = []
  let remaining = code
  while (remaining.length > 0) {
    let matched = false
    for (const { re, color, italic } of SPATTERNS) {
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
      if (last && last.color === SC.plain && !last.italic) {
        last.text += remaining[0]
      } else {
        tokens.push({ text: remaining[0], color: SC.plain })
      }
      remaining = remaining.slice(1)
    }
  }
  return tokens
}

// ── Code block ────────────────────────────────────────────────────────────────

function CodeBlock({ content, copyLabel, highlight = false }: { content: string; copyLabel?: string; highlight?: boolean }) {
  const tokens = highlight ? syntaxTokenize(content) : null
  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{
        bgcolor: '#0d1117', borderRadius: 0,
        p: 2, fontFamily: 'SF Mono, Monaco, Consolas, monospace',
        fontSize: '0.6875rem', lineHeight: 1.7,
        overflowX: 'auto', whiteSpace: 'pre',
        maxHeight: 320, overflowY: 'auto',
      }}>
        {tokens
          ? tokens.map((t, i) => (
            <Box key={i} component="span" sx={{ color: t.color, fontStyle: t.italic ? 'italic' : 'normal', whiteSpace: 'pre' }}>{t.text}</Box>
          ))
          : <Box component="span" sx={{ color: '#e2e8f0' }}>{content || '(empty)'}</Box>
        }
      </Box>
      {content && (
        <Box sx={{ position: 'absolute', top: 6, right: 6 }}>
          <CopyBtn text={content} label={copyLabel ?? 'Copy'} />
        </Box>
      )}
    </Box>
  )
}

// ── Delivery detail tabs ──────────────────────────────────────────────────────

function DeliveryDetail({ d }: { d: WebhookDelivery }) {
  const [tab, setTab] = useState(0)

  const reqBody = prettyJson(d.requestBody)
  const respBody = prettyJson(d.responseBody)

  return (
    <Box sx={{ bgcolor: 'var(--section-bg)', borderTop: '1px solid var(--border-col)' }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          borderBottom: '1px solid var(--border-col)', minHeight: 36,
          '& .MuiTabs-indicator': { bgcolor: colorPalette.primary, height: 2 },
          '& .MuiTab-root': {
            fontFamily: 'Jost', fontSize: '0.75rem', fontWeight: 600,
            textTransform: 'none', minHeight: 36, py: 0, px: 2.5,
            color: '#94a3b8',
            '&.Mui-selected': { color: colorPalette.primary },
          },
        }}
      >
        <Tab label="Request" />
        <Tab label="Response" />
        <Tab label="Metadata" />
      </Tabs>

      <Box sx={{ p: 2.5 }}>
        {tab === 0 && (
          <Stack gap={2}>
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', letterSpacing: '0.1em', mb: 0.75 }}>
                HEADERS
              </Typography>
              <CodeBlock content={d.requestHeaders ?? ''} copyLabel="Copy headers" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', letterSpacing: '0.1em', mb: 0.75 }}>
                BODY
              </Typography>
              <CodeBlock content={reqBody} copyLabel="Copy payload" />
            </Box>
          </Stack>
        )}

        {tab === 1 && (
          <Stack gap={2}>
            {d.status === 'failed' && d.errorMessage && (
              <Box sx={{ px: 2, py: 1.5, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', mb: 0.25 }}>Connection error</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {d.errorMessage}
                </Typography>
              </Box>
            )}
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', letterSpacing: '0.1em', mb: 0.75 }}>
                HEADERS
              </Typography>
              <CodeBlock content={d.responseHeaders ?? '(no response headers)'} copyLabel="Copy headers" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', letterSpacing: '0.1em', mb: 0.75 }}>
                BODY
              </Typography>
              <CodeBlock content={respBody || '(no response body)'} copyLabel="Copy body" />
            </Box>
          </Stack>
        )}

        {tab === 2 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {[
              ['Delivery ID', d.deliveryId ?? '—'],
              ['Event type', d.eventType],
              ['Status', d.status],
              ['HTTP code', d.responseCode != null ? String(d.responseCode) : '—'],
              ['Duration', fmtDuration(d.durationMs)],
              ['Attempt count', String(d.attemptCount)],
              ['Delivered at', d.deliveredAt ? new Date(d.deliveredAt).toLocaleString() : '—'],
              ['Queued at', new Date(d.createdAt).toLocaleString()],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', mb: 0.25 }}>
                  {label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', color: 'var(--heading-color)', wordBreak: 'break-all' }}>
                    {value}
                  </Typography>
                  {label === 'Delivery ID' && d.deliveryId && (
                    <CopyBtn text={d.deliveryId} label="Copy" />
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ── Delivery row ──────────────────────────────────────────────────────────────

function DeliveryRow({ d, endpointUrl }: { d: WebhookDelivery; endpointUrl: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Box sx={{ borderBottom: '1px solid var(--border-col)', '&:last-child': { borderBottom: 'none' } }}>
      <Box
        onClick={() => setExpanded(p => !p)}
        sx={{
          px: 3, py: 1.5,
          display: 'grid',
          gridTemplateColumns: '120px 1fr 130px 90px 56px 80px 80px 32px',
          gap: 1.5, alignItems: 'center',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'var(--section-bg)' },
          transition: 'background 0.15s',
        }}
      >
        {/* Delivery ID */}
        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: 'var(--on-surface-variant)' }}>
          {shortId(d.deliveryId)}
        </Typography>

        {/* Endpoint URL */}
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--heading-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {endpointUrl}
        </Typography>

        {/* Event type */}
        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: 'var(--on-surface-variant)' }}>
          {d.eventType}
        </Typography>

        {/* Status */}
        <StatusBadge status={d.status} />

        {/* HTTP code */}
        <Typography sx={{
          fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', fontWeight: 600,
          color: d.responseCode == null ? '#94a3b8'
            : d.responseCode < 300 ? '#10b981'
              : d.responseCode < 500 ? '#f59e0b' : '#dc2626',
        }}>
          {d.responseCode ?? '—'}
        </Typography>

        {/* Duration */}
        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'SF Mono, Monaco, monospace' }}>
          {fmtDuration(d.durationMs)}
        </Typography>

        {/* Time */}
        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          {fmtRelative(d.createdAt)}
        </Typography>

        {/* Expand */}
        <IconButton size="small" disableRipple sx={{ borderRadius: 0, color: '#94a3b8', p: 0.25 }}>
          {expanded
            ? <ExpandLessRoundedIcon sx={{ fontSize: '1rem' }} />
            : <ExpandMoreRoundedIcon sx={{ fontSize: '1rem' }} />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <DeliveryDetail d={d} />
      </Collapse>
    </Box>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2, flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: color ?? '#00288e', fontFamily: 'Jost', letterSpacing: '-0.02em' }}>
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25 }}>{sub}</Typography>
      )}
    </Box>
  )
}

// ── Code samples ──────────────────────────────────────────────────────────────

const codeSamples: Record<string, string> = {
  'Node.js': `const crypto = require('crypto')
const express = require('express')
const app = express()

// Use raw body parser — you must verify the signature before parsing JSON
app.post('/webhooks/openiv', express.raw({ type: 'application/json' }), (req, res) => {
  const sig    = req.headers['x-openiv-signature']
  const secret = process.env.OPENIV_WEBHOOK_SECRET

  // Compute HMAC-SHA256 over the raw request body
  const expected = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex')

  // Always use timingSafeEqual to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const event = JSON.parse(req.body)
  console.log(\`[openiv] \${event.event} · \${event.id}\`)

  switch (event.event) {
    case 'tx.flagged':
      // event.data.transaction, event.data.risk, event.data.aml
      flagTransaction(event.data)
      break
    case 'tx.blocked':
      blockTransaction(event.data)
      break
    case 'case.opened':
      // event.data.case, event.data.trigger
      openCase(event.data)
      break
    case 'case.escalated':
      escalateCase(event.data)
      break
    case 'sar.filed':
      // event.data.report, event.data.subject
      recordSar(event.data)
      break
    case 'kyc.verified':
      // event.data.customer_id, event.data.bvn_received, event.data.nin_received
      handleKycVerified(event.data)
      break
    case 'kyc.partial':
      // event.data.customer_id, event.data.bvn_received, event.data.nin_received
      handleKycPartial(event.data)
      break
    case 'kyc.flagged':
      // event.data.customer_id, event.data.risk_reason, event.data.pep_match
      handleKycFlagged(event.data)
      break
  }

  res.status(200).json({ received: true })
})`,

  Python: `import hashlib, hmac, json, os
from flask import Flask, request, abort, jsonify

app = Flask(__name__)
OPENIV_SECRET = os.environ['OPENIV_WEBHOOK_SECRET'].encode('utf-8')

@app.route('/webhooks/openiv', methods=['POST'])
def handle_webhook():
    sig      = request.headers.get('X-Openiv-Signature', '')
    raw_body = request.get_data()   # must read raw bytes before any parsing

    expected = hmac.new(OPENIV_SECRET, raw_body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(sig, expected):
        abort(401)

    event = json.loads(raw_body)
    print(f"[openiv] {event['event']} · {event['id']}")

    handlers = {
        'tx.flagged':    flag_transaction,
        'tx.blocked':    block_transaction,
        'case.opened':   open_case,
        'case.escalated': escalate_case,
        'sar.filed':     record_sar,
        'kyc.verified':  handle_kyc_verified,
        'kyc.partial':   handle_kyc_partial,
        'kyc.flagged':   handle_kyc_flagged,
    }
    handler = handlers.get(event['event'])
    if handler:
        handler(event['data'])

    return jsonify(received=True), 200`,

  Go: `package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
)

var webhookSecret = []byte(os.Getenv("OPENIV_WEBHOOK_SECRET"))

func handleWebhook(w http.ResponseWriter, r *http.Request) {
    sig, _ := hex.DecodeString(r.Header.Get("X-Openiv-Signature"))

    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "bad request", 400)
        return
    }

    mac := hmac.New(sha256.New, webhookSecret)
    mac.Write(body)
    expected := mac.Sum(nil)

    // hmac.Equal does constant-time comparison
    if !hmac.Equal(sig, expected) {
        http.Error(w, "invalid signature", 401)
        return
    }

    var event map[string]json.RawMessage
    json.Unmarshal(body, &event)
    var eventType string
    json.Unmarshal(event["event"], &eventType)
    fmt.Printf("[openiv] %s\\n", eventType)

    switch eventType {
    case "tx.flagged":
        flagTransaction(event["data"])
    case "case.opened":
        openCase(event["data"])
    case "kyc.verified":
        handleKycVerified(event["data"])
    case "kyc.partial":
        handleKycPartial(event["data"])
    case "kyc.flagged":
        handleKycFlagged(event["data"])
    }

    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(\`{"received":true}\`))
}

func main() {
    http.HandleFunc("/webhooks/openiv", handleWebhook)
    http.ListenAndServe(":8080", nil)
}`,

  Java: `import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

@RestController
public class OpenIVWebhookController {

    private final String secret = System.getenv("OPENIV_WEBHOOK_SECRET");

    @PostMapping(value = "/webhooks/openiv",
                 consumes = "application/json")
    public ResponseEntity<?> handle(
            @RequestHeader("X-Openiv-Signature") String sig,
            @RequestBody byte[] rawBody,
            HttpServletRequest req) throws Exception {

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(
            secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));

        byte[] hash = mac.doFinal(rawBody);
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        String expected = sb.toString();

        // Constant-time comparison
        if (!MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                sig.getBytes(StandardCharsets.UTF_8))) {
            return ResponseEntity.status(401).build();
        }

        var payload = new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(rawBody);
        String event = payload.get("event").asText();
        System.out.printf("[openiv] %s · %s%n", event, payload.get("id").asText());

        switch (event) {
            case "tx.flagged"    -> flagTransaction(payload.get("data"));
            case "case.opened"   -> openCase(payload.get("data"));
            case "sar.filed"     -> recordSar(payload.get("data"));
            case "kyc.verified"  -> handleKycVerified(payload.get("data"));
            case "kyc.partial"   -> handleKycPartial(payload.get("data"));
            case "kyc.flagged"   -> handleKycFlagged(payload.get("data"));
        }

        return ResponseEntity.ok(Map.of("received", true));
    }
}`,

  PHP: `<?php
// webhook.php

$secret  = getenv('OPENIV_WEBHOOK_SECRET');
$rawBody = file_get_contents('php://input');
$sig     = $_SERVER['HTTP_X_OPENIV_SIGNATURE'] ?? '';

$expected = hash_hmac('sha256', $rawBody, $secret);

// hash_equals is constant-time — never use === for signature comparison
if (!hash_equals($expected, $sig)) {
    http_response_code(401);
    exit(json_encode(['error' => 'Invalid signature']));
}

$event = json_decode($rawBody, true);
error_log(sprintf('[openiv] %s · %s', $event['event'], $event['id']));

switch ($event['event']) {
    case 'tx.flagged':
        flagTransaction($event['data']);
        break;
    case 'tx.blocked':
        blockTransaction($event['data']);
        break;
    case 'case.opened':
        openCase($event['data']);
        break;
    case 'sar.filed':
        recordSar($event['data']);
        break;
    case 'kyc.verified':
        handleKycVerified($event['data']);
        break;
    case 'kyc.partial':
        handleKycPartial($event['data']);
        break;
    case 'kyc.flagged':
        handleKycFlagged($event['data']);
        break;
}

http_response_code(200);
echo json_encode(['received' => true]);`,

  '.NET': `using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapPost("/webhooks/openiv", async (HttpContext ctx) =>
{
    var secret = Environment.GetEnvironmentVariable("OPENIV_WEBHOOK_SECRET")!;
    var sig    = ctx.Request.Headers["X-Openiv-Signature"].ToString();

    // Read raw body before any middleware touches it
    using var reader = new StreamReader(ctx.Request.Body);
    var rawBody = await reader.ReadToEndAsync();

    using var hmac  = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
    var hash        = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody));
    var expected    = Convert.ToHexString(hash).ToLowerInvariant();

    // CryptographicOperations.FixedTimeEquals prevents timing attacks
    if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(sig)))
    {
        return Results.Unauthorized();
    }

    var payload = System.Text.Json.JsonDocument.Parse(rawBody);
    var eventType = payload.RootElement.GetProperty("event").GetString();
    Console.WriteLine($"[openiv] {eventType} · {payload.RootElement.GetProperty("id").GetString()}");

    return eventType switch
    {
        "tx.flagged"  => HandleFlaggedTx(payload),
        "case.opened" => HandleCaseOpened(payload),
        "kyc.verified" => HandleKycVerified(payload),
        "kyc.partial"  => HandleKycPartial(payload),
        "kyc.flagged"  => HandleKycFlagged(payload),
        _              => Results.Ok(new { received = true }),
    };
});

app.Run();`,
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WebhookBeamLogPage() {
  const navigate = useNavigate()

  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterEndpoint, setFilterEndpoint] = useState<string>('all')
  const [filterEvent, setFilterEvent] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Code samples
  const [codeLang, setCodeLang] = useState(0)
  const langs = Object.keys(codeSamples)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [delRes, epRes] = await Promise.all([
        webhookApi.listAllDeliveries(),
        webhookApi.list(),
      ])
      setDeliveries(delRes.deliveries)
      setEndpoints(epRes.endpoints)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Endpoint URL lookup
  const endpointMap = useMemo(() => {
    const m: Record<number, string> = {}
    endpoints.forEach(e => { m[e.id] = e.url })
    return m
  }, [endpoints])

  // Unique event types for filter dropdown
  const uniqueEvents = useMemo(() => {
    const s = new Set<string>()
    deliveries.forEach(d => s.add(d.eventType))
    return Array.from(s).sort()
  }, [deliveries])

  // Filtered deliveries
  const filtered = useMemo(() => {
    return deliveries.filter(d => {
      if (filterEndpoint !== 'all' && String(d.endpointId) !== filterEndpoint) return false
      if (filterEvent !== 'all' && d.eventType !== filterEvent) return false
      if (filterStatus !== 'all' && d.status !== filterStatus) return false
      return true
    })
  }, [deliveries, filterEndpoint, filterEvent, filterStatus])

  // Stats
  const stats = useMemo(() => {
    const total = deliveries.length
    const delivered = deliveries.filter(d => d.status === 'delivered').length
    const failed = deliveries.filter(d => d.status === 'failed').length
    const rate = total === 0 ? 100 : Math.round((delivered / total) * 1000) / 10
    const durations = deliveries.filter(d => d.durationMs != null).map(d => d.durationMs!)
    const avgMs = durations.length === 0 ? null
      : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    return { total, delivered, failed, rate, avgMs }
  }, [deliveries])

  const selectSx = {
    height: 36, fontSize: '0.8125rem', fontFamily: 'Jost',
    borderRadius: 0, bgcolor: 'var(--card-bg)',
    '& .MuiOutlinedInput-notchedOutline': { border: '1px solid var(--border-col)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colorPalette.primary, borderWidth: '1px' },
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
          onClick={() => navigate('/dashboard/webhooks')}
          sx={{
            fontSize: '0.75rem', fontFamily: 'Jost', fontWeight: 600,
            color: '#64748b', textTransform: 'none', px: 0, mb: 1.5,
            '&:hover': { bgcolor: 'transparent', color: colorPalette.primary },
          }}
        >
          Back to Webhooks
        </Button>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
          Developer Console
        </Typography>
        <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
          Beam Log
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
          Full request/response history for every outbound event delivery from OpenIV
        </Typography>
      </Box>

      {/* Stats */}
      <Stack direction="row" gap={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ flex: 1, minWidth: 120, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2 }}>
              <Skeleton height={16} width="60%" />
              <Skeleton height={36} width="40%" sx={{ mt: 0.5 }} />
            </Box>
          ))
        ) : (
          <>
            <StatCard label="TOTAL BEAMS" value={String(stats.total)} />
            <StatCard label="DELIVERED" value={String(stats.delivered)} sub={`${stats.rate}% success rate`} color="#10b981" />
            <StatCard label="FAILED" value={String(stats.failed)} color={stats.failed > 0 ? '#dc2626' : '#00288e'} />
            <StatCard label="SUCCESS RATE" value={`${stats.rate}%`} color={stats.rate >= 99 ? '#10b981' : stats.rate >= 95 ? '#f59e0b' : '#dc2626'} />
            <StatCard label="AVG DURATION" value={stats.avgMs != null ? fmtDuration(stats.avgMs) : '—'} sub="of successful deliveries" />
          </>
        )}
      </Stack>

      {/* Filter toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select value={filterEndpoint} onChange={e => setFilterEndpoint(e.target.value)} sx={selectSx} displayEmpty>
            <MenuItem value="all" sx={{ fontSize: '0.8125rem', fontFamily: 'Jost' }}>All endpoints</MenuItem>
            {endpoints.map(ep => (
              <MenuItem key={ep.id} value={String(ep.id)} sx={{ fontSize: '0.8125rem', fontFamily: 'Jost', maxWidth: 360 }}>
                <Typography sx={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ep.url}
                </Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <Select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} sx={selectSx} displayEmpty>
            <MenuItem value="all" sx={{ fontSize: '0.8125rem', fontFamily: 'Jost' }}>All events</MenuItem>
            {uniqueEvents.map(ev => (
              <MenuItem key={ev} value={ev} sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace' }}>{ev}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 130 }}>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} sx={selectSx} displayEmpty>
            <MenuItem value="all" sx={{ fontSize: '0.8125rem', fontFamily: 'Jost' }}>All statuses</MenuItem>
            <MenuItem value="delivered" sx={{ fontSize: '0.8125rem', fontFamily: 'Jost' }}>Delivered</MenuItem>
            <MenuItem value="failed" sx={{ fontSize: '0.8125rem', fontFamily: 'Jost' }}>Failed</MenuItem>
            <MenuItem value="pending" sx={{ fontSize: '0.8125rem', fontFamily: 'Jost' }}>Pending</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ flex: 1 }} />
        <Button
          startIcon={<RefreshRoundedIcon sx={{ fontSize: '1rem !important' }} />}
          onClick={load}
          disabled={loading}
          sx={{
            borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 600,
            fontSize: '0.8125rem', color: 'var(--on-surface-variant)', border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)',
            px: 2, py: 0.875, '&:hover': { bgcolor: 'var(--section-bg)' },
          }}
        >
          Refresh
        </Button>
      </Box>

      {/* Delivery table */}
      <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', mb: 4 }}>
        {/* Column headers */}
        <Box sx={{
          px: 3, py: 1.25,
          display: 'grid',
          gridTemplateColumns: '120px 1fr 130px 90px 56px 80px 80px 32px',
          gap: 1.5,
          borderBottom: '1px solid var(--border-col)',
          bgcolor: 'var(--section-bg)',
        }}>
          {['DELIVERY ID', 'ENDPOINT', 'EVENT TYPE', 'STATUS', 'CODE', 'DURATION', 'TIME', ''].map((h, i) => (
            <Typography key={i} sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em' }}>
              {h}
            </Typography>
          ))}
        </Box>

        {loading ? (
          <Stack>
            {Array.from({ length: 6 }).map((_, i) => (
              <Box key={i} sx={{ px: 3, py: 1.875, borderBottom: '1px solid var(--border-col)', display: 'flex', gap: 2 }}>
                <Skeleton variant="rectangular" width={100} height={16} />
                <Skeleton variant="rectangular" width="30%" height={16} />
                <Skeleton variant="rectangular" width={80} height={16} />
                <Skeleton variant="rectangular" width={60} height={16} />
              </Box>
            ))}
          </Stack>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              {deliveries.length === 0 ? 'No deliveries yet — send a test event to get started' : 'No deliveries match the current filters'}
            </Typography>
          </Box>
        ) : (
          filtered.map(d => (
            <DeliveryRow key={d.id} d={d} endpointUrl={endpointMap[d.endpointId] ?? `endpoint #${d.endpointId}`} />
          ))
        )}
      </Box>

      {/* Integration guide */}
      <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
            Integration Guide
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            How to receive and verify OpenIV beams in your stack. Always verify the HMAC-SHA256 signature before processing.
          </Typography>
        </Box>

        {/* Key headers reference */}
        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid var(--border-col)', bgcolor: 'var(--section-bg)' }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', letterSpacing: '0.1em', mb: 1.5 }}>
            REQUEST HEADERS
          </Typography>
          <Stack gap={0.75}>
            {[
              ['X-OpenIV-Signature', 'HMAC-SHA256 hex of the raw request body — verify this first'],
              ['X-OpenIV-Event', 'Event type: tx.flagged, case.opened, sar.filed, etc.'],
              ['X-OpenIV-Delivery', 'Unique delivery ID (beam_timestamp_random) for idempotency'],
              ['X-OpenIV-Institution', 'Your institution ID for multi-tenant setups'],
              ['X-OpenIV-Api-Key', 'Your per-endpoint API key if security rules are configured'],
              ['Content-Type', 'application/json; charset=utf-8'],
            ].map(([header, desc]) => (
              <Box key={header} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: colorPalette.primary, minWidth: 220, flexShrink: 0 }}>
                  {header}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{desc}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Language tabs */}
        <Box>
          <Box sx={{ display: 'flex', borderBottom: '1px solid var(--border-col)', bgcolor: 'var(--section-bg)' }}>
            {langs.map((lang, i) => (
              <Box
                key={lang}
                onClick={() => setCodeLang(i)}
                sx={{
                  px: 2.5, py: 1.25, cursor: 'pointer', fontSize: '0.8125rem',
                  fontFamily: 'Jost', fontWeight: codeLang === i ? 700 : 500,
                  color: codeLang === i ? colorPalette.primary : '#64748b',
                  borderBottom: codeLang === i ? `2px solid ${colorPalette.primary}` : '2px solid transparent',
                  transition: 'all 0.15s',
                  '&:hover': { color: colorPalette.primary },
                }}
              >
                {lang}
              </Box>
            ))}
          </Box>
          <Box sx={{ p: 3 }}>
            <CodeBlock content={codeSamples[langs[codeLang]] ?? ''} copyLabel="Copy code" highlight />
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 1.5 }}>
              Tip: use the delivery ID (<code style={{ fontFamily: 'monospace' }}>X-OpenIV-Delivery</code>) as an idempotency key to safely retry failed processing without duplicating side-effects.
            </Typography>
          </Box>
        </Box>

        {/* Payload structure */}
        <Box sx={{ px: 3, py: 2.5, borderTop: '1px solid var(--border-col)' }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', letterSpacing: '0.1em', mb: 1.5 }}>
            ENVELOPE STRUCTURE
          </Typography>
          <CodeBlock highlight content={`{
  "id":          "beam_1719000000000_xR4kLmN9",   // Delivery ID — use for idempotency
  "event":       "tx.flagged",                      // Event type
  "version":     "2024-01",                         // Payload schema version
  "timestamp":   "2024-06-21T14:30:00Z",
  "institution": { "id": 1 },
  "environment": "production",                      // "production" | "sandbox"
  "data": {
    // ── tx.flagged / tx.blocked ──────────────────────
    "transaction": {
      "reference":    "TXN-20240621-00001",
      "amount":       450000.00,
      "currency":     "NGN",
      "direction":    "debit",
      "channel":      "mobile",
      "status":       "flagged",
      "firstTimeBeneficiary": true
    },
    "risk": {
      "score":    87,                               // 0–100; ≥75 = high risk
      "level":    "HIGH",
      "signals":  [
        { "code": "VELOCITY_BREACH",  "weight": 0.4 },
        { "code": "AMOUNT_SPIKE",     "weight": 0.3 },
        { "code": "NEW_BENEFICIARY",  "weight": 0.2 }
      ]
    },
    "aml": {
      "indicators": [
        { "code": "STRUCTURING",    "confidence": 0.72 },
        { "code": "PEP_EXPOSURE",   "confidence": 0.55 }
      ]
    },
    "pattern": {
      "velocity":      { "count1h": 3, "count24h": 8 },
      "avgAmount30d":  120000.00
    }
  }
}`} />
        </Box>
      </Box>
    </Box>
  )
}
