import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        ws: true,
        // Disable response buffering so SSE frames flush to the browser immediately.
        // Without this, http-proxy buffers the chunked stream and the client
        // never receives events until the buffer fills or the connection closes.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Force streaming — remove any content-length that would indicate
            // a fixed-size response and ensure chunked transfer passes through.
            delete proxyRes.headers['content-length']
          })
        },
      },
    },
  },
})
