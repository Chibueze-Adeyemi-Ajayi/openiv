import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import ChangePasswordForm from '@/components/onboarding/ChangePasswordForm'

export default function ChangePasswordPage() {
  const navigate = useNavigate()

  const handleSubmit = (currentPassword: string, newPassword: string, confirmPassword: string) => {
    console.log('Password changed')
    // Password updated successfully
    navigate('/auth/login')
  }

  return (
    <AuthLayout>
      <ChangePasswordForm onSubmit={handleSubmit} />
    </AuthLayout>
  )
}
