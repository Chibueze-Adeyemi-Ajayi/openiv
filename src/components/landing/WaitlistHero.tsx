import { Box, Button, Container, Stack, Typography, TextField, CircularProgress, Alert, Grid, Paper, FormGroup, FormControlLabel, Checkbox } from '@mui/material'
import { keyframes } from '@mui/system'
import { useState, useEffect } from 'react'

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

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
`

const heroContent = [
  {
    title: 'Stop Fraud',
    highlight: 'Faster. Smarter.',
    subtitle: 'The OpenIV Way.',
    lines: [
      'Leverage real-time behavioral fraud and compliance orchestration.',
      'Get sub-14ms, cross-border intelligence at an affordable rate.',
    ],
    tag: 'Trusted by 50,000+ users across 15+ countries.',
  },
  {
    title: 'Real-Time AML',
    highlight: 'Surveillance.',
    subtitle: 'At Sub-14ms Speed.',
    lines: [
      'Identify suspicious patterns before the transaction settles.',
      'Our engine processes thousands of rules in milliseconds,',
      'ensuring total compliance without compromising speed.',
    ],
    tag: 'CBN · NFIU · NDPR Aligned.',
  },
  {
    title: 'Advanced',
    highlight: 'Behavioral Intelligence.',
    subtitle: 'Know Every Risk Profile.',
    lines: [
      'Go beyond simple KYC with deep behavioral profiling.',
      'We analyze transaction velocity, device fingerprints,',
      'and location patterns to build a 360° risk view.',
    ],
    tag: 'Powering Nigeria\'s leading banks and fintechs.',
  },
  {
    title: 'Effortless',
    highlight: 'Regulatory Compliance.',
    subtitle: 'Built for Financial Institutions.',
    lines: [
      'Generate CBN, NFIU, and NDPR aligned reports with ease.',
      'Say goodbye to manual filing and focus on growth.',
      'One platform. Complete compliance coverage.',
    ],
    tag: 'Engineered for scale and speed.',
  },
]

function HeroCarousel() {
  const [index, setIndex] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setIsExiting(true)
      setTimeout(() => {
        setIndex(prev => (prev + 1) % heroContent.length)
        setIsExiting(false)
      }, 600)
    }, 7000)
    return () => clearInterval(timer)
  }, [index])

  const handleDotClick = (newIndex: number) => {
    if (newIndex === index || isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      setIndex(newIndex)
      setIsExiting(false)
    }, 600)
  }

  const current = heroContent[index]

  return (
    <Box>
      <Box
        sx={{
          minHeight: { xs: 240, md: 280 },
          animation: isExiting ? `${flyOff} 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards` : 'none',
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '2.75rem', md: '3.75rem' },
            fontWeight: 900,
            lineHeight: 1.1,
            color: '#1A1B22',
            mb: 1,
            animation: !isExiting ? `${bounceIn} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both` : 'none',
          }}
        >
          {current.title}{' '}
          <Box component="span" sx={{ color: '#1A46B8' }}>{current.highlight}</Box>
        </Typography>
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: '1.5rem', md: '2rem' },
            fontWeight: 700,
            color: '#475569',
            mb: 3,
            animation: !isExiting ? `${bounceIn} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both` : 'none',
          }}
        >
          {current.subtitle}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 3 }}>
          {current.lines.map((line, i) => (
            <Typography
              key={`${index}-${i}`}
              sx={{
                fontSize: '1rem',
                lineHeight: 1.7,
                color: '#64748B',
                fontWeight: 400,
                animation: !isExiting
                  ? `${slideInLine} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.3 + i * 0.12}s both`
                  : 'none',
              }}
            >
              {line}
            </Typography>
          ))}
        </Box>

        <Typography
          sx={{
            fontSize: '0.8rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: '#94A3B8',
            textTransform: 'uppercase',
            animation: !isExiting ? `${slideInLine} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.65s both` : 'none',
          }}
        >
          {current.tag}
        </Typography>
      </Box>

      {/* Dot indicators */}
      <Box sx={{ display: 'flex', gap: 1, mt: 4 }}>
        {heroContent.map((_, i) => (
          <Box
            key={i}
            onClick={() => handleDotClick(i)}
            sx={{
              width: i === index ? 24 : 8,
              height: 8,
              borderRadius: '4px',
              bgcolor: i === index ? '#1A46B8' : 'rgba(26, 70, 184, 0.2)',
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': { bgcolor: i === index ? '#1A46B8' : 'rgba(26, 70, 184, 0.4)' },
            }}
          />
        ))}
      </Box>
    </Box>
  )
}

export default function WaitlistHero() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [expectations, setExpectations] = useState<string[]>([])
  const [customExpectation, setCustomExpectation] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleCheckboxChange = (value: string) => {
    setExpectations(prev => 
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || expectations.length === 0) return

    setStatus('loading')
    setErrorMessage('')

    try {
      const finalExpectations = expectations.filter(e => e !== 'Others')
      if (expectations.includes('Others') && customExpectation.trim() !== '') {
        finalExpectations.push(customExpectation.trim())
      }

      const res = await fetch('/api/v1/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          description: finalExpectations.join(', '),
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to join waitlist')
      }

      setStatus('success')
      setName('')
      setEmail('')
      setExpectations([])
      setCustomExpectation('')
    } catch (err: any) {
      setStatus('error')
      setErrorMessage(err.message || 'An unexpected error occurred')
    }
  }

  return (
    <Box sx={{ bgcolor: '#FAFAFA', color: '#1A1B22', fontFamily: '"Inter", sans-serif' }}>
      
      {/* 1. HERO SECTION */}
      <Box sx={{ bgcolor: '#ffffff', pt: { xs: 8, md: 12 }, pb: { xs: 8, md: 12 }, minHeight: 'calc(100vh - 80px)' }}>
        <Container maxWidth="lg">
          <Grid container spacing={6} sx={{ alignItems: 'center' }}>
            {/* Left side: animated text carousel */}
            <Grid size={{ xs: 12, md: 6 }}>
              <HeroCarousel />
            </Grid>
            
            {/* Right side form block */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper
                id="waitlist"
                elevation={0}
                sx={{ 
                  bgcolor: '#1A46B8', 
                  borderRadius: '16px', 
                  p: { xs: 4, md: 6 },
                  color: '#ffffff',
                  position: 'relative',
                  boxShadow: '0 20px 40px rgba(26, 70, 184, 0.2)',
                  animation: `${fadeInUp} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both`,
                }}
              >
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Join the Waitlist</Typography>
                <Typography sx={{ mb: 4, opacity: 0.9 }}>Be the first to experience the platform.</Typography>

                {status === 'success' ? (
                  <Alert severity="success" sx={{ bgcolor: '#ffffff', color: '#1b5e20', fontWeight: 600 }}>
                    Thank you! You have been added to the waitlist.
                  </Alert>
                ) : (
                  <Box component="form" onSubmit={handleSubmit}>
                    <Stack spacing={3}>
                      <TextField
                        fullWidth
                        placeholder="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={status === 'loading'}
                        sx={{
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-root': { '& fieldset': { border: 'none' } }
                        }}
                      />
                      <TextField
                        fullWidth
                        placeholder="Work Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={status === 'loading'}
                        sx={{
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-root': { '& fieldset': { border: 'none' } }
                        }}
                      />
                      <Box sx={{ bgcolor: '#ffffff', borderRadius: '8px', p: 2 }}>
                        <Typography sx={{ color: '#64748B', fontWeight: 600, mb: 1, fontSize: '0.85rem' }}>
                          What are you expecting to use OpenIV for? (Select multiple)
                        </Typography>
                        <FormGroup>
                          {['Fraud Prevention', 'AML Compliance', 'Transaction Monitoring', 'Customer Verification', 'Others'].map((option) => (
                            <FormControlLabel
                              key={option}
                              control={
                                <Checkbox 
                                  checked={expectations.includes(option)}
                                  onChange={() => handleCheckboxChange(option)}
                                  disabled={status === 'loading'}
                                  sx={{ color: '#E2E8F0', '&.Mui-checked': { color: '#1A46B8' } }}
                                />
                              }
                              label={<Typography sx={{ fontSize: '0.9rem', color: '#1A1B22' }}>{option}</Typography>}
                            />
                          ))}
                        </FormGroup>
                        {expectations.includes('Others') && (
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="Please specify..."
                            value={customExpectation}
                            onChange={(e) => setCustomExpectation(e.target.value)}
                            disabled={status === 'loading'}
                            sx={{ mt: 1, '& .MuiOutlinedInput-root': { bgcolor: '#F8FAFC' } }}
                          />
                        )}
                      </Box>

                      <Button
                        type="submit"
                        disabled={status === 'loading' || !name || !email || expectations.length === 0}
                        fullWidth
                        sx={{
                          bgcolor: '#1A1B22',
                          color: '#ffffff',
                          py: 2,
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          borderRadius: '8px',
                          textTransform: 'none',
                          '&:hover': { bgcolor: '#0f1014' },
                          '&.Mui-disabled': { bgcolor: 'rgba(26, 27, 34, 0.5)', color: '#ccc' }
                        }}
                      >
                        {status === 'loading' ? <CircularProgress size={24} color="inherit" /> : 'Get Early Access'}
                      </Button>
                      
                      {status === 'error' && (
                        <Typography color="error" variant="body2" sx={{ bgcolor: '#fff', p: 1, borderRadius: 1 }}>
                          {errorMessage}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  )
}
