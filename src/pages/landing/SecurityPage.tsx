import { Box, Container, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import Footer from '@/components/landing/Footer'
import { useSEO } from '@/hooks/useSEO'

function TopNav() {
  return (
    <Box sx={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 64, display: 'flex', alignItems: 'center',
      bgcolor: '#ffffff', borderBottom: '1px solid #e2e8f0',
    }}>
      <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box component={Link} to="/landing" sx={{ textDecoration: 'none' }}>
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: -4, left: 0, width: 22, height: '2px', bgcolor: '#00288e', borderRadius: '1px' }} />
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '0.1em' }}>
              OPENIV
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box component={Link} to="/request-access" sx={{
            textDecoration: 'none', px: 2.5, py: 0.875, fontSize: '0.875rem', fontWeight: 700,
            bgcolor: '#d9f99d', color: '#00288e', fontFamily: 'Jost', '&:hover': { bgcolor: '#bef264' },
          }}>Get access →</Box>
        </Box>
      </Container>
    </Box>
  )
}

function Section({ title, first = false, children }: { title: string; first?: boolean; children: React.ReactNode }) {
  return (
    <Box sx={first ? {} : { borderTop: '1px solid #f1f5f9', pt: 5, mt: 5 }}>
      <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 2 }}>{title}</Typography>
      {children}
    </Box>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: '0.9375rem', color: '#475569', lineHeight: 1.8 }}>{children}</Typography>
}

function BulletList({ items }: { items: string[] }) {
  return (
    <Box component="ul" sx={{ pl: 3, mt: 1.5, mb: 0 }}>
      {items.map((item) => (
        <Typography key={item} component="li" sx={{ fontSize: '0.9375rem', color: '#475569', lineHeight: 1.8 }}>{item}</Typography>
      ))}
    </Box>
  )
}

