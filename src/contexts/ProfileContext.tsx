import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { profileApi } from '@/api/profile'
import type { UserProfile } from '@/api/profile'

interface ProfileContextValue {
  profile: UserProfile | null
  refreshProfile: () => void
  updateProfile: (partial: Partial<UserProfile>) => void
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  refreshProfile: () => {},
  updateProfile: () => {},
})

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const refreshProfile = useCallback(() => {
    profileApi.get().then(setProfile).catch(() => {})
  }, [])

  const updateProfile = useCallback((partial: Partial<UserProfile>) => {
    setProfile(prev => prev ? { ...prev, ...partial } : prev)
  }, [])

  useEffect(() => { refreshProfile() }, [refreshProfile])

  return (
    <ProfileContext.Provider value={{ profile, refreshProfile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfile = () => useContext(ProfileContext)
