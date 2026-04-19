import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import InviteForm from '@/components/onboarding/InviteForm'

export default function InvitePage() {
  const navigate = useNavigate()

  const handleSubmit = (inviteCode: string) => {
    console.log('Invite code:', inviteCode)
    // Verify invite and redirect to login
    navigate('/auth/login')
  }

  return (
    <AuthLayout>
      <InviteForm onSubmit={handleSubmit} />
    </AuthLayout>
  )
}