function EmailLink({ email }: { email: string }) {
  return (
    <Box component="a" href={`mailto:${email}`} sx={{ color: '#00288e', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
      {email}
    </Box>
  )
}

export default function SecurityPage() {
  useSEO({
    title: 'Security – OpenIV Platform',
    description: 'End-to-end encryption, TOTP 2FA, RBAC, geo-blocking, and immutable audit logs. Enterprise-grade security built for Nigerian financial institutions.',
    canonical: '/security',
  })

  return (
    <Box sx={{ fontFamily: 'Jost, Inter, sans-serif' }}>
      <TopNav />

      <Box sx={{ bgcolor: '#00288e', pt: '64px', pb: { xs: 8, md: 12 } }}>
        <Container maxWidth="md" sx={{ pt: { xs: 6, md: 8 } }}>
          <Typography sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, fontWeight: 900, color: '#ffffff', fontFamily: 'Jost', lineHeight: 1.1, mb: 2 }}>
            Platform Security
          </Typography>
          <Box sx={{ width: 48, height: 3, bgcolor: '#d9f99d', mb: 2 }} />
          <Typography sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'Jost' }}>
            Protecting your institution's data and your customers' trust.
          </Typography>
        </Container>
      </Box>

      <Box sx={{ bgcolor: '#ffffff', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">

          <Section title="Overview" first>
            <Body>
              OpenIV is built for environments where a security failure is a regulatory event. Every layer of the
              platform — from API transport to session management to audit log retention — is designed to meet CBN,
              NFIU, and NDPR requirements out of the box. This page describes the security controls in place across
              the OpenIV infrastructure, application, and operational layers.
            </Body>
          </Section>

          <Section title="Transport Security">
            <Body>
              All communication between clients and the OpenIV API is encrypted using TLS 1.3. Older protocol versions
              (TLS 1.0, TLS 1.1, TLS 1.2) and weak cipher suites are rejected at the load balancer. HTTP connections
              are automatically redirected to HTTPS. There are no unencrypted API endpoints in production.
            </Body>
            <BulletList items={[
              'TLS 1.3 enforced on all API and dashboard endpoints',
              'Weak cipher suites and legacy protocol versions rejected',
              'HTTP-to-HTTPS redirection enforced globally',
            ]} />
          </Section>

          <Section title="Data Encryption">
            <Body>
              All data at rest — including transaction records, KYC identity data, case files, and audit logs — is
              encrypted using AES-256. Encryption keys are managed separately from the data they protect. TOTP
              shared secrets are stored encrypted using RSA-OAEP-SHA256, ensuring that a database breach does not
              expose authenticator seeds.
            </Body>
            <BulletList items={[
              'AES-256 encryption for all data at rest',
              'RSA-OAEP-SHA256 encryption for TOTP secrets',
              'Key management separated from encrypted data stores',
            ]} />
          </Section>

          <Section title="Authentication and Access Control">
            <Body>
              Every dashboard account requires TOTP-based two-factor authentication. TOTP codes rotate every 30
              seconds and cannot be reused. Sessions are short-lived and invalidated on inactivity. Role-based access
              control (RBAC) enforces least-privilege — each team member's permissions are scoped to their assigned
              role, and no role grants access beyond what is required for that function.
            </Body>
            <BulletList items={[
              'TOTP 2FA required for all dashboard accounts — no exceptions',
              'Session tokens invalidated on inactivity and at logout',
              'Invitation links are single-use and expire within 48 hours',
              'Password reset tokens are single-use and expire in 15 minutes',
              'RBAC enforced across all dashboard routes, API actions, and case operations',
            ]} />
          </Section>

          <Section title="API Security">
            <Body>
              The Beam and Verify APIs use institution-scoped bearer tokens. Each request to ingest endpoints must
              include an idempotency key, which prevents duplicate transaction processing under network retry or
              replay conditions. API keys can be rotated at any time from the dashboard without service interruption.
            </Body>
            <BulletList items={[
              'Institution-scoped bearer tokens for all API authentication',
              'Idempotency key enforcement prevents duplicate processing',
              'API keys rotatable on demand with zero downtime',
              'Rate limiting applied per institution to prevent abuse',
            ]} />
          </Section>

          <Section title="Geo-Based Access Controls">
            <Body>
              Institution administrators can restrict dashboard and API access by approved geography. Login attempts
              from outside an institution's permitted countries are blocked at the session layer and generate a
              security event notification in real time. Repeated geo-blocked attempts trigger an automatic account
              lock and compliance alert.
            </Body>
          </Section>

          <Section title="Multi-Tenant Isolation">
            <Body>
              Each institution operates in a fully isolated data partition. Transaction records, KYC data, API keys,
              thresholds, case queues, and team configurations are strictly separated at the database level. There is
              no shared state between institutions. An institution's users cannot access, query, or inadvertently
              surface data belonging to another institution under any role or permission configuration.
            </Body>
          </Section>

          <Section title="Audit Logging and Retention">
            <Body>
              Every login, logout, failed authentication attempt, configuration change, case action, report export,
              and API call is written to a tamper-evident audit log. Logs capture the acting user, timestamp, IP
              address, and the full context of the action. Audit logs are retained for a minimum of 7 years in
              accordance with CBN AML/CFT regulations and are available for export from the dashboard by authorised
              compliance officers.
            </Body>
            <BulletList items={[
              'All user and API actions written to immutable audit logs',
              'Logs include actor, timestamp, IP address, and action context',
              '7-year minimum retention per CBN AML/CFT requirements',
              'Exportable by authorised compliance roles from the dashboard',
            ]} />
          </Section>

          <Section title="Regulatory Alignment">
            <Body>
              The OpenIV security model is designed to support institutions in meeting their obligations under the
              CBN AML/CFT Framework, NFIU reporting standards, the Nigerian Data Protection Regulation (NDPR), the
              Money Laundering (Prevention and Prohibition) Act, and FATF Recommendations. Data residency, retention
              schedules, access controls, and audit requirements are built into the platform and are not dependent
              on manual configuration by the institution.
            </Body>
            <BulletList items={[
              'CBN AML/CFT Framework — audit retention, transaction monitoring, case management',
              'NFIU reporting standards — STR and CTR generation and audit trails',
              'NDPR — data minimisation, access controls, and retention compliance',
              'FATF Recommendations — risk-based approach, PEP screening, and record-keeping',
            ]} />
          </Section>

          <Section title="Responsible Disclosure">
            <Body>
              If you believe you have identified a security vulnerability in the OpenIV platform, please report it
              responsibly to our security team before any public disclosure. We investigate every report, acknowledge
              receipt within 24 hours, and provide a resolution timeline within 48 hours. Please include a clear
              description of the issue, steps to reproduce, and the potential impact. Contact:{' '}
              <EmailLink email="support@openiv.ng" />.
            </Body>
          </Section>

        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
