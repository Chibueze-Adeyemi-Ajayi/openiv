import { Routes, Route } from 'react-router-dom'
import NotFoundPage, { DashboardNotFoundPage } from '@/pages/NotFoundPage'
import LandingPage from '@/pages/LandingPage'
import SolutionsPage from '@/pages/landing/SolutionsPage'
import LandingNetworkPage from '@/pages/landing/NetworkPage'
import CompliancePage from '@/pages/landing/CompliancePage'
import SecurityPage from '@/pages/landing/SecurityPage'
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
import CasePage from '@/pages/dashboard/CasePage'
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
import SurgeInvestigationPage from '@/pages/dashboard/SurgeInvestigationPage'
import UserProfilePage from '@/pages/dashboard/UserProfilePage'
import ProfilePage from '@/pages/dashboard/ProfilePage'
import HighRiskCustomersPage from '@/pages/dashboard/HighRiskCustomersPage'
import CustomersPage from '@/pages/dashboard/CustomersPage'
import AuthVerifyTOTPPage from '@/pages/auth/VerifyTOTPPage'
import GeoBlockedPage from '@/pages/auth/GeoBlockedPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import PublicRoute from '@/components/auth/PublicRoute'
import RoleGuard from '@/components/auth/RoleGuard'
import SuperAdminRoute from '@/components/auth/SuperAdminRoute'
import SuperAdminLayout from '@/pages/superadmin/SuperAdminLayout'
import AccessRequestsPage from '@/pages/superadmin/AccessRequestsPage'
import InstitutionsPage from '@/pages/superadmin/InstitutionsPage'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ComingSoonOverlay from '@/components/dashboard/ComingSoonOverlay'
import { isBuildOne } from '@/utils/build'

function ComingSoonRoute({ children, title }: { children: React.ReactNode; title: string }) {
  if (isBuildOne) {
    return <ComingSoonOverlay title={title} fullPage />
  }
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/solutions" element={<SolutionsPage />} />
      <Route path="/network" element={<LandingNetworkPage />} />
      <Route path="/compliance" element={<CompliancePage />} />
      <Route path="/security" element={<SecurityPage />} />

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
        <Route path="otp-alerts" element={<ComingSoonRoute title="Real-Time OTP Defense"><RoleGuard permission="transactions.view"><OTPAlertsPage /></RoleGuard></ComingSoonRoute>} />
        <Route path="transactions" element={<RoleGuard permission="transactions.view"><TransactionsPage /></RoleGuard>} />
        <Route path="patterns" element={<ComingSoonRoute title="Behavioral Pattern Matching"><RoleGuard permission="transactions.view"><BehavioralPatternsPage /></RoleGuard></ComingSoonRoute>} />
        <Route path="aml" element={<RoleGuard permission="cases.view"><AMLPage /></RoleGuard>} />
        <Route path="cases/:id" element={<RoleGuard permission="cases.view"><CasePage /></RoleGuard>} />
        <Route path="kyc" element={<RoleGuard permission="kyc.view"><KYCPage /></RoleGuard>} />
        <Route path="customers" element={<RoleGuard permission="customers.view"><CustomersPage /></RoleGuard>} />
        <Route path="users/:id" element={<RoleGuard permission="customers.view"><UserProfilePage /></RoleGuard>} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="high-risk" element={<RoleGuard permission="customers.view"><HighRiskCustomersPage /></RoleGuard>} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="investigate/:alertId" element={<RoleGuard permission="cases.view"><SurgeInvestigationPage /></RoleGuard>} />
        <Route path="heatmaps" element={<ComingSoonRoute title="Geospatial Heatmaps"><RoleGuard permission="dashboard.view"><HeatmapsPage /></RoleGuard></ComingSoonRoute>} />
        <Route path="cbn" element={<RoleGuard permission="reports.view"><CBNCompliancePage /></RoleGuard>} />
        <Route path="reports" element={<RoleGuard permission="reports.view"><ReportsPage /></RoleGuard>} />
        <Route path="thresholds" element={<RoleGuard permission="rules.view"><ThresholdsPage /></RoleGuard>} />
        <Route path="network" element={<RoleGuard permission="integrations.view"><NetworkPage /></RoleGuard>} />
        <Route path="beam" element={<RoleGuard permission="integrations.view"><DataBeamingPage /></RoleGuard>} />
        <Route path="ingest" element={<RoleGuard permission="integrations.view"><IngestionPage /></RoleGuard>} />
        <Route path="webhooks" element={<RoleGuard permission="integrations.view"><WebhooksPage /></RoleGuard>} />
        <Route path="team" element={<RoleGuard permission="team.view"><TeamPage /></RoleGuard>} />
        <Route path="billing" element={<RoleGuard permission="billing.view"><BillingPage /></RoleGuard>} />
        <Route path="settings" element={<RoleGuard permission="settings.view"><SettingsPage /></RoleGuard>} />
        <Route path="*" element={<DashboardNotFoundPage />} />
      </Route>

      {/* Super Admin */}
      <Route path="/superadmin" element={<SuperAdminRoute><SuperAdminLayout /></SuperAdminRoute>}>
        <Route index element={<AccessRequestsPage />} />
        <Route path="requests" element={<AccessRequestsPage />} />
        <Route path="institutions" element={<InstitutionsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
