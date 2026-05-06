import { apiRequest } from './client'

export interface AmlSettings {
  id: number
  institutionId: number
  autoOpenCase: boolean
  caseNotificationEmails?: string[]
  riskScoreFlagThreshold: number
  riskScoreCaseThreshold: number;
  behRiskScoreFlagThreshold: number;
  behRiskScoreCaseThreshold: number;
  riskScoreNormalThreshold: number;
  behRiskScoreNormalThreshold: number;
}

export const amlApi = {
  getSettings: () =>
    apiRequest<{ settings: AmlSettings }>('/api/v1/aml-settings'),

  updateSettings: (data: { autoOpenCase: boolean; riskScoreFlagThreshold?: number; riskScoreCaseThreshold?: number;
  behRiskScoreFlagThreshold?: number;
  behRiskScoreCaseThreshold?: number;
  riskScoreNormalThreshold?: number;
  behRiskScoreNormalThreshold?: number; }) =>
    apiRequest<{ settings: AmlSettings }>('/api/v1/aml-settings', {
      method: 'PUT',
      body: data,
    }),

  addNotificationEmail: (email: string) =>
    apiRequest<{ settings: AmlSettings }>('/api/v1/aml-settings/notifications/email', {
      method: 'POST',
      body: { email },
    }),

  removeNotificationEmail: (email: string) =>
    apiRequest<{ settings: AmlSettings }>(`/api/v1/aml-settings/notifications/email?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
    }),
}
