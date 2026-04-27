export interface UploadedDocument {
  id: number
  filename: string
}

export const documentApi = {
  upload: async (file: File): Promise<UploadedDocument> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/v1/documents/upload', {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? `Upload failed (${res.status})`)
    }
    return res.json()
  },
}
