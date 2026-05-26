import { Box, Typography } from '@mui/material'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'

// ── Syntax highlighter ────────────────────────────────────────────────────────
const C = {
  keyword: '#c792ea', string: '#c3e88d', number: '#f78c6c',
  comment: '#637777', func: '#82aaff', env: '#ffcb6b',
  url: '#80cbc4', punct: '#89ddff', plain: '#d6deeb', operator: '#89ddff',
}
const KW_RE = new RegExp(
  `^(?:${['curl','const','let','var','import','from','require','async','await',
    'function','return','if','else','try','catch','throw','new','class','export',
    'default','def','for','in','with','pass','raise','as','elif','True','False',
    'None','func','package','type','struct','interface','public','static','void',
    'final','true','false','null','undefined','nil','bytes','json','http','os',
    'fmt','uuid','POST','GET','PUT','DELETE',
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
type Token = { text: string; color: string; italic?: boolean }
function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  let rest = code
  while (rest.length > 0) {
    let hit = false
    for (const { re, color, italic } of PATTERNS) {
      const m = re.exec(rest)
      if (m) { tokens.push({ text: m[0], color, italic }); rest = rest.slice(m[0].length); hit = true; break }
    }
    if (!hit) {
      const last = tokens[tokens.length - 1]
      if (last && last.color === C.plain && !last.italic) last.text += rest[0]
      else tokens.push({ text: rest[0], color: C.plain })
      rest = rest.slice(1)
    }
  }
  return tokens
}

function CodePane({ code, maxHeight = 400 }: { code: string; maxHeight?: number }) {
  const [copied, setCopied] = useState(false)
  const tokens = useMemo(() => tokenize(code), [code])
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800) }
  return (
    <Box sx={{ position: 'relative', bgcolor: '#011627', border: '1px solid #1e3a5f' }}>
      <Box sx={{ p: 2, overflowX: 'auto', overflowY: 'auto', maxHeight,
        fontFamily: '"Fira Code", "SF Mono", Monaco, Consolas, monospace',
        fontSize: '0.8rem', lineHeight: 1.8 }}>
        {tokens.map((t, i) => (
          <Box key={i} component="span"
            sx={{ color: t.color, fontStyle: t.italic ? 'italic' : 'normal', whiteSpace: 'pre' }}>
            {t.text}
          </Box>
        ))}
      </Box>
      <Box onClick={copy} sx={{
        position: 'absolute', top: 8, right: 8, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 0.5,
        px: 1, py: 0.375, bgcolor: '#0d2137', border: '1px solid #1e3a5f',
        color: copied ? '#10b981' : '#5e7fa0', fontSize: '0.7rem', fontFamily: 'Jost',
        fontWeight: 600, userSelect: 'none', '&:hover': { color: '#d6deeb', borderColor: '#4a7fa5' },
      }}>
        {copied
          ? <CheckRoundedIcon sx={{ fontSize: '0.75rem' }} />
          : <ContentCopyOutlinedIcon sx={{ fontSize: '0.75rem' }} />}
        {copied ? 'Copied' : 'Copy'}
      </Box>
    </Box>
  )
}

// ── Method badge ──────────────────────────────────────────────────────────────
const METHOD_COLORS: Record<string, { bg: string; color: string }> = {
  POST:   { bg: '#1a3a5c', color: '#61afef' },
  GET:    { bg: '#1a3a2c', color: '#98c379' },
  DELETE: { bg: '#3a1a1a', color: '#e06c75' },
}
function MethodBadge({ method }: { method: string }) {
  const c = METHOD_COLORS[method] ?? METHOD_COLORS.POST
  return (
    <Box sx={{ px: 1, py: 0.25, bgcolor: c.bg, border: `1px solid ${c.color}40`, flexShrink: 0 }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: c.color,
        fontFamily: '"Fira Code", "SF Mono", monospace', letterSpacing: '0.04em' }}>
        {method}
      </Typography>
    </Box>
  )
}

// ── URL bar ───────────────────────────────────────────────────────────────────
function UrlBar({ method, path }: { method: string; path: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
      bgcolor: '#f8fafc', border: '1px solid #e2e8f0', mb: 3 }}>
      <MethodBadge method={method} />
      <Typography sx={{
        fontFamily: '"Fira Code", "SF Mono", monospace', fontSize: '0.875rem',
        color: '#1e293b', letterSpacing: '0.01em',
      }}>
        <Box component="span" sx={{ color: '#94a3b8' }}>https://api.openiv.ng</Box>
        {path}
      </Typography>
    </Box>
  )
}

// ── Schema table ──────────────────────────────────────────────────────────────
interface Field { name: string; type: string; required: boolean; desc: string }
function SchemaTable({ fields }: { fields: Field[] }) {
  return (
    <Box sx={{ border: '1px solid #e2e8f0', overflow: 'hidden', mb: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '140px 130px 60px 1fr',
        bgcolor: '#f8fafc', px: 2, py: 1, borderBottom: '1px solid #e2e8f0' }}>
        {['Field', 'Type', 'Req.', 'Description'].map(h => (
          <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</Typography>
        ))}
      </Box>
      {fields.map((f, i) => (
        <Box key={f.name} sx={{
          display: 'grid', gridTemplateColumns: '140px 130px 60px 1fr',
          px: 2, py: 1.25, alignItems: 'start',
          bgcolor: i % 2 === 0 ? '#ffffff' : '#f8fafc',
          borderBottom: i < fields.length - 1 ? '1px solid #f1f5f9' : 'none',
        }}>
          <Typography sx={{ fontFamily: '"Fira Code", monospace', fontSize: '0.8rem',
            color: '#059669', fontWeight: 600 }}>{f.name}</Typography>
          <Typography sx={{ fontFamily: '"Fira Code", monospace', fontSize: '0.75rem',
            color: '#7c3aed' }}>{f.type}</Typography>
          <Box>
            {f.required
              ? <Box sx={{ display: 'inline', px: 0.75, py: 0.125, bgcolor: '#dcfce7', color: '#16a34a',
                  fontSize: '0.625rem', fontWeight: 700 }}>yes</Box>
              : <Box sx={{ display: 'inline', px: 0.75, py: 0.125, bgcolor: '#f1f5f9', color: '#94a3b8',
                  fontSize: '0.625rem', fontWeight: 700 }}>no</Box>}
          </Box>
          <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>{f.desc}</Typography>
        </Box>
      ))}
    </Box>
  )
}

// ── Response tabs ─────────────────────────────────────────────────────────────
interface ResponseExample { status: number; label: string; body: string }
function ResponseTabs({ examples }: { examples: ResponseExample[] }) {
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const STATUS_COLOR: Record<number, string> = { 200: '#16a34a', 400: '#d97706', 401: '#dc2626', 500: '#dc2626' }
  const STATUS_BG: Record<number, string>    = { 200: '#dcfce7',  400: '#fef3c7',  401: '#fee2e2',  500: '#fee2e2' }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = examples[active]
  const color = STATUS_COLOR[current.status] ?? '#2563eb'
  const bg    = STATUS_BG[current.status]    ?? '#eff6ff'

  return (
    <Box>
      {/* Dropdown trigger */}
      <Box ref={ref} sx={{ position: 'relative', px: 2, py: 1.25,
        bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <Box onClick={() => setOpen(o => !o)} sx={{
          display: 'inline-flex', alignItems: 'center', gap: 1, cursor: 'pointer',
          px: 1.25, py: 0.5, bgcolor: '#ffffff',
          border: '1px solid #e2e8f0', borderRadius: '4px',
          userSelect: 'none', minWidth: 220,
          justifyContent: 'space-between',
          '&:hover': { borderColor: '#cbd5e1' },
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ px: 0.75, py: 0.125, bgcolor: bg, borderRadius: '3px' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color,
                fontFamily: '"Fira Code", monospace', lineHeight: 1.6 }}>
                {current.status}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151', fontFamily: 'Jost' }}>
              {current.label}
            </Typography>
          </Box>
          <Box sx={{
            fontSize: '0.625rem', color: '#9ca3af', lineHeight: 1,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}>▼</Box>
        </Box>

        {/* Dropdown menu */}
        {open && (
          <Box sx={{
            position: 'absolute', top: '100%', left: 16, zIndex: 50,
            bgcolor: '#ffffff', border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            minWidth: 260, mt: 0.25,
          }}>
            {examples.map((ex, i) => {
              const c = STATUS_COLOR[ex.status] ?? '#2563eb'
              const b = STATUS_BG[ex.status] ?? '#eff6ff'
              return (
                <Box key={i} onClick={() => { setActive(i); setOpen(false) }} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25,
                  px: 1.5, py: 1, cursor: 'pointer',
                  bgcolor: active === i ? '#f8fafc' : '#ffffff',
                  borderLeft: active === i ? `2px solid ${c}` : '2px solid transparent',
                  '&:hover': { bgcolor: '#f8fafc' },
                }}>
                  <Box sx={{ px: 0.75, py: 0.125, bgcolor: b, borderRadius: '3px', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: c,
                      fontFamily: '"Fira Code", monospace', lineHeight: 1.6 }}>
                      {ex.status}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.8125rem', color: active === i ? '#111827' : '#4b5563',
                    fontFamily: 'Jost', fontWeight: active === i ? 600 : 400 }}>
                    {ex.label}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>

      <CodePane code={current.body} maxHeight={280} />
    </Box>
  )
}

// ── Endpoint section ──────────────────────────────────────────────────────────
interface EndpointDef {
  id: string
  method: string
  path: string
  title: string
  summary: string
  description: string
  requestFields: Field[]
  requestExample: string
  responses: ResponseExample[]
  codeSamples: Record<string, string>
}

function EndpointSection({ ep }: { ep: EndpointDef }) {
  const langs = ['cURL', 'Node.js', 'Python', 'Go', 'Java']
  const [lang, setLang] = useState('cURL')

  return (
    <Box id={ep.id} sx={{ mb: 0, scrollMarginTop: 80 }}>
      {/* Title row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <MethodBadge method={ep.method} />
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
          {ep.title}
        </Typography>
      </Box>

      <Typography sx={{ fontSize: '0.9rem', color: '#475569', mb: 2.5, lineHeight: 1.7, maxWidth: 680 }}>
        {ep.description}
      </Typography>

      {/* URL bar */}
      <UrlBar method={ep.method} path={ep.path} />

      {/* Two-column: request left, response right */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        {/* Left — request */}
        <Box>
          <SectionLabel>Request headers</SectionLabel>
          <SchemaTable fields={[
            { name: 'Authorization', type: 'string', required: true,  desc: 'Bearer <your-api-key>' },
            { name: 'Content-Type',  type: 'string', required: true,  desc: 'application/json' },
            { name: 'X-Idempotency-Key', type: 'string', required: false, desc: 'UUID v4 — prevents duplicate processing on retry' },
          ]} />

          {ep.requestFields.length > 0 && (
            <>
              <SectionLabel>Request body</SectionLabel>
              <SchemaTable fields={ep.requestFields} />
            </>
          )}

          <SectionLabel>Example request</SectionLabel>
          <Box sx={{ display: 'flex', bgcolor: '#1a2332', borderBottom: '1px solid #1e3a5f' }}>
            {langs.map(l => (
              <Box key={l} onClick={() => setLang(l)} sx={{
                px: 1.5, py: 0.75, cursor: 'pointer', fontSize: '0.75rem',
                fontWeight: 600, fontFamily: 'Jost',
                color: lang === l ? '#61afef' : '#5e7fa0',
                borderBottom: lang === l ? '2px solid #61afef' : '2px solid transparent',
                mb: '-1px', '&:hover': { color: '#d6deeb' },
              }}>{l}</Box>
            ))}
          </Box>
          <CodePane code={ep.codeSamples[lang] ?? ep.codeSamples['cURL']} />
        </Box>

        {/* Right — responses */}
        <Box>
          <SectionLabel>Responses</SectionLabel>
          <Box sx={{ border: '1px solid #e2e8f0' }}>
            <ResponseTabs examples={ep.responses} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b',
      textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1.25, mt: 2.5 }}>
      {children}
    </Typography>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
interface SidebarGroup { label: string; color: string; items: { id: string; method: string; path: string }[] }

function Sidebar({ groups, activeId, onSelect }: {
  groups: SidebarGroup[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <Box sx={{
      width: 260, flexShrink: 0, bgcolor: '#00288e',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      position: 'sticky', top: 0, height: '100vh',
      overflowY: 'auto', pt: 2.5, pb: 4,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(255,255,255,0.2) transparent',
    }}>
      {/* Logo / title */}
      <Box sx={{ px: 2.5, mb: 3.5 }}>
        <Box component={Link} to="/" sx={{ textDecoration: 'none' }}>
          <Box sx={{ position: 'relative', display: 'inline-block' }}>
            <Box sx={{ position: 'absolute', top: -4, left: 0, width: 24, height: '2px', bgcolor: '#ffffff', borderRadius: '1px' }} />
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Jost', letterSpacing: '0.1em' }}>
              OPENIV
            </Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 1, px: 0.75, py: 0.25, bgcolor: 'rgba(255,255,255,0.12)', display: 'inline-block' }}>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em' }}>
            v1  ·  REST
          </Typography>
        </Box>
      </Box>

      {/* Auth link */}
      <Box onClick={() => onSelect('authentication')} sx={{
        px: 2.5, py: 0.875, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
        bgcolor: activeId === 'authentication' ? 'rgba(255,255,255,0.12)' : 'transparent',
        borderLeft: activeId === 'authentication' ? '2px solid #d9f99d' : '2px solid transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
      }}>
        <Typography sx={{
          fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
          color: activeId === 'authentication' ? '#d9f99d' : 'rgba(255,255,255,0.7)',
        }}>
          Authentication
        </Typography>
      </Box>

      {/* Dashboard / auth nav */}
      <Box component={Link} to="/dashboard" sx={{
        px: 2.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1,
        textDecoration: 'none', borderLeft: '2px solid transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
      }}>
        <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'Jost', fontWeight: 500,
          color: 'rgba(255,255,255,0.65)' }}>
          Dashboard
        </Typography>
      </Box>

      <Box component={Link} to="/auth/login" sx={{
        px: 2.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1,
        textDecoration: 'none', borderLeft: '2px solid transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
      }}>
        <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'Jost', fontWeight: 500,
          color: 'rgba(255,255,255,0.65)' }}>
          Sign in
        </Typography>
      </Box>

      <Box component={Link} to="/request-access" sx={{
        px: 3.5, py: 0.625, display: 'flex', alignItems: 'center', gap: 1,
        textDecoration: 'none', borderLeft: '2px solid transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
      }}>
        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'Jost', fontWeight: 400,
          color: 'rgba(255,255,255,0.45)' }}>
          Request access
        </Typography>
      </Box>

      <Box sx={{ my: 1.5, mx: 2.5, height: '1px', bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Groups */}
      {groups.map(g => (
        <Box key={g.label} sx={{ mt: 2.5 }}>
          <Typography sx={{ px: 2.5, fontSize: '0.625rem', fontWeight: 800,
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase', letterSpacing: '0.14em', mb: 0.75 }}>
            {g.label}
          </Typography>
          {g.items.map(item => {
            const mc = METHOD_COLORS[item.method] ?? METHOD_COLORS.POST
            const isActive = activeId === item.id
            return (
              <Box key={item.id} onClick={() => onSelect(item.id)} sx={{
                px: 2.5, py: 0.875, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 1.25,
                bgcolor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                borderLeft: isActive ? '2px solid #d9f99d' : '2px solid transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
              }}>
                <Box sx={{ px: 0.625, bgcolor: 'rgba(255,255,255,0.1)', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: mc.color,
                    fontFamily: '"Fira Code", monospace', lineHeight: 1.6 }}>
                    {item.method}
                  </Typography>
                </Box>
                <Typography sx={{
                  fontFamily: '"Fira Code", monospace', fontSize: '0.75rem',
                  color: isActive ? '#d9f99d' : 'rgba(255,255,255,0.65)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.path.replace('/api/v1', '')}
                </Typography>
              </Box>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

// ── Endpoint definitions ──────────────────────────────────────────────────────
const BASE = 'https://api.openiv.ng/api/v1'

function curl(path: string, body: object) {
  return `curl -X POST ${BASE}${path} \\
  -H "Authorization: Bearer $OPENIV_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "X-Idempotency-Key: $(uuidgen)" \\
  -d '${JSON.stringify(body, null, 2)}'`
}
function node(path: string, body: object, fn: string) {
  return `const axios = require('axios')
const { v4: uuid } = require('uuid')

const client = axios.create({
  baseURL: '${BASE}',
  headers: { Authorization: \`Bearer \${process.env.OPENIV_API_KEY}\` },
})

const { data } = await client.post('${path}', ${JSON.stringify(body, null, 2)},
  { headers: { 'X-Idempotency-Key': uuid() } })

// data.${fn}`
}
function python(path: string, body: object) {
  return `import httpx, uuid, os

client = httpx.Client(
    base_url='${BASE}',
    headers={'Authorization': f'Bearer {os.environ["OPENIV_API_KEY"]}'},
)

r = client.post('${path}',
    json=${JSON.stringify(body, null, 4).replace(/"/g, "'")},
    headers={'X-Idempotency-Key': str(uuid.uuid4())},
)
r.raise_for_status()
print(r.json())`
}
function golang(path: string, body: object) {
  const fields = Object.entries(body).map(([k, v]) =>
    `    "${k}": ${typeof v === 'string' ? `"${v}"` : v},`
  ).join('\n')
  return `req, _ := http.NewRequest("POST", "${BASE}${path}", bytes.NewBufferString(\`
{
${fields}
}\`))
req.Header.Set("Authorization", "Bearer "+os.Getenv("OPENIV_API_KEY"))
req.Header.Set("Content-Type", "application/json")
req.Header.Set("X-Idempotency-Key", uuid.New().String())
resp, _ := http.DefaultClient.Do(req)`
}
function java(path: string, body: object) {
  const json = JSON.stringify(body, null, 4).replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')
  return `import java.net.URI;
import java.net.http.*;
import java.net.http.HttpResponse.BodyHandlers;

String body = """
${json}
        """;

var request = HttpRequest.newBuilder()
    .uri(URI.create("${BASE}${path}"))
    .header("Authorization", "Bearer " + System.getenv("OPENIV_API_KEY"))
    .header("Content-Type", "application/json")
    .header("X-Idempotency-Key", java.util.UUID.randomUUID().toString())
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();

var response = HttpClient.newHttpClient().send(request, BodyHandlers.ofString());
System.out.println(response.body());`
}

const ENDPOINTS: EndpointDef[] = [
  // ── Data Ingest ──────────────────────────────────────────────────────────
  {
    id: 'ingest-transactions',
    method: 'POST', path: '/api/v1/beam/transactions',
    title: 'Ingest Transaction',
    summary: 'Send a single transaction event for real-time fraud scoring',
    description: 'Send every credit, debit, transfer, or FX transaction the moment it lands on your core — even before settlement. OpenIV scores risk, checks against AML rules, and can auto-open a case in under 14ms.',
    requestFields: [
      { name: 'customer_id',       type: 'string',   required: true,  desc: 'Your internal customer identifier' },
      { name: 'customer_name',     type: 'string',   required: true,  desc: 'Full name of the customer' },
      { name: 'amount',            type: 'integer',  required: true,  desc: 'Transaction amount in kobo (e.g. ₦14,250 = 1425000)' },
      { name: 'channel',           type: 'enum',     required: true,  desc: 'wire | mobile | transfer | atm | pos | ussd | bdc | other' },
      { name: 'counterparty',      type: 'string',   required: true,  desc: 'Name of the counterparty' },
      { name: 'status',            type: 'enum',     required: true,  desc: 'pending | completed | failed | declined' },
      { name: 'location',          type: 'string',   required: true,  desc: 'Human-readable location (e.g. "Lagos, NG")' },
      { name: 'lat',               type: 'number',   required: true,  desc: 'Latitude of the transaction origin' },
      { name: 'lng',               type: 'number',   required: true,  desc: 'Longitude of the transaction origin' },
      { name: 'occurred_at',       type: 'ISO 8601', required: true,  desc: 'UTC timestamp when the event occurred' },
      { name: 'sender_account',    type: 'string',   required: true,  desc: 'Sender account number' },
      { name: 'sender_bank',       type: 'string',   required: true,  desc: 'Sender bank name' },
      { name: 'recipient_name',    type: 'string',   required: true,  desc: 'Recipient full name' },
      { name: 'recipient_account', type: 'string',   required: true,  desc: 'Recipient account number' },
      { name: 'recipient_bank',    type: 'string',   required: true,  desc: 'Recipient bank name' },
      { name: 'currency',          type: 'string',   required: true,  desc: 'ISO 4217 currency code (e.g. NGN)' },
      { name: 'narration',         type: 'string',   required: true,  desc: 'Transaction narration or description' },
      { name: 'device_id',         type: 'string',   required: true,  desc: 'Device fingerprint ID initiating the transaction' },
      { name: 'ip_address',        type: 'string',   required: true,  desc: 'IP address of the originating request' },
      { name: 'direction',         type: 'enum',     required: false, desc: 'outward | inward' },
      { name: 'category',          type: 'string',   required: false, desc: 'Transaction category (e.g. salary, rent)' },
      { name: 'customer_kyc_tier', type: 'integer',  required: false, desc: 'KYC tier 1–3 if already known' },
    ],
    requestExample: JSON.stringify({
      customer_id: 'CUS-001', customer_name: 'Adamu Ibrahim',
      amount: 14250000, channel: 'wire', counterparty: 'Sokoto BDC Ltd',
      status: 'pending', location: 'Sokoto', lat: 13.0059, lng: 5.2476,
      occurred_at: '2026-05-01T17:56:29Z',
      sender_account: '0124567890', sender_bank: 'Access Bank',
      recipient_name: 'Sokoto BDC Ltd', recipient_account: '0034567891',
      recipient_bank: 'GTBank', currency: 'NGN',
      narration: 'FX Settlement — USD Purchase',
      device_id: 'dev_a1b2c3', ip_address: '102.89.45.67',
    }, null, 2),
    responses: [
      { status: 200, label: 'Accepted', body: JSON.stringify({
          ok: true, record_id: 12345, stream: 'transactions', status: 'pending',
          analysis: {
            transaction_id: 'beam-12345', risk_score: 12,
            transaction_risk_score: 8, kyc_risk_score: 5,
            risk_level: 'LOW', recommended_action: 'ACCEPT',
            case_id: null, priority: null, account_conflict: false,
            direction: 'outward', institution_kyc_tier: 2,
            processed_at: '2026-05-01T18:01:23+01:00',
          },
        }, null, 2) },
      { status: 200, label: 'Flagged / Case opened', body: JSON.stringify({
          ok: true, record_id: 12346, stream: 'transactions', status: 'pending',
          analysis: {
            transaction_id: 'beam-12346', risk_score: 87,
            transaction_risk_score: 79, kyc_risk_score: 72,
            risk_level: 'CRITICAL', recommended_action: 'DECLINE',
            case_id: 'case-7d8e9f', priority: 'HIGH',
            account_conflict: false, direction: 'outward',
            institution_kyc_tier: 1,
            processed_at: '2026-05-01T18:01:24+01:00',
          },
        }, null, 2) },
      { status: 200, label: 'Rejected (no KYC)', body: JSON.stringify({
          ok: true, record_id: 12347, stream: 'transactions', status: 'pending',
          analysis: {
            transaction_id: 'beam-12347', rejected: true,
            recommended_action: 'REJECTED', reason: 'unknown_customer',
            account_conflict: false,
            message: "Customer 'CUS-001' is not registered and could not be retrieved via the customer fetch webhook. Transactions from unverified customers are not accepted. Please beam the customer's KYC before beaming transactions.",
            processed_at: '2026-05-01T18:01:24+01:00',
          },
        }, null, 2) },
      { status: 400, label: 'Bad request', body: JSON.stringify({ error: "Missing required field 'occurred_at'. Provide the transaction timestamp in ISO-8601 format." }, null, 2) },
      { status: 401, label: 'Unauthorized', body: JSON.stringify({ error: 'invalid_api_key_or_session' }, null, 2) },
    ],
    codeSamples: {
      'cURL': curl('/beam/transactions', { customer_id: 'CUS-001', amount: 14250000, channel: 'wire', status: 'pending', occurred_at: '2026-05-01T17:56:29Z' }),
      'Node.js': node('/beam/transactions', { customer_id: 'CUS-001', amount: 14250000, channel: 'wire' }, 'ok'),
      'Python': python('/beam/transactions', { customer_id: 'CUS-001', amount: 14250000, channel: 'wire' }),
      'Go': golang('/beam/transactions', { customer_id: 'CUS-001', amount: 14250000, channel: 'wire' }),
      'Java': java('/beam/transactions', { customer_id: 'CUS-001', amount: 14250000, channel: 'wire', status: 'pending', occurred_at: '2026-05-01T17:56:29Z' }),
    },
  },
  {
    id: 'ingest-kyc',
    method: 'POST', path: '/api/v1/beam/kyc',
    title: 'Ingest Customer KYC',
    summary: 'Submit customer identity records for KYC tier assignment',
    description: 'Send BVN, NIN, and an optional biometric photo. OpenIV assigns a KYC tier, adjusts risk scores on all future transactions for that customer, and runs a PEP cross-check. Without this, customers default to Tier 0 (unverified) with minimal transaction limits.',
    requestFields: [
      { name: 'customer_id',       type: 'string',  required: true,  desc: 'Your internal customer identifier' },
      { name: 'customer_kyc_tier', type: 'integer', required: true,  desc: 'Intended KYC tier (1, 2, or 3)' },
      { name: 'occurred_at',       type: 'ISO 8601', required: true, desc: 'UTC timestamp of KYC submission' },
      { name: 'name',              type: 'string',  required: false, desc: 'Customer full name for cross-check' },
      { name: 'bvn',               type: 'string',  required: false, desc: '11-digit Bank Verification Number' },
      { name: 'nin',               type: 'string',  required: false, desc: '11-digit National Identification Number' },
      { name: 'photo',             type: 'string',  required: false, desc: 'Base64-encoded biometric photo (JPEG/PNG)' },
      { name: 'monthly_inflow',    type: 'integer', required: false, desc: 'Expected monthly inflow in kobo' },
      { name: 'monthly_outflow',   type: 'integer', required: false, desc: 'Expected monthly outflow in kobo' },
    ],
    requestExample: JSON.stringify({
      customer_id: 'CUST-001', customer_kyc_tier: 2,
      occurred_at: '2026-05-14T10:00:00Z',
      name: 'Adamu Ibrahim', bvn: '22123456789', nin: '12345678901',
      monthly_inflow: 5000000, monthly_outflow: 3200000,
    }, null, 2),
    responses: [
      { status: 200, label: 'Verified — clear', body: JSON.stringify({
          ok: true, record_id: 12348, stream: 'kyc', status: 'pending',
          analysis: {
            customer_id: 'CUST-001', kyc_status: 'verified',
            knowledge_level: 'FULL', institution_kyc_tier: 2,
            risk_score: 23, action: 'clear',
            bvn_received: true, nin_received: true, photo_received: false,
            pipeline_ms: 342,
            steps: [
              { step: 'bvn_nin',      status: 'passed',  detail: 'BVN verified — Adamu Ibrahim',   durationMs: 180 },
              { step: 'phone_match',  status: 'passed',  detail: 'Phone matches BVN record',         durationMs: 62 },
              { step: 'liveness',     status: 'skipped', detail: 'No photo provided',                durationMs: 0 },
              { step: 'pep_check',    status: 'passed',  detail: 'No PEP matches found',             durationMs: 100 },
            ],
            processed_at: '2026-05-14T10:00:12+01:00',
          },
        }, null, 2) },
      { status: 200, label: 'Flagged — review', body: JSON.stringify({
          ok: true, record_id: 12349, stream: 'kyc', status: 'pending',
          analysis: {
            customer_id: 'CUST-002', kyc_status: 'flagged',
            knowledge_level: 'BASIC', institution_kyc_tier: 1,
            risk_score: 74, action: 'flagged',
            bvn_received: true, nin_received: false, photo_received: false,
            pipeline_ms: 220,
            steps: [
              { step: 'bvn_nin',      status: 'passed',  detail: 'BVN verified',                     durationMs: 180 },
              { step: 'phone_match',  status: 'failed',  detail: 'Phone does not match BVN record',   durationMs: 40 },
              { step: 'liveness',     status: 'skipped', detail: 'No photo provided',                 durationMs: 0 },
              { step: 'pep_check',    status: 'passed',  detail: 'No PEP matches found',              durationMs: 0 },
            ],
            processed_at: '2026-05-14T10:01:04+01:00',
          },
        }, null, 2) },
      { status: 400, label: 'Bad request', body: JSON.stringify({ error: "Missing required field 'customer_id'" }, null, 2) },
      { status: 401, label: 'Unauthorized', body: JSON.stringify({ error: 'invalid_api_key_or_session' }, null, 2) },
    ],
    codeSamples: {
      'cURL': curl('/beam/kyc', { customer_id: 'CUST-001', customer_kyc_tier: 2, bvn: '22123456789', occurred_at: '2026-05-14T10:00:00Z' }),
      'Node.js': node('/beam/kyc', { customer_id: 'CUST-001', customer_kyc_tier: 2, bvn: '22123456789' }, 'ok'),
      'Python': python('/beam/kyc', { customer_id: 'CUST-001', customer_kyc_tier: 2, bvn: '22123456789' }),
      'Go': golang('/beam/kyc', { customer_id: 'CUST-001', customer_kyc_tier: 2, bvn: '22123456789' }),
      'Java': java('/beam/kyc', { customer_id: 'CUST-001', customer_kyc_tier: 2, bvn: '22123456789', occurred_at: '2026-05-14T10:00:00Z' }),
    },
  },

  // ── Verification ──────────────────────────────────────────────────────────
  {
    id: 'verify-bvn',
    method: 'POST', path: '/api/v1/verify/bvn',
    title: 'Verify BVN',
    summary: 'Validate a Bank Verification Number and retrieve identity details',
    description: 'Looks up a BVN against the NIBSS identity database via Dojah. Returns the name, date of birth, and phone number on record. Use this during customer onboarding to confirm identity before assigning a KYC tier.',
    requestFields: [
      { name: 'bvn',          type: 'string', required: true,  desc: '11-digit Bank Verification Number' },
      { name: 'customer_ref', type: 'string', required: false, desc: 'Your internal reference — echoed back in the response for correlation' },
    ],
    requestExample: JSON.stringify({ bvn: '22123456789', customer_ref: 'CUS-001' }, null, 2),
    responses: [
      { status: 200, label: 'Verified', body: JSON.stringify({ verified: true, type: 'bvn', reference: '22123456789', customer_ref: 'CUS-001', first_name: 'Adamu', last_name: 'Ibrahim', middle_name: 'Yusuf', date_of_birth: '1990-03-15', phone: '+2348031234567', face_match: false, match_score: null }, null, 2) },
      { status: 200, label: 'Not found', body: JSON.stringify({ verified: false, type: 'bvn', reference: '22123456789', customer_ref: 'CUS-001', first_name: null, last_name: null, middle_name: null, date_of_birth: null, phone: null, face_match: false, match_score: null }, null, 2) },
      { status: 400, label: 'Bad request', body: JSON.stringify({ error: 'invalid_request', message: 'bvn is required' }, null, 2) },
      { status: 401, label: 'Unauthorized', body: JSON.stringify({ error: 'invalid_api_key_or_session' }, null, 2) },
    ],
    codeSamples: {
      'cURL': curl('/verify/bvn', { bvn: '22123456789', customer_ref: 'CUS-001' }),
      'Node.js': node('/verify/bvn', { bvn: '22123456789', customer_ref: 'CUS-001' }, 'verified'),
      'Python': python('/verify/bvn', { bvn: '22123456789', customer_ref: 'CUS-001' }),
      'Go': golang('/verify/bvn', { bvn: '22123456789', customer_ref: 'CUS-001' }),
      'Java': java('/verify/bvn', { bvn: '22123456789', customer_ref: 'CUS-001' }),
    },
  },
  {
    id: 'verify-nin',
    method: 'POST', path: '/api/v1/verify/nin',
    title: 'Verify NIN',
    summary: 'Validate a National Identification Number',
    description: 'Looks up a NIN against the NIMC database. Returns the registered name and date of birth. Useful for onboarding Tier 2/3 customers where NIN is required under CBN KYC guidelines.',
    requestFields: [
      { name: 'nin',          type: 'string', required: true,  desc: '11-digit National Identification Number' },
      { name: 'customer_ref', type: 'string', required: false, desc: 'Your internal reference — echoed back in the response' },
    ],
    requestExample: JSON.stringify({ nin: '12345678901', customer_ref: 'CUS-001' }, null, 2),
    responses: [
      { status: 200, label: 'Verified', body: JSON.stringify({ verified: true, type: 'nin', reference: '12345678901', customer_ref: 'CUS-001', first_name: 'Adamu', last_name: 'Ibrahim', middle_name: 'Yusuf', date_of_birth: '1990-03-15', phone: '+2348031234567', face_match: false, match_score: null }, null, 2) },
      { status: 400, label: 'Bad request', body: JSON.stringify({ error: 'invalid_request', message: 'nin is required' }, null, 2) },
      { status: 401, label: 'Unauthorized', body: JSON.stringify({ error: 'invalid_api_key_or_session' }, null, 2) },
    ],
    codeSamples: {
      'cURL': curl('/verify/nin', { nin: '12345678901', customer_ref: 'CUS-001' }),
      'Node.js': node('/verify/nin', { nin: '12345678901', customer_ref: 'CUS-001' }, 'verified'),
      'Python': python('/verify/nin', { nin: '12345678901', customer_ref: 'CUS-001' }),
      'Go': golang('/verify/nin', { nin: '12345678901', customer_ref: 'CUS-001' }),
      'Java': java('/verify/nin', { nin: '12345678901', customer_ref: 'CUS-001' }),
    },
  },
  {
    id: 'verify-phone',
    method: 'POST', path: '/api/v1/verify/phone',
    title: 'Verify Phone Number',
    summary: 'Validate a Nigerian mobile number and retrieve subscriber details',
    description: 'Checks a phone number against the NCC subscriber registry. Returns the registered name and network operator. Use this to detect SIM swaps, name mismatches, or unregistered SIMs during onboarding or high-value transactions.',
    requestFields: [
      { name: 'phone',        type: 'string', required: true,  desc: 'Nigerian mobile number in E.164 format (e.g. +2348031234567)' },
      { name: 'customer_ref', type: 'string', required: false, desc: 'Your internal reference — echoed back in the response' },
    ],
    requestExample: JSON.stringify({ phone: '+2348031234567', customer_ref: 'CUS-001' }, null, 2),
    responses: [
      { status: 200, label: 'Verified', body: JSON.stringify({ verified: true, type: 'phone', reference: '+2348031234567', customer_ref: 'CUS-001', first_name: 'Adamu', last_name: 'Ibrahim', middle_name: null, date_of_birth: null, phone: '+2348031234567', face_match: false, match_score: null }, null, 2) },
      { status: 400, label: 'Bad request', body: JSON.stringify({ error: 'invalid_request', message: 'phone is required' }, null, 2) },
      { status: 401, label: 'Unauthorized', body: JSON.stringify({ error: 'invalid_api_key_or_session' }, null, 2) },
    ],
    codeSamples: {
      'cURL': curl('/verify/phone', { phone: '+2348031234567', customer_ref: 'CUS-001' }),
      'Node.js': node('/verify/phone', { phone: '+2348031234567', customer_ref: 'CUS-001' }, 'verified'),
      'Python': python('/verify/phone', { phone: '+2348031234567', customer_ref: 'CUS-001' }),
      'Go': golang('/verify/phone', { phone: '+2348031234567', customer_ref: 'CUS-001' }),
      'Java': java('/verify/phone', { phone: '+2348031234567', customer_ref: 'CUS-001' }),
    },
  },
  {
    id: 'verify-pep',
    method: 'POST', path: '/api/v1/verify/pep',
    title: 'PEP Screening',
    summary: 'Screen a person against global Politically Exposed Persons lists',
    description: 'Checks a name (and optional date of birth) against global PEP, sanctions, and adverse media databases. Returns a match list with risk levels and known positions. Required for onboarding under CBN AML/CFT guidelines before opening accounts for any individual.',
    requestFields: [
      { name: 'name', type: 'string', required: true,  desc: 'Full name of the individual to screen' },
      { name: 'dob',  type: 'string', required: false, desc: 'Date of birth (YYYY-MM-DD) — narrows results and reduces false positives' },
    ],
    requestExample: JSON.stringify({ name: 'Godwin Emefiele', dob: '1961-08-04' }, null, 2),
    responses: [
      { status: 200, label: 'Match found', body: JSON.stringify({ name: 'Godwin Emefiele', dob: '1961-08-04', is_pep: true, total_matches: 1, matches: [{ name: 'Godwin Emefiele', risk_level: 'high', positions: ['Governor, Central Bank of Nigeria'], countries: ['NG'] }] }, null, 2) },
      { status: 200, label: 'No match', body: JSON.stringify({ name: 'Adamu Ibrahim', dob: null, is_pep: false, total_matches: 0, matches: [] }, null, 2) },
      { status: 400, label: 'Bad request', body: JSON.stringify({ error: 'invalid_request', message: 'name is required' }, null, 2) },
      { status: 401, label: 'Unauthorized', body: JSON.stringify({ error: 'invalid_api_key_or_session' }, null, 2) },
    ],
    codeSamples: {
      'cURL': curl('/verify/pep', { name: 'Godwin Emefiele', dob: '1961-08-04' }),
      'Node.js': node('/verify/pep', { name: 'Godwin Emefiele', dob: '1961-08-04' }, 'is_pep'),
      'Python': python('/verify/pep', { name: 'Godwin Emefiele', dob: '1961-08-04' }),
      'Go': golang('/verify/pep', { name: 'Godwin Emefiele', dob: '1961-08-04' }),
      'Java': java('/verify/pep', { name: 'Godwin Emefiele', dob: '1961-08-04' }),
    },
  },
]

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: 'Data Ingest', color: '#61afef',
    items: ENDPOINTS.filter(e => e.id.startsWith('ingest')).map(e => ({ id: e.id, method: e.method, path: e.path })),
  },
  {
    label: 'Verification', color: '#c3e88d',
    items: ENDPOINTS.filter(e => e.id.startsWith('verify')).map(e => ({ id: e.id, method: e.method, path: e.path })),
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DevelopersPage() {
  const [activeId, setActiveId] = useState('authentication')
  const contentRef = useRef<HTMLDivElement>(null)

  const scrollTo = (id: string) => {
    setActiveId(id)
    if (id === 'authentication') {
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Track active section on scroll
  useEffect(() => {
    const container = contentRef.current
    if (!container) return
    const onScroll = () => {
      const threshold = container.getBoundingClientRect().top + 80
      let newActive = 'authentication'
      for (const ep of ENDPOINTS) {
        const el = document.getElementById(ep.id)
        if (el && el.getBoundingClientRect().top <= threshold) newActive = ep.id
      }
      setActiveId(newActive)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#ffffff' }}>
      <Sidebar groups={SIDEBAR_GROUPS} activeId={activeId} onSelect={scrollTo} />

      {/* Content */}
      <Box ref={contentRef} sx={{ flex: 1, overflowY: 'auto', bgcolor: '#ffffff', px: { xs: 3, md: 5 }, py: 5 }}>
        <Box sx={{ maxWidth: 1000, mx: 'auto' }}>

          {/* Authentication */}
          <Box id="authentication" sx={{ mb: 6, scrollMarginTop: 40 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#2563eb',
                textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                Getting started
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a',
              fontFamily: 'Jost', mb: 1.5 }}>
              Authentication
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#475569', lineHeight: 1.8, mb: 3, maxWidth: 640 }}>
              All OpenIV API endpoints require a <Box component="code"
                sx={{ fontFamily: '"Fira Code", monospace', fontSize: '0.875rem',
                  bgcolor: '#f1f5f9', px: 0.75, py: 0.25, color: '#059669' }}>Bearer</Box> token.
              Generate your API key from <Box component={Link} to="/dashboard/beam"
                sx={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' } }}>
                Dashboard → Data Ingest → API Key
              </Box>.
            </Typography>

            <SchemaTable fields={[
              { name: 'Authorization', type: 'string', required: true,  desc: 'Bearer <api-key> — your institution\'s API key from the dashboard' },
              { name: 'Content-Type',  type: 'string', required: true,  desc: 'Must be application/json' },
              { name: 'X-Idempotency-Key', type: 'UUID v4', required: false, desc: 'Unique per request. If you retry with the same key within 24h, the original response is returned without creating a duplicate.' },
            ]} />

            <CodePane code={`# Set your API key once in the environment
export OPENIV_API_KEY="oiv_live_xxxxxxxxxxxxxxxxxxxx"

# Include on every request
curl -X POST https://api.openiv.ng/api/v1/beam/transactions \\
  -H "Authorization: Bearer $OPENIV_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "X-Idempotency-Key: $(uuidgen)" \\
  -d '{ ... }'`} />

            <Box sx={{ mt: 3, p: 2.5, bgcolor: '#fffbeb', border: '1px solid #fde68a',
              borderLeft: '3px solid #f59e0b' }}>
              <Typography sx={{ fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.7 }}>
                <Box component="span" sx={{ color: '#d97706', fontWeight: 700 }}>Note: </Box>
                Your API key carries full access to all ingest and verification endpoints for your institution.
                Never expose it in client-side code or a public repository. Rotate it immediately from
                the dashboard if it is compromised.
              </Typography>
            </Box>
          </Box>

          {/* Divider + group headers */}
          {SIDEBAR_GROUPS.map(group => (
            <Box key={group.label}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, mt: 2 }}>
                <Box sx={{ height: 1, flex: 1, bgcolor: '#e2e8f0' }} />
                <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: 'Jost' }}>
                    {group.label}
                  </Typography>
                </Box>
                <Box sx={{ height: 1, flex: 1, bgcolor: '#e2e8f0' }} />
              </Box>

              {ENDPOINTS.filter(e => group.items.some(i => i.id === e.id)).map((ep, idx, arr) => (
                <Box key={ep.id}>
                  <EndpointSection ep={ep} />
                  {idx < arr.length - 1 && (
                    <Box sx={{ height: 1, bgcolor: '#e2e8f0', my: 5 }} />
                  )}
                </Box>
              ))}
              <Box sx={{ mb: 6 }} />
            </Box>
          ))}

          {/* Footer */}
          <Box sx={{ pt: 4, borderTop: '1px solid #e2e8f0', display: 'flex',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
              OpenIV API v1  ·  All times UTC  ·  Amounts in kobo
            </Typography>
            <Box component={Link} to="/request-access"
              sx={{ fontSize: '0.8125rem', color: '#2563eb', textDecoration: 'none', fontWeight: 600,
                '&:hover': { textDecoration: 'underline' } }}>
              Request API access →
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
