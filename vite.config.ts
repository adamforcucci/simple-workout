/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Bundled into the APK and loaded from disk, so chunk size doesn't cost a download.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    // web/ is a separate Next.js project with its own tests.
    exclude: ['**/node_modules/**', 'web/**'],
  },
})
