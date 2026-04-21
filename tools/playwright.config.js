// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright config for ODIN demo video recording.
 * Not a test runner — we use Playwright purely to script the browser and capture video.
 */
module.exports = defineConfig({
  testDir: './demos',
  testMatch: '**/*.spec.js',
  timeout: 5 * 60 * 1000, // 5 min per demo
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: './output',
  use: {
    baseURL: 'http://localhost:5500',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    // Record every action — we want the video regardless of pass/fail
    video: {
      mode: 'on',
      size: { width: 1920, height: 1080 },
    },
    // Run headed so the user can watch the demo being recorded
    headless: false,
    // Slow down actions slightly so the resulting video is human-watchable
    launchOptions: {
      slowMo: 250,
    },
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
  },
  projects: [
    {
      name: 'chromium-1080p',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
