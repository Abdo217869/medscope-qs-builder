import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || 4173;

export default defineConfig({
  testDir: './tests/e2e-browser',
  timeout: 45000,
  expect: {
    timeout: 8000,
  },
  workers: 1, // Sequential execution prevents race conditions on LocalStorage & IndexedDB
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
