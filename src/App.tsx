import { Routes, Route } from 'react-router-dom'
import LandingPage from '@/pages/LandingPage'
import AuthInvitePage from '@/pages/auth/InvitePage'
import AuthLoginPage from '@/pages/auth/LoginPage'
import AuthVerifyEmailPage from '@/pages/auth/VerifyEmailPage'
import AuthSetup2FAPage from '@/pages/auth/Setup2FAPage'
import AuthChangePasswordPage from '@/pages/auth/ChangePasswordPage'
import AuthResetPasswordPage from '@/pages/auth/ResetPasswordPage'
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
import CBNCompliancePage from '@/pages/dashboard/CBNCompliancePage'
import BehavioralPatternsPage from '@/pages/dashboard/BehavioralPatternsPage'
import UserProfilePage from '@/pages/dashboard/UserProfilePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* Auth */}
      <Route path="/auth/invite" element={<AuthInvitePage />} />
      <Route path="/auth/login" element={<AuthLoginPage />} />
      <Route path="/auth/verify-email" element={<AuthVerifyEmailPage />} />
      <Route path="/auth/setup-2fa" element={<AuthSetup2FAPage />} />
      <Route path="/auth/change-password" element={<AuthChangePasswordPage />} />
      <Route path="/auth/reset-password" element={<AuthResetPasswordPage />} />

      {/* Dashboard — Monitor */}
      <Route path="/dashboard" element={<OverviewPage />} />
      <Route path="/dashboard/otp-alerts" element={<OTPAlertsPage />} />
      <Route path="/dashboard/transactions" element={<TransactionsPage />} />
      <Route path="/dashboard/patterns" element={<BehavioralPatternsPage />} />
      <Route path="/dashboard/aml" element={<AMLPage />} />
      <Route path="/dashboard/kyc" element={<KYCPage />} />
      <Route path="/dashboard/users/:id" element={<UserProfilePage />} />
      <Route path="/dashboard/heatmaps" element={<HeatmapsPage />} />

      {/* Dashboard — Compliance */}
      <Route path="/dashboard/cbn" element={<CBNCompliancePage />} />
      <Route path="/dashboard/reports" element={<ReportsPage />} />

      {/* Dashboard — Configure */}
      <Route path="/dashboard/thresholds" element={<ThresholdsPage />} />
      <Route path="/dashboard/beam" element={<DataBeamingPage />} />
      <Route path="/dashboard/ingest" element={<IngestionPage />} />
      <Route path="/dashboard/webhooks" element={<WebhooksPage />} />

      {/* Dashboard — Manage */}
      <Route path="/dashboard/team" element={<TeamPage />} />
      <Route path="/dashboard/billing" element={<BillingPage />} />
      <Route path="/dashboard/settings" element={<SettingsPage />} />
    </Routes>
  )
}

export default App
