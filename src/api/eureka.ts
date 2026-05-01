import { apiRequest } from './client'

export interface EurekaSetting {
  eurekaCompanionEnabled: boolean
}

export const eurekaApi = {
  getSetting: () =>
    apiRequest<EurekaSetting>('/api/v1/settings/eureka'),

  updateSetting: (enabled: boolean) =>
    apiRequest<EurekaSetting>('/api/v1/settings/eureka', {
      method: 'PUT',
      body: { eurekaCompanionEnabled: enabled },
    }),
}
