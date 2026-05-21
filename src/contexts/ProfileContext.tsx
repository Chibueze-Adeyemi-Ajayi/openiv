import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { profileApi } from '@/api/profile'
import type { UserProfile } from '@/api/profile'

interface ProfileContextValue {
  profile: UserProfile | null
  refreshProfile: () => void
}

const ProfileContext = createContext<ProfileContextValue>({ profile: null, refreshProfile: () => {} })

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const refreshProfile = () => {
    profileApi.get().then(setProfile).catch(() => {})
  }

  useEffect(() => { refreshProfile() }, [])

  return <ProfileContext.Provider value={{ profile, refreshProfile }}>{children}</ProfileContext.Provider>
}

export const useProfile = () => useContext(ProfileContext)
