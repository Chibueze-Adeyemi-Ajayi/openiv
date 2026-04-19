import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import ResetPasswordForm from '@/components/onboarding/ResetPasswordForm'

export default function ResetPasswordPage() {
  const navigate = useNavigate()

  const handleSubmit = (email: string) => {
    console.log('Password reset complete for:', email)
    // Redirect to login
    navigate('/auth/login')
  }

  return (
    <AuthLayout>
      <ResetPasswordForm onSubmit={handleSubmit} />
    </AuthLayout>
  )
}
