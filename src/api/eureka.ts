import { apiRequest } from './client'

export interface EurekaSetting {
  eurekaCompanionEnabled: boolean
}

export interface EurekaMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface EurekaChatRequest {
  userMessage: string
  history: EurekaMessage[]
  pageContext: string
  documentContent?: string
}

export interface EurekaChatResponse {
  reply: string
  navigate?: string
}

export const eurekaApi = {
  getSetting: () =>
    apiRequest<EurekaSetting>('/api/v1/settings/eureka'),

  updateSetting: (enabled: boolean) =>
    apiRequest<EurekaSetting>('/api/v1/settings/eureka', {
      method: 'PUT',
      body: { eurekaCompanionEnabled: enabled },
    }),

  chat: (req: EurekaChatRequest) =>
    apiRequest<EurekaChatResponse>('/api/v1/chat/eureka', {
      method: 'POST',
      body: req,
    }),
}
