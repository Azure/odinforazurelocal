// @ts-check
/**
 * ODIN Sizer walkthrough demo.
 * Produces a short video showing: landing page → add a VM workload → view results.
 *
 * Run with:  npm run demo:sizer
 * Requires:  tests/serve.ps1 running on http://localhost:5500
 */
const { test, expect } = require('@playwright/test');

test('Sizer walkthrough', async ({ page }) => {
  // 1. Open the Sizer
  await page.goto('/sizer/index.html');
  await expect(page.locator('h1.header-title')).toContainText('ODIN Sizer');
  await page.waitForTimeout(1500);

  // 2. Scroll the disclaimer/header into view so the viewer reads it briefly
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(1000);

  // 3. Click "Add VM Workload"
  await page.locator('button.workload-type-btn').filter({ hasText: /VM/i }).first().click();
  await page.waitForTimeout(800);

  // 4. Interact with the Add Workload modal (if it opens)
  const modal = page.locator('#add-workload-modal');
  if (await modal.isVisible().catch(() => false)) {
    // Fill in a reasonable example — selectors are defensive; ignore any that don't exist
    const nameInput = modal.locator('input[type="text"]').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('Demo SQL Server VMs');
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(800);

    // Submit
    await page.locator('#modal-submit-btn').click();
    await page.waitForTimeout(1500);
  }

  // 5. Tour the cluster configuration panel
  await page.locator('#cluster-type').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);

  await page.locator('#node-count').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  await page.locator('#cpu-manufacturer').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // 6. Scroll to the results / requirements summary
  const totalVcpus = page.locator('#total-vcpus');
  if (await totalVcpus.count() > 0) {
    await totalVcpus.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
  }

  // 7. Final hold so the last frame isn't cut off
  await page.waitForTimeout(1500);
});
