import { Box, Container, Stack, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { keyframes } from '@mui/system'
import { useIntersectionAnimation } from '@/hooks/useIntersectionAnimation'

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
`

const faqs = [
  {
    q: "How does the real-time orchestration engine work?",
    a: "OpenIV processes every transaction through a multi-layered risk model including device fingerprinting, network signals, and historical behavioral patterns, returning a decision in under 14ms."
  },
  {
    q: "Is it compliant with CBN and NFIU regulations?",
    a: "Yes. OpenIV is built specifically for the Nigerian regulatory landscape, with automated SAR/STR filing capabilities and risk-based supervision reports that align with current standards."
  },
  {
    q: "What is the implementation timeline?",
    a: "Most institutions are live within 2-4 weeks. Our cloud-native infrastructure and RESTful APIs are designed for rapid integration with legacy core banking systems."
  },
  {
    q: "Can we manage custom risk policies?",
    a: "Absolutely. The OpenIV dashboard allows your compliance team to create, test, and deploy custom rules and behavioral thresholds without touching any code."
  }
]

export default function FAQSection() {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box ref={ref} sx={{ bgcolor: '#ffffff', py: { xs: 12, md: 16 } }}>
      <Container maxWidth="md">
        <Stack sx={{ gap: 8 }}>
          <Typography
            sx={{
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              fontWeight: 800,
              color: '#00288e',
              textAlign: 'center',
              fontFamily: 'Jost',
              animation: isVisible ? `${fadeInUp} 0.8s ease-out both` : 'none',
            }}
          >
            Frequently Asked Questions
          </Typography>

          <Stack sx={{ gap: 2, animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.2s both` : 'none' }}>
            {faqs.map((faq, idx) => (
              <Accordion 
                key={idx} 
                elevation={0} 
                sx={{ 
                    border: '1px solid #e5e7eb',
                    borderRadius: '0 !important',
                    '&:before': { display: 'none' },
                    overflow: 'hidden'
                }}
              >
                <AccordionSummary 
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ px: 3, py: 1 }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#00288e' }}>
                    {faq.q}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pb: 3 }}>
                  <Typography sx={{ color: '#64748b', lineHeight: 1.6 }}>
                    {faq.a}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
