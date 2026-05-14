import { Box } from '@mui/material'
import { colorPalette } from '@/theme'
import Navbar from '../components/landing/Navbar'
import HeroSection from '../components/landing/HeroSection'
import InstitutionalMetrics from '../components/landing/InstitutionalMetrics'
import CoreCapabilities from '../components/landing/CoreCapabilities'
import TrustedBy from '../components/landing/TrustedBy'
import AlternatingFeatures from '../components/landing/AlternatingFeatures'
import FAQSection from '../components/landing/FAQSection'
import CTASection from '../components/landing/CTASection'
import Footer from '../components/landing/Footer'

export default function LandingPage() {
  return (
    <Box sx={{ bgcolor: '#00288e', minHeight: '100vh' }}>
      <Navbar />
      <HeroSection />
      <InstitutionalMetrics />
      <CoreCapabilities />
      <TrustedBy />
      <AlternatingFeatures />
      <FAQSection />
      <CTASection />
      <Footer />
    </Box>
  )
}
