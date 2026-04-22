import { useState } from 'react'
import AuthLayout from '@/components/onboarding/AuthLayout'
import RequestAccessForm, {
  type RequestAccessFormValues,
} from '@/components/onboarding/RequestAccessForm'
import { accessRequestsApi } from '@/api/accessRequests'
import { ApiError } from '@/api/client'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

export default function RequestAccessPage() {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)

  const handleSubmit = useSubmitGuard(async (values: RequestAccessFormValues) => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await accessRequestsApi.submit({
        institutionName: values.institutionName.trim(),
        institutionType: values.institutionType,
        contactName: values.contactName.trim(),
        contactEmail: values.contactEmail.trim(),
        contactPhone: values.contactPhone.trim() || undefined,
        description: values.description.trim() || undefined,
      })
      setSucceeded(true)
    } catch (err) {
      setErrorMessage(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <AuthLayout>
      <RequestAccessForm
        onSubmit={handleSubmit}
        submitting={submitting}
        errorMessage={errorMessage}
        succeeded={succeeded}
      />
    </AuthLayout>
  )
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return "You've submitted several requests recently. Please wait an hour and try again."
    }
    if (err.code === 'invalid' && err.detail) {
      return `That ${humanizeField(err.detail)} doesn't look right. Please double-check and try again.`
    }
    return 'Submission failed. Please try again.'
  }
  return 'Network error. Please check your connection and try again.'
}

function humanizeField(field: string): string {
  switch (field) {
    case 'institutionName': return 'institution name'
    case 'institutionType': return 'institution type'
    case 'contactName': return 'contact name'
    case 'contactEmail': return 'contact email'
    case 'contactPhone': return 'contact phone number'
    case 'description': return 'description'
    case 'invalid_institutionType': return 'institution type'
    default: return 'value'
  }
}
