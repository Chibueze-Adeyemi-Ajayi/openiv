import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import VerifyEmailForm from '@/components/onboarding/VerifyEmailForm'

export default function VerifyEmailPage() {
  const navigate = useNavigate()

  const handleSubmit = (code: string) => {
    console.log('Email verification code:', code)
    // Verify code
    // Redirect to 2FA setup
    navigate('/auth/setup-2fa')
  }

  return (
    <AuthLayout>
      <VerifyEmailForm onSubmit={handleSubmit} />
    </AuthLayout>
  )
}
