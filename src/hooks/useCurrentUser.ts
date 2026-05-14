import { useState, useEffect } from 'react'
import { authApi } from '@/api/auth'
import { setDisplayTimezone } from '@/utils/dateTime'

export interface CurrentUser {
  email: string
  fullName: string | null
  role: string | null
  /** First name extracted from fullName, or local part of email as fallback. */
  firstName: string
  timezone: string
  userId: number | null
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    authApi.session()
      .then(res => {
        const fullName  = res.fullName ?? null
        const email     = res.email ?? ''
        const firstName = fullName
          ? fullName.split(' ')[0]
          : email.split('@')[0]
        if (res.timezone) setDisplayTimezone(res.timezone)
        setUser({ email, fullName, role: res.role ?? null, firstName, timezone: res.timezone ?? 'Africa/Lagos', userId: res.userId ?? null })
      })
      .catch(() => {})
  }, [])

  return user
}
