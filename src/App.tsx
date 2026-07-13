import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

import LandingPage from '@/pages/LandingPage'
import SolutionsPage from '@/pages/landing/SolutionsPage'
import NetworkPage from '@/pages/landing/NetworkPage'
import CompliancePage from '@/pages/landing/CompliancePage'
import SecurityPage from '@/pages/landing/SecurityPage'
// import DevelopersPage from '@/pages/landing/DevelopersPage'
import PrivacyPage from '@/pages/landing/PrivacyPage'
import TermsPage from '@/pages/landing/TermsPage'
import RequestAccessPage from '@/pages/RequestAccessPage'
import NotFoundPage from '@/pages/NotFoundPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/solutions" element={<SolutionsPage />} />
        <Route path="/network" element={<NetworkPage />} />
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/security" element={<SecurityPage />} />
        {/* <Route path="/developers" element={<DevelopersPage />} /> */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/request-access" element={<RequestAccessPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
