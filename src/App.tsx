import { Routes, Route } from 'react-router-dom'
import LandingPage from '@/pages/LandingPage'
import AuthInvitePage from '@/pages/auth/InvitePage'
import AuthLoginPage from '@/pages/auth/LoginPage'
import AuthVerifyEmailPage from '@/pages/auth/VerifyEmailPage'
import AuthSetup2FAPage from '@/pages/auth/Setup2FAPage'
import AuthChangePasswordPage from '@/pages/auth/ChangePasswordPage'
import AuthResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import RequestAccessPage from '@/pages/auth/RequestAccessPage'
import OverviewPage from '@/pages/dashboard/OverviewPage'
import TransactionsPage from '@/pages/dashboard/TransactionsPage'
import AMLPage from '@/pages/dashboard/AMLPage'
import KYCPage from '@/pages/dashboard/KYCPage'
import HeatmapsPage from '@/pages/dashboard/HeatmapsPage'
import ReportsPage from '@/pages/dashboard/ReportsPage'
import ThresholdsPage from '@/pages/dashboard/ThresholdsPage'
import WebhooksPage from '@/pages/dashboard/WebhooksPage'
import IngestionPage from '@/pages/dashboard/IngestionPage'
import TeamPage from '@/pages/dashboard/TeamPage'
import SettingsPage from '@/pages/dashboard/SettingsPage'
import BillingPage from '@/pages/dashboard/BillingPage'
import OTPAlertsPage from '@/pages/dashboard/OTPAlertsPage'
import DataBeamingPage from '@/pages/dashboard/DataBeamingPage'
import NetworkPage from '@/pages/dashboard/NetworkPage'
import CBNCompliancePage from '@/pages/dashboard/CBNCompliancePage'
import BehavioralPatternsPage from '@/pages/dashboard/BehavioralPatternsPage'
import UserProfilePage from '@/pages/dashboard/UserProfilePage'
import AuthVerifyTOTPPage from '@/pages/auth/VerifyTOTPPage'
import GeoBlockedPage from '@/pages/auth/GeoBlockedPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import PublicRoute from '@/components/auth/PublicRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* Auth */}
      <Route path="/auth/invite" element={<AuthInvitePage />} />
      <Route path="/auth/login" element={<PublicRoute><AuthLoginPage /></PublicRoute>} />
      <Route path="/auth/verify-email" element={<ProtectedRoute requiredState="pending_email_verification"><AuthVerifyEmailPage /></ProtectedRoute>} />
      <Route path="/auth/setup-2fa" element={<ProtectedRoute requiredState="pending_totp_setup"><AuthSetup2FAPage /></ProtectedRoute>} />
      <Route path="/auth/verify-otp" element={<ProtectedRoute requiredState="pending_totp_challenge"><AuthVerifyTOTPPage /></ProtectedRoute>} />
      <Route path="/auth/geo-blocked" element={<GeoBlockedPage />} />
      <Route path="/auth/change-password" element={<AuthChangePasswordPage />} />
      <Route path="/auth/reset-password" element={<AuthResetPasswordPage />} />
      <Route path="/request-access" element={<PublicRoute><RequestAccessPage /></PublicRoute>} />

      {/* Dashboard — Monitor */}
      <Route path="/dashboard" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
      <Route path="/dashboard/otp-alerts" element={<ProtectedRoute><OTPAlertsPage /></ProtectedRoute>} />
      <Route path="/dashboard/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
      <Route path="/dashboard/patterns" element={<ProtectedRoute><BehavioralPatternsPage /></ProtectedRoute>} />
      <Route path="/dashboard/aml" element={<ProtectedRoute><AMLPage /></ProtectedRoute>} />
      <Route path="/dashboard/kyc" element={<ProtectedRoute><KYCPage /></ProtectedRoute>} />
      <Route path="/dashboard/users/:id" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
      <Route path="/dashboard/heatmaps" element={<ProtectedRoute><HeatmapsPage /></ProtectedRoute>} />

      {/* Dashboard — Compliance */}
      <Route path="/dashboard/cbn" element={<ProtectedRoute><CBNCompliancePage /></ProtectedRoute>} />
      <Route path="/dashboard/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />

      {/* Dashboard — Configuration */}
      <Route path="/dashboard/thresholds" element={<ProtectedRoute><ThresholdsPage /></ProtectedRoute>} />
      <Route path="/dashboard/network"    element={<ProtectedRoute><NetworkPage /></ProtectedRoute>} />
      <Route path="/dashboard/beam"       element={<ProtectedRoute><DataBeamingPage /></ProtectedRoute>} />
      <Route path="/dashboard/ingest"     element={<ProtectedRoute><IngestionPage /></ProtectedRoute>} />
      <Route path="/dashboard/webhooks"   element={<ProtectedRoute><WebhooksPage /></ProtectedRoute>} />

      {/* Dashboard — Manage */}
      <Route path="/dashboard/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
      <Route path="/dashboard/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
      <Route path="/dashboard/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
