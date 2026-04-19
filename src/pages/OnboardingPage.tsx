import { useState } from 'react'
import AuthLayout from '../components/onboarding/AuthLayout'
import InviteForm from '../components/onboarding/InviteForm'
import LoginForm from '../components/onboarding/LoginForm'
import VerifyEmailForm from '../components/onboarding/VerifyEmailForm'
import Setup2FAForm from '../components/onboarding/Setup2FAForm'
import ChangePasswordForm from '../components/onboarding/ChangePasswordForm'
import ResetPasswordForm from '../components/onboarding/ResetPasswordForm'

type OnboardingStep = 'invite' | 'login' | 'verify-email' | 'setup-2fa' | 'change-password' | 'reset-password'

export default function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>('login')
  const [email, setEmail] = useState('')

  const handleInviteSubmit = (inviteCode: string) => {
    console.log('Invite code:', inviteCode)
    // Verify invite and proceed to login
    setStep('login')
  }

  const handleLoginSubmit = (loginEmail: string, password: string) => {
    console.log('Login:', loginEmail, password)
    setEmail(loginEmail)
    // Verify credentials and proceed to email verification
    setStep('verify-email')
  }

  const handleVerifyEmail = (code: string) => {
    console.log('Email verification code:', code)
    // Verify code and proceed to 2FA setup
    setStep('setup-2fa')
  }

  const handleSetup2FA = (method: string) => {
    console.log('2FA method:', method)
    // 2FA verified, proceed to complete onboarding
    // In a real app, would redirect to dashboard
    setStep('login')
  }

  const handleChangePassword = (currentPassword: string, newPassword: string, confirmPassword: string) => {
    console.log('Password changed')
    // Password updated successfully
    setStep('login')
  }

  const handleResetPassword = (resetEmail: string) => {
    console.log('Password reset complete for:', resetEmail)
    // Redirect to login
    setStep('login')
  }

  return (
    <AuthLayout>
      {step === 'invite' && <InviteForm onSubmit={handleInviteSubmit} />}
      {step === 'login' && <LoginForm onSubmit={handleLoginSubmit} />}
      {step === 'verify-email' && <VerifyEmailForm email={email} onSubmit={handleVerifyEmail} />}
      {step === 'setup-2fa' && <Setup2FAForm onSubmit={handleSetup2FA} />}
      {step === 'change-password' && <ChangePasswordForm onSubmit={handleChangePassword} />}
      {step === 'reset-password' && <ResetPasswordForm onSubmit={handleResetPassword} />}
    </AuthLayout>
  )
}
