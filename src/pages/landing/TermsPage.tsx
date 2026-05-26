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

export default function TermsPage() {
  return (
    <Box sx={{ fontFamily: 'Jost, Inter, sans-serif' }}>
      <TopNav />

      <Box sx={{ bgcolor: '#00288e', pt: '64px', pb: { xs: 8, md: 12 } }}>
        <Container maxWidth="md" sx={{ pt: { xs: 6, md: 8 } }}>
          <Typography sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, fontWeight: 900, color: '#ffffff', fontFamily: 'Jost', lineHeight: 1.1, mb: 2 }}>
            Terms of Use
          </Typography>
          <Box sx={{ width: 48, height: 3, bgcolor: '#d9f99d', mb: 2 }} />
          <Typography sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'Jost' }}>
            Last updated May 26, 2026
          </Typography>
        </Container>
      </Box>

      <Box sx={{ bgcolor: '#ffffff', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">

          <Section title="Acceptance" first>
            <Body>
              By accessing the OpenIV API, dashboard, or any related service, your institution agrees to be bound by
              these Terms of Use and all applicable policies referenced herein. These terms form a binding agreement
              between your institution and OpenIV Technologies. If your institution does not agree, discontinue use
              immediately and contact us to arrange deprovisioning.
            </Body>
          </Section>

          <Section title="Service Description">
            <Body>OpenIV provides a suite of financial crime prevention services for licensed Nigerian financial institutions, including:</Body>
            <BulletList items={[
              'A real-time AML/fraud detection API that scores transactions against 29+ rules in sub-14ms',
              'A behavioral KYC pipeline for identity verification, liveness checks, and PEP/sanctions screening',
              'A case management dashboard for compliance officers and fraud analysts',
              'Regulatory reporting tools for CBN, NFIU, and NDPR-aligned submissions',
            ]} />
          </Section>

          <Section title="Eligibility">
            <Body>Access to OpenIV services is restricted to the following:</Body>
            <BulletList items={[
              '(a) Institutions licensed by the Central Bank of Nigeria — commercial banks, microfinance banks, payment service banks, and licensed fintechs',
              "(b) Institutions that have completed OpenIV's onboarding and Know Your Business (KYB) verification process",
              '(c) Users operating with valid credentials issued by their institution through the OpenIV dashboard',
            ]} />
          </Section>

          <Section title="Permitted Use">
            <Body>
              API keys and dashboard credentials are issued exclusively for your institution's authorised internal
              integration and compliance operations. You may not resell, sublicense, or share access with third parties.
              Your institution is responsible for all activity carried out under its credentials.
            </Body>
          </Section>

          <Section title="Prohibited Use">
            <Body>The following uses are strictly prohibited:</Body>
            <BulletList items={[
              'Submitting synthetic or fabricated data to production API endpoints without explicit labeling as test traffic',
              "Attempting to reverse-engineer, probe, or extract OpenIV's scoring models or rule logic",
              'Using the platform in any manner that facilitates or conceals money laundering, fraud, or financial crime',
              'Exceeding documented rate limits or circumventing API access controls',
              "Sharing API keys or session credentials outside your institution's authorised personnel",
            ]} />
          </Section>

          <Section title="Your Compliance Obligations">
            <Body>
              OpenIV is a technology tool, not a compliance officer or legal adviser. Your institution remains solely
              responsible for meeting all applicable obligations under the CBN AML/CFT Framework, NFIU reporting
              standards, the NDPR, and all other relevant Nigerian and international regulations. Risk decisions —
              including whether to accept, flag, or reject a transaction — remain entirely with your institution.
            </Body>
          </Section>

          <Section title="Intellectual Property">
            <Body>
              All scoring models, rule logic, API specifications, dashboard interfaces, and documentation are the
              exclusive property of OpenIV Technologies. No rights are transferred beyond a limited, non-exclusive,
              non-transferable licence to use the services as described in these terms.
            </Body>
          </Section>

          <Section title="Limitation of Liability">
            <Body>
              To the fullest extent permitted by Nigerian law, OpenIV is not liable for losses arising from undetected
              fraud, incorrect risk scores, service interruptions, or reliance on OpenIV outputs in place of your
              institution's own compliance judgement. OpenIV's total aggregate liability is capped at fees paid in the
              three calendar months preceding the event giving rise to the claim.
            </Body>
          </Section>

          <Section title="Termination">
            <Body>
              Either party may terminate with 30 days written notice. OpenIV may terminate immediately upon material
              breach, non-payment of fees, or where continued access creates regulatory or legal risk. Upon termination,
              all API keys are revoked. Your institution may export its data within 14 days of termination.
            </Body>
          </Section>

          <Section title="Governing Law">
            <Body>
              These terms are governed by the laws of the Federal Republic of Nigeria. Any dispute shall be subject to
              the exclusive jurisdiction of the courts of Lagos State, Nigeria.
            </Body>
          </Section>

          <Section title="Contact">
            <Body>For questions about these terms, contact <EmailLink />.</Body>
          </Section>

        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
