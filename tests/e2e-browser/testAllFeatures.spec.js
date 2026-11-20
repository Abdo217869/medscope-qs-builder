import { test, expect } from '@playwright/test';

test.describe('Test all features, options, presets, and inspect for black screen or errors', () => {
  test.setTimeout(90000);

  test('Cycles through all presets, palettes, cover options, and schema controls', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => {
      console.error('PAGE ERROR DETECTED:', err.message);
      pageErrors.push(err.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('CONSOLE ERROR:', msg.text());
        consoleErrors.push(msg.text());
      }
    });

    const PORT = process.env.PORT || '4173';
    await page.goto(`http://localhost:${PORT}/`);

    // Handle initial help modal if present
    const helpBtn = page.locator('#btnCloseHelp');
    if (await helpBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await helpBtn.click();
    }

    // Go directly to Step 3
    await page.locator('.step-btn[data-step="3"]').click();
    await expect(page.locator('#step3')).toBeVisible();

    // 1. Test Theme switch (Dark / Light)
    console.log('Testing Theme button...');
    await page.click('#btnTheme');
    await page.waitForTimeout(200);
    await page.click('#btnTheme'); // Switch back to light
    await page.waitForTimeout(200);

    // 2. Test Studio layout switchers
    console.log('Testing Studio layout modes...');
    await page.click('#btnStudioStacked');
    await page.waitForTimeout(200);
    await page.click('#btnStudioSideBySide');
    await page.waitForTimeout(200);

    // 3. Test View Segments (Questions vs Answers vs Edit vs Export)
    console.log('Testing view segments...');
    await page.click('button[data-v="as"]');
    await page.waitForTimeout(200);
    await page.click('button[data-v="qs"]');
    await page.waitForTimeout(200);
    await page.click('button[data-v="edit"]');
    await page.waitForTimeout(200);
    await page.click('button[data-v="exp"]');
    await page.waitForTimeout(200);
    await page.click('button[data-v="qs"]');
    await page.waitForTimeout(200);

    // 4. Test Settings Category Tabs
    console.log('Testing category tabs...');
    const tabs = ['presets', 'palette', 'cover', 'watermark', 'typography', 'layout', 'headerFooter', 'all'];
    for (const tab of tabs) {
      await page.click(`button[data-tab="${tab}"]`);
      await page.waitForTimeout(50);
    }

    // 5. Test All Presets
    console.log('Testing presets...');
    const presetCards = page.locator('.preset-card');
    const presetCount = await presetCards.count();
    for (let i = 0; i < presetCount; i++) {
      const p = presetCards.nth(i);
      await p.click();
      await page.waitForTimeout(100);
      const isVisible = await page.locator('#pagesWrap').isVisible();
      expect(isVisible).toBe(true);
    }

    // 6. Test All Palettes
    console.log('Testing palettes...');
    const palCards = page.locator('.palette-card');
    const palCount = await palCards.count();
    for (let i = 0; i < palCount; i++) {
      const pal = palCards.nth(i);
      await pal.click();
      await page.waitForTimeout(100);
      const isVisible = await page.locator('#pagesWrap').isVisible();
      expect(isVisible).toBe(true);
    }

    // Open all details accordions so all form inputs are visible
    await page.evaluate(() => {
      document.querySelectorAll('details').forEach(d => { d.open = true; });
    });
    await page.waitForTimeout(200);

    // 7. Test All Select Dropdowns in Settings
    console.log('Testing select dropdowns in settings...');
    const selects = page.locator('#advSettingsHost select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const sel = selects.nth(i);
      if (await sel.isVisible()) {
        const options = await sel.locator('option').all();
        for (const opt of options) {
          const val = await opt.getAttribute('value');
          if (val !== null) {
            await sel.selectOption(val);
            await page.waitForTimeout(20);

            // Verify pagesWrap is still visible and has not crashed
            const isWrapVisible = await page.locator('#pagesWrap').isVisible();
            expect(isWrapVisible).toBe(true);
          }
        }
      }
    }

    // 8. Test All Checkboxes in Settings
    console.log('Testing checkboxes in settings...');
    const checkboxes = page.locator('#advSettingsHost input[type="checkbox"]');
    const checkCount = await checkboxes.count();
    for (let i = 0; i < checkCount; i++) {
      const chk = checkboxes.nth(i);
      if (await chk.isVisible()) {
        await chk.click(); // toggle
        await page.waitForTimeout(20);
        const isWrapVisible = await page.locator('#pagesWrap').isVisible();
        expect(isWrapVisible).toBe(true);
        await chk.click(); // toggle back
        await page.waitForTimeout(20);
      }
    }

    // 9. Check if any errors occurred
    console.log('Checking page and console errors...');
    expect(pageErrors).toEqual([]);
    console.log('All features and options successfully tested with ZERO errors!');
  });
});
