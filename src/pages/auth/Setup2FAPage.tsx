import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import Setup2FAForm from '@/components/onboarding/Setup2FAForm'

export default function Setup2FAPage() {
  const navigate = useNavigate()

  const handleSubmit = (method: string) => {
    console.log('2FA method:', method)
    // 2FA verified
    // Redirect to dashboard or next step
    navigate('/')
  }

  return (
    <AuthLayout>
      <Setup2FAForm onSubmit={handleSubmit} />
    </AuthLayout>
  )
}
