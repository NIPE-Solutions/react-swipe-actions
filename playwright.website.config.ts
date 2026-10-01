import { defineConfig } from '@playwright/test'

import config from './playwright.config'

export default defineConfig({
  ...config,
  testDir: './test/browser/website',
  testMatch: 'support-cta.spec.ts',
  webServer: {
    command:
      'npx vite preview --config website/vite.config.ts --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
})
