import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme/palette'
import { keyframes } from '@mui/system'
import { useIntersectionAnimation } from '@/hooks/useIntersectionAnimation'
import { useState, useEffect } from 'react'
import { Link as RouterLink } from 'react-router-dom'

const bounceIn = keyframes`
  0% { opacity: 0; transform: scale(0.3) translateY(20px); }
  50% { opacity: 1; transform: scale(1.05) translateY(-5px); }
  70% { transform: scale(0.9) translateY(2px); }
  100% { transform: scale(1) translateY(0); }
`

const slideInLine = keyframes`
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
`

const flyOff = keyframes`
  0% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-40px) scale(0.95); }
`

const marketingContent = [
  {
    title: "State-of-the-Art AML Orchestration.",
    subtitle: [
        "Eliminate fraud leakage by 94% with sub-14ms orchestration.",
        "Our engine analyzes 12,000+ behavioral signals per transaction",
        "to ensure total institutional integrity across $2B+ in monthly volume."
    ]
  },
  {
    title: "Autonomous Regulatory Governance.",
    subtitle: [
        "Reduce SAR/STR filing overhead by 85%. Achieve 100% CBN",
        "and NFIU compliance with automated Risk-Based Supervision",
        "reports engineered for Nigeria's largest fintechs."
    ]
  },
  {
    title: "Advanced Behavioral Intelligence.",
    subtitle: [
        "Cut false positives by 62% using device relationship mapping.",
        "Build a 360-degree risk profile that identifies shell company",
        "structures and money laundering rings in real-time."
    ]
  },
  {
    title: "Institutional-Grade Data Sovereignty.",
    subtitle: [
        "100% NDPR and local data residency compliance.",
        "Protect sensitive records with AES-256 encryption",
        "and hardware-backed key management systems."
    ]
  }
]

export default function HeroSection() {
  const { ref, isVisible } = useIntersectionAnimation()
  const [index, setIndex] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setIsExiting(true)
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % marketingContent.length)
        setIsExiting(false)
      }, 600)
    }, 10000)
    return () => clearInterval(timer)
  }, [index])

  const current = marketingContent[index]

  return (
    <Box 
      ref={ref} 
      sx={{ 
        bgcolor: '#00288e', 
        pt: { xs: 12, md: 18 }, 
        pb: { xs: 8, md: 12 },
        color: '#ffffff',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Container maxWidth="lg">
        <Stack sx={{ gap: 5, maxWidth: '900px', height: { xs: '500px', md: '550px' } }}>
          <Box sx={{ animation: isExiting ? `${flyOff} 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards` : 'none' }}>
            <Typography
              sx={{
                fontSize: { xs: '2.5rem', md: '4.5rem' },
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                fontFamily: 'Jost',
                mb: 4,
                animation: !isExiting ? `${bounceIn} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both` : 'none',
              }}
            >
              {current.title}
            </Typography>
            
            <Stack spacing={1}>
                {current.subtitle.map((line, i) => (
                    <Typography
                        key={i}
                        sx={{
                            fontSize: '1.25rem',
                            color: '#94a3b8',
                            lineHeight: 1.4,
                            maxWidth: '720px',
                            animation: !isExiting ? `${slideInLine} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.4 + (i * 0.15)}s both` : 'none',
                        }}
                    >
                        {line}
                    </Typography>
                ))}
            </Stack>
          </Box>

          <Box sx={{ mt: 'auto' }}>
            <Button
              component={RouterLink}
              to="/request-access"
              sx={{
                bgcolor: '#d9f99d',
                color: '#00288e',
                fontWeight: 800,
                fontSize: '1.125rem',
                px: 5,
                py: 2,
                borderRadius: 0,
                textTransform: 'none',
                fontFamily: 'Jost',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1.5,
                '&:hover': { bgcolor: '#bef264' }
              }}
            >
              Get Started <span style={{ fontSize: '1.5rem' }}>→</span>
            </Button>
            
            {/* Dots */}
            <Box sx={{ display: 'flex', gap: 1, mt: 6 }}>
                {marketingContent.map((_, i) => (
                <Box
                    key={i}
                    sx={{
                    width: i === index ? 32 : 8,
                    height: 2,
                    bgcolor: i === index ? '#d9f99d' : 'rgba(255,255,255,0.2)',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                />
                ))}
            </Box>
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}
