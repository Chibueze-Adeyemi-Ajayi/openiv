import { Box } from '@mui/material'
import { colorPalette } from '@/theme'
import Navbar from '../components/landing/Navbar'
import HeroSection from '../components/landing/HeroSection'
import TrustedBy from '../components/landing/TrustedBy'
import CoreCapabilities from '../components/landing/CoreCapabilities'
import PlatformIntelligence from '../components/landing/PlatformIntelligence'
import CTASection from '../components/landing/CTASection'
import Footer from '../components/landing/Footer'

export default function LandingPage() {
  return (
    <Box sx={{ bgcolor: colorPalette.surface, minHeight: '100vh' }}>
      <Navbar />
      <HeroSection />
      <TrustedBy />
      <CoreCapabilities />
      <PlatformIntelligence />
      <CTASection />
      <Footer />
    </Box>
  )
}
