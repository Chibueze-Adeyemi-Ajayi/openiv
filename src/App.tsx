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
import NotificationsPage from '@/pages/dashboard/NotificationsPage'
import UserProfilePage from '@/pages/dashboard/UserProfilePage'
import AuthVerifyTOTPPage from '@/pages/auth/VerifyTOTPPage'
import GeoBlockedPage from '@/pages/auth/GeoBlockedPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import PublicRoute from '@/components/auth/PublicRoute'
import DashboardLayout from '@/components/dashboard/DashboardLayout'

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

      {/* Dashboard */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<OverviewPage />} />
        <Route path="otp-alerts" element={<OTPAlertsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="patterns" element={<BehavioralPatternsPage />} />
        <Route path="aml" element={<AMLPage />} />
        <Route path="kyc" element={<KYCPage />} />
        <Route path="users/:id" element={<UserProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="heatmaps" element={<HeatmapsPage />} />
        <Route path="cbn" element={<CBNCompliancePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="thresholds" element={<ThresholdsPage />} />
        <Route path="network" element={<NetworkPage />} />
        <Route path="beam" element={<DataBeamingPage />} />
        <Route path="ingest" element={<IngestionPage />} />
        <Route path="webhooks" element={<WebhooksPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
