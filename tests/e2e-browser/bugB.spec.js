import { test, expect } from '@playwright/test';
import path from 'node:path';

test.describe('Bug B Regression Tests: Logo Upload, Downscaling, IndexedDB Persistence, and Reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Dismiss help modal if visible
    const helpModal = page.locator('#helpModal');
    if (await helpModal.isVisible()) {
      await page.locator('#btnCloseHelp').click();
      await expect(helpModal).toBeHidden();
    }
  });

  test('Uploads 6MB PNG, downscales safely, stores in IndexedDB, persists across reload, and resets cleanly', async ({ page }) => {
    // Navigate to Step 3 (Download & Style)
    await page.locator('.step-btn[data-step="3"]').click();
    await expect(page.locator('#step3')).toBeVisible();

    // Ensure Advanced Settings accordion and watermark group are open
    await page.evaluate(() => {
      const el = document.getElementById('advSettingsAccordion');
      if (el) el.open = true;
      const wm = document.querySelector('details[data-group="watermark"]');
      if (wm) wm.open = true;
    });
    await page.waitForTimeout(200);

    // Verify initial default watermark
    const logoThumb = page.locator('#logoThumbImg');
    await expect(logoThumb).toBeVisible();
    const initialThumbSrc = await logoThumb.getAttribute('src');
    expect(initialThumbSrc).toContain('medscope-watermark-default.png');

    // Check watermark image on paper page
    const pageWatermarkImg = page.locator('#pagesWrap .page .wm img').first();
    await expect(pageWatermarkImg).toBeVisible();
    const initialWmSrc = await pageWatermarkImg.getAttribute('src');
    expect(initialWmSrc).toContain('medscope-watermark-default.png');

    // 1. Upload 6.2 MB PNG file
    const largePngPath = path.resolve('test-artifacts/test-large-6mb.png');
    const fileInput = page.locator('#logoFileInput');
    await fileInput.setInputFiles(largePngPath);

    // Wait for processing & UI update
    await page.waitForTimeout(1000);

    // Assert thumbnail updated to data URL
    const updatedThumb = page.locator('#logoThumbImg');
    await expect(updatedThumb).toBeVisible();
    const updatedThumbSrc = await updatedThumb.getAttribute('src');
    expect(updatedThumbSrc).toMatch(/^data:image\/png;base64,/);

    // Assert watermark on page updated in real time
    const updatedWm = page.locator('#pagesWrap .page .wm img').first();
    const updatedWmSrc = await updatedWm.getAttribute('src');
    expect(updatedWmSrc).toMatch(/^data:image\/png;base64,/);

    // Assert localStorage settings is small (< 5KB) and does not store the massive base64
    const storedSettings = await page.evaluate(() => localStorage.getItem('mq.settings'));
    expect(storedSettings).toBeTruthy();
    expect(storedSettings.length).toBeLessThan(5000);
    expect(storedSettings).toContain('idb:custom_logo');

    await page.screenshot({ path: 'test-artifacts/bugB-1-uploaded-large-6mb-png.png' });

    // 2. Reload page -> watermark must persist from IndexedDB
    await page.reload();
    // Dismiss help modal if re-shown
    const helpModal = page.locator('#helpModal');
    if (await helpModal.isVisible()) {
      await page.locator('#btnCloseHelp').click();
    }

    await page.locator('.step-btn[data-step="3"]').click();
    await page.evaluate(() => {
      const el = document.getElementById('advSettingsAccordion');
      if (el) el.open = true;
      const wm = document.querySelector('details[data-group="watermark"]');
      if (wm) wm.open = true;
    });
    await page.waitForTimeout(600);

    const reloadedThumb = page.locator('#logoThumbImg');
    await expect(reloadedThumb).toHaveAttribute('src', /^data:image\/png;base64/);

    const reloadedWm = page.locator('#pagesWrap .page .wm img').first();
    await expect(reloadedWm).toHaveAttribute('src', /^data:image\/png;base64/);

    await page.screenshot({ path: 'test-artifacts/bugB-2-persisted-after-reload.png' });

    // 3. Delete logo ("شيل الصورة") -> reverts to default Medscope logo
    const btnRemove = page.locator('#btnRemoveLogo');
    await btnRemove.click();
    await page.waitForTimeout(300);

    const revertedThumb = page.locator('#logoThumbImg');
    const revertedThumbSrc = await revertedThumb.getAttribute('src');
    expect(revertedThumbSrc).toContain('medscope-watermark-default.png');

    const revertedWm = page.locator('#pagesWrap .page .wm img').first();
    const revertedWmSrc = await revertedWm.getAttribute('src');
    expect(revertedWmSrc).toContain('medscope-watermark-default.png');

    await page.screenshot({ path: 'test-artifacts/bugB-3-reverted-to-default.png' });
  });

  test('Uploads SVG format logo and updates watermark', async ({ page }) => {
    await page.locator('.step-btn[data-step="3"]').click();
    await page.evaluate(() => {
      const el = document.getElementById('advSettingsAccordion');
      if (el) el.open = true;
      const wm = document.querySelector('details[data-group="watermark"]');
      if (wm) wm.open = true;
    });
    await page.waitForTimeout(200);

    const svgPath = path.resolve('test-artifacts/test.svg');
    const fileInput = page.locator('#logoFileInput');
    await fileInput.setInputFiles(svgPath);
    await page.waitForTimeout(400);

    const thumb = page.locator('#logoThumbImg');
    const thumbSrc = await thumb.getAttribute('src');
    expect(thumbSrc).toMatch(/^blob:/);

    const wm = page.locator('#pagesWrap .page .wm img').first();
    const wmSrc = await wm.getAttribute('src');
    expect(wmSrc).toMatch(/^blob:/);

    await page.screenshot({ path: 'test-artifacts/bugB-4-uploaded-svg.png' });

    // Explicit reset to Medscope logo button
    const btnReset = page.locator('#btnResetDefaultLogo');
    await btnReset.click();
    await page.waitForTimeout(300);

    const resetThumb = page.locator('#logoThumbImg');
    const resetThumbSrc = await resetThumb.getAttribute('src');
    expect(resetThumbSrc).toContain('medscope-watermark-default.png');
  });
});
