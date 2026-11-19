import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || 5173;

export default defineConfig({
  testDir: './tests/e2e-browser',
  timeout: 45000,
  expect: {
    timeout: 8000,
  },
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
