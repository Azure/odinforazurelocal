// @ts-check
const { defineConfig } = require('@playwright/test');

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
    // 1600x900 landscape — fits inside a 1920x1080 monitor when running headed
    // (leaving room for OS taskbar + browser chrome), and still has a true 16:9
    // aspect ratio for clean LinkedIn playback.
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    video: {
      mode: 'on',
      size: { width: 1600, height: 900 },
    },
    // Run headed so you can watch the demo being recorded live.
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
      // Don't spread devices['Desktop Chrome'] here — it overrides the top-level
      // viewport (1920x1080) back to 1280x720, which leaves the page content
      // rendered in only the top-left of the 1920x1080 recording framebuffer.
      use: { browserName: 'chromium' },
    },
  ],
});
