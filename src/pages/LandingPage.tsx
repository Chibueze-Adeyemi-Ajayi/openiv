import { Box } from '@mui/material'
import Navbar from '../components/landing/Navbar'
import WaitlistHero from '../components/landing/WaitlistHero'
import Footer from '../components/landing/Footer'

export default function LandingPage() {
  return (
    <Box sx={{ bgcolor: '#00288e', minHeight: '100vh' }}>
      <Navbar />
      <WaitlistHero />
      <Footer />
    </Box>
  )
}
