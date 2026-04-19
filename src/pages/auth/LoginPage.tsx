import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import LoginForm from '@/components/onboarding/LoginForm'

export default function LoginPage() {
  const navigate = useNavigate()

  const handleSubmit = (email: string, password: string) => {
    console.log('Login:', email, password)
    // Verify credentials
    // Redirect to email verification
    navigate('/auth/verify-email')
  }

  return (
    <AuthLayout>
      <LoginForm onSubmit={handleSubmit} />
    </AuthLayout>
  )
}
