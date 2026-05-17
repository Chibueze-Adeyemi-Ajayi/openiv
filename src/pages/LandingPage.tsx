import { Box } from '@mui/material'
import Navbar from '../components/landing/Navbar'
import WaitlistHero from '../components/landing/WaitlistHero'
import Footer from '../components/landing/Footer'
import { useSEO } from '@/hooks/useSEO'

export default function LandingPage() {
  useSEO({
    title: 'AML Surveillance, KYC & Fraud Detection Platform',
    description: 'OpenIV delivers real-time AML surveillance, behavioural KYC, and sub-14ms fraud detection for Nigerian banks and fintechs. CBN, NFIU & NDPR aligned.',
    canonical: '/',
    ogImage: 'https://openiv.ng/assets/landing/dashboard.png',
  })
  return (
    <Box sx={{ bgcolor: '#00288e', minHeight: '100vh' }}>
      <Navbar />
      <WaitlistHero />
      <Footer />
    </Box>
  )
}
