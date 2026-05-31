import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // Playwright specs live in e2e/ and must not be collected by Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
