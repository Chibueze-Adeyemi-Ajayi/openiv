import '@testing-library/jest-dom'
import { vi } from 'vitest'

// clipboard API not available in jsdom
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

// IntersectionObserver not available in jsdom
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver
