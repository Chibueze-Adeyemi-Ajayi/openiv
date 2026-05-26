import { Box, Container, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import Footer from '@/components/landing/Footer'

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
          <Box component={Link} to="/auth/login" sx={{
            textDecoration: 'none', px: 2, py: 0.875, fontSize: '0.875rem', fontWeight: 500,
            color: '#475569', fontFamily: 'Jost', '&:hover': { color: '#00288e' },
          }}>Sign in</Box>
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

const EMAIL = 'compliance@openiv.ng'

function EmailLink() {
  return (
    <Box component="a" href={`mailto:${EMAIL}`} sx={{ color: '#00288e', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
      {EMAIL}
    </Box>
  )
}

export default function PrivacyPage() {
  return (
    <Box sx={{ fontFamily: 'Jost, Inter, sans-serif' }}>
      <TopNav />

      <Box sx={{ bgcolor: '#00288e', pt: '64px', pb: { xs: 8, md: 12 } }}>
        <Container maxWidth="md" sx={{ pt: { xs: 6, md: 8 } }}>
          <Typography sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, fontWeight: 900, color: '#ffffff', fontFamily: 'Jost', lineHeight: 1.1, mb: 2 }}>
            Privacy Policy
          </Typography>
          <Box sx={{ width: 48, height: 3, bgcolor: '#d9f99d', mb: 2 }} />
          <Typography sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'Jost' }}>
            Last updated May 26, 2026
          </Typography>
        </Container>
      </Box>

      <Box sx={{ bgcolor: '#ffffff', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">

          <Section title="Overview" first>
            <Body>
              OpenIV Technologies operates as a data processor under the Nigerian Data Protection Regulation (NDPR) and
              CBN guidelines. Financial institutions that integrate with the OpenIV API remain the data controller for
              their own customers' personal data. OpenIV processes that data solely on behalf of and under the documented
              instructions of each institution. For data-related enquiries, contact us at <EmailLink />.
            </Body>
          </Section>

          <Section title="Information We Process">
            <Body>We process the following categories of data on behalf of licensed institutions:</Body>
            <BulletList items={[
              'Transaction data — amounts, channels, timestamps, and geolocation signals',
              'KYC identity data — BVN, NIN, phone numbers, liveness scores, and PEP/sanctions status',
              'Account metadata — customer IDs, institution tier, and device signals',
              'Usage and access logs — API call records, dashboard sessions, and audit events',
            ]} />
          </Section>

          <Section title="How We Use It">
            <Body>Data processed through OpenIV is used exclusively for the following purposes:</Body>
            <BulletList items={[
              'Real-time fraud scoring and AML rule evaluation against incoming transactions',
              'KYC pipeline processing including identity verification and risk scoring',
              'Case and alert management on behalf of the institution',
              'Regulatory report generation (STR, CTR, KYC audits) for CBN and NFIU submissions',
              'Service improvement through aggregated, anonymised performance analytics',
            ]} />
            <Box sx={{ mt: 2 }}>
              <Body>We do not sell personal data, share it for third-party advertising, or use it for any purpose beyond those listed above.</Body>
            </Box>
          </Section>

          <Section title="Data Sharing">
            <Body>Personal data is shared only with the following parties and under strict controls:</Body>
            <BulletList items={[
              '(a) Identity verification partners — Dojah, NIBSS, NIMC, and NCC — strictly for identity verification',
              '(b) CBN, NFIU, and other Nigerian regulators when legally required by a valid regulatory order',
              '(c) Infrastructure providers operating under signed data processing agreements with equivalent protections',
            ]} />
            <Box sx={{ mt: 2 }}>
              <Body>No data is transferred outside Nigeria without a lawful basis and appropriate safeguards in place.</Body>
            </Box>
          </Section>

          <Section title="Security">
            <Body>
              All data is encrypted in transit using TLS 1.3 and at rest using AES-256. Access to production systems is
              restricted by role-based access controls and requires multi-factor authentication. All administrative actions
              are written to immutable audit logs. OpenIV conducts annual security assessments and penetration tests by
              independent third parties.
            </Body>
          </Section>

          <Section title="Retention">
            <Body>
              Transaction records and KYC data are retained for a minimum of 7 years in accordance with CBN AML/CFT
              regulations and the Money Laundering (Prevention and Prohibition) Act. Account data is deleted within
              30 days of contract termination, subject to any outstanding regulatory hold obligations.
            </Body>
          </Section>

          <Section title="Your Rights">
            <Body>
              Under the NDPR, individuals have the right to request access to, correction of, or deletion of their
              personal data. Because OpenIV acts as a data processor, requests from institution customers should be
              submitted through the financial institution that holds their account. Individuals with a direct relationship
              with OpenIV may contact our Data Protection Officer at <EmailLink />.
            </Body>
          </Section>

          <Section title="Contact">
            <Body>
              Data Protection Officer: <EmailLink /><br />
              OpenIV Technologies, Lagos, Nigeria.
            </Body>
          </Section>

        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
