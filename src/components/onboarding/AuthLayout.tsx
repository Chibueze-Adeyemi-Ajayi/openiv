import { Box, Container, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import FingerprintOutlinedIcon from '@mui/icons-material/FingerprintOutlined'
import { keyframes } from '@mui/system'
import { useState, useEffect } from 'react'

interface AuthLayoutProps {
  children: React.ReactNode
}

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
    title: "Real-Time AML Surveillance",
    lines: [
      "Identify suspicious patterns before the transaction settles.",
      "Our engine processes thousands of rules in sub-14ms,",
      "ensuring total compliance without compromising speed."
    ]
  },
  {
    title: "Fraud Detection & Prevention",
    lines: [
      "Stop bad actors instantly using self-adaptive intelligent systems.",
      "Our models adapt to emerging fraud patterns in real-time,",
      "protecting your institution against evolving threats."
    ]
  },
  {
    title: "Advanced Behavioral Intelligence",
    lines: [
      "Go beyond simple KYC with deep behavioral profiling.",
      "We analyze transaction velocity and device fingerprints",
      "to build a 360-degree risk profile of every user."
    ]
  },
  {
    title: "Effortless Regulatory Compliance",
    lines: [
      "Generate CBN, NFIU, and NDPR aligned reports with ease.",
      "Say goodbye to manual filing and focus on growth.",
      "Engineered for Nigeria's leading banks and fintechs."
    ]
  }
]

function AuthMarketingCarousel() {
  const [index, setIndex] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setIsExiting(true)
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % marketingContent.length)
        setIsExiting(false)
      }, 600)
    }, 8000)
    return () => clearInterval(timer)
  }, [index])

  const handleManualChange = (newIndex: number) => {
    if (newIndex === index || isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      setIndex(newIndex)
      setIsExiting(false)
    }, 600)
  }

  const current = marketingContent[index]

  return (
    <Box sx={{ my: 'auto' }}>
      <Box sx={{ height: 260, animation: isExiting ? `${flyOff} 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards` : 'none' }}>
        <Typography
          sx={{
            fontSize: { md: '2rem', lg: '2.375rem' },
            fontWeight: 700,
            fontFamily: 'Jost',
            lineHeight: 1.15,
            mb: 3,
            letterSpacing: '-0.015em',
            color: '#ffffff',
            animation: !isExiting ? `${bounceIn} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both` : 'none',
          }}
        >
          {current.title}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {current.lines.map((line, i) => (
            <Typography
              key={`${index}-${i}`}
              sx={{
                fontSize: '1rem',
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.8)',
                fontWeight: 400,
                animation: !isExiting ? `${slideInLine} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.4 + i * 0.15}s both` : 'none',
              }}
            >
              {line}
            </Typography>
          ))}
        </Box>
      </Box>

      {/* Dots Indicator */}
      <Box sx={{ display: 'flex', gap: 1, mt: 4 }}>
        {marketingContent.map((_, i) => (
          <Box
            key={i}
            onClick={() => handleManualChange(i)}
            sx={{
              width: i === index ? 24 : 8,
              height: 8,
              borderRadius: '4px',
              bgcolor: i === index ? '#ffffff' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': { bgcolor: i === index ? '#ffffff' : 'rgba(255,255,255,0.5)' },
            }}
          />
        ))}
      </Box>
    </Box>
  )
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: '#ffffff',
        '@keyframes fadeInUp': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {/* Left Panel - Brand */}
      <Box
        sx={{
          width: { xs: 0, md: '40%', lg: '38%' },
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { md: 5, lg: 6 },
          bgcolor: '#00288e',
          color: '#ffffff',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <Box sx={{ animation: 'fadeInUp 0.6s ease' }}>
          <Box sx={{ mb: { md: 7, lg: 9 }, position: 'relative', width: 'fit-content' }}>
            <Box
              sx={{
                position: 'absolute',
                top: -6,
                left: 0,
                width: 28,
                height: '2px',
                bgcolor: '#ffffff',
                borderRadius: '1px',
              }}
            />
            <Typography
              sx={{
                fontSize: '1.125rem',
                fontWeight: 700,
                fontFamily: 'Jost',
                letterSpacing: '0.12em',
                mb: 1,
                color: '#ffffff',
                position: 'relative',
              }}
            >
              OPENIV
            </Typography>
          </Box>

          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.6)',
              mb: 2,
            }}
          >
            AML/CFT/CPF INTELLIGENCE PLATFORM
          </Typography>
        </Box>

        <AuthMarketingCarousel />

        {/* Operational Indicators */}
        <Box sx={{ animation: 'fadeInUp 0.8s ease' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.75 }}>
            <BoltOutlinedIcon sx={{ fontSize: '1rem', color: '#ffffff', opacity: 0.95 }} />
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: '#ffffff',
                opacity: 0.95,
              }}
            >
              SUB-14MS TRANSACTION ANALYSIS
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.75 }}>
            <FingerprintOutlinedIcon sx={{ fontSize: '1rem', color: '#ffffff', opacity: 0.95 }} />
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: '#ffffff',
                opacity: 0.95,
              }}
            >
              BEHAVIORAL FINGERPRINTING
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <GavelOutlinedIcon sx={{ fontSize: '1rem', color: '#ffffff', opacity: 0.95 }} />
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: '#ffffff',
                opacity: 0.95,
              }}
            >
              CBN · NFIU · NDPR ALIGNED
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Right Panel - Form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 4, sm: 6, md: 8, lg: 10 },
          bgcolor: '#ffffff',
          overflowY: 'auto',
          maxHeight: '100vh',
        }}
      >
        <Container
          maxWidth="sm"
          sx={{
            width: '100%',
            maxWidth: '560px !important',
            animation: 'fadeInUp 0.5s ease',
          }}
        >
          {children}
        </Container>
      </Box>
    </Box>
  )
}
