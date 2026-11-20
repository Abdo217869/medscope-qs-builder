import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('Verify Sidebar Customizations Panel is Harmonious, Buttons Clear, Logo Box Clamped, and Tabs Flexed', async ({ page }) => {
  test.setTimeout(60000);

  const PORT = process.env.PORT || '4173';
  await page.goto(`http://localhost:${PORT}/`);

  // Handle help modal if open
  const helpClose = page.locator('#btnCloseHelp');
  if (await helpClose.isVisible({ timeout: 1500 }).catch(() => false)) {
    await helpClose.click();
  }

  // Go to Step 3 (Studio & Settings)
  await page.locator('.step-btn[data-step="3"]').click();
  await expect(page.locator('#step3')).toBeVisible();

  // Ensure sidebar is open
  const sidebarAccordion = page.locator('#advSettingsAccordion');
  await expect(sidebarAccordion).toBeVisible();

  // 1. Verify Category Tabs are in a horizontal row (NOT vertically stacked)
  const tabsWrap = page.locator('.settings-nav-tabs');
  await expect(tabsWrap).toBeVisible();
  const tabsBox = await tabsWrap.boundingBox();
  const allTab = page.locator('.settings-tab-btn[data-tab="all"]');
  const presetsTab = page.locator('.settings-tab-btn[data-tab="presets"]');
  const allBox = await allTab.boundingBox();
  const presetsBox = await presetsTab.boundingBox();

  console.log('Tabs layout check:', {
    allTabX: allBox?.x,
    allTabY: allBox?.y,
    presetsTabX: presetsBox?.x,
    presetsTabY: presetsBox?.y
  });

  // In RTL, the tabs must be next to each other on roughly the same horizontal line (y-values close)
  expect(Math.abs((allBox?.y || 0) - (presetsBox?.y || 0))).toBeLessThan(10);

  // 2. Click on "🦅 العلامة واللوجو" tab to view the logo uploader
  const wmTab = page.locator('.settings-tab-btn[data-tab="watermark"]');
  await wmTab.click();
  await expect(wmTab).toHaveClass(/active/);

  // 3. Verify Logo Thumbnail Box is strictly clamped (NOT giant / overflowing)
  const thumbBox = page.locator('.logo-thumb-box');
  await expect(thumbBox).toBeVisible();
  const boxRect = await thumbBox.boundingBox();
  console.log('Logo thumbnail box dimensions:', boxRect?.width, 'x', boxRect?.height);
  expect(boxRect?.width).toBeLessThanOrEqual(85);
  expect(boxRect?.height).toBeLessThanOrEqual(85);

  const thumbImg = page.locator('.logo-thumb-img');
  await expect(thumbImg).toBeVisible();
  const imgRect = await thumbImg.boundingBox();
  console.log('Logo image rendered dimensions:', imgRect?.width, 'x', imgRect?.height);
  expect(imgRect?.width).toBeLessThanOrEqual(85);
  expect(imgRect?.height).toBeLessThanOrEqual(85);

  // Verify clear buttons
  await expect(page.locator('#lblLogoFile')).toBeVisible();
  await expect(page.locator('#btnRemoveLogo')).toBeVisible();
  await expect(page.locator('#btnResetDefaultLogo')).toBeVisible();

  // 4. Click on "🌟 القوالب" tab to verify Preset Cards
  const pTab = page.locator('.settings-tab-btn[data-tab="presets"]');
  await pTab.click();
  const presetCard = page.locator('.preset-card').first();
  await expect(presetCard).toBeVisible();
  const presetBox = await presetCard.boundingBox();
  console.log('Preset card dimensions:', presetBox?.width, 'x', presetBox?.height);
  expect(presetBox?.width).toBeGreaterThan(120);

  // 5. Click on "🎨 الألوان" tab to verify Palettes
  const palTab = page.locator('.settings-tab-btn[data-tab="palette"]');
  await palTab.click();
  const palCard = page.locator('.palette-card').first();
  await expect(palCard).toBeVisible();
  const palColors = palCard.locator('.pal-colors');
  await expect(palColors).toBeVisible();
  const palColorsBox = await palColors.boundingBox();
  console.log('Palette color bar height:', palColorsBox?.height);
  expect(palColorsBox?.height).toBeGreaterThanOrEqual(16);

  // 6. Reset filter back to "✨ الكل" and capture full sidebar screenshot
  await allTab.click();
  await page.waitForTimeout(300);

  if (!fs.existsSync('test-artifacts')) {
    fs.mkdirSync('test-artifacts', { recursive: true });
  }

  await sidebarAccordion.screenshot({ path: 'test-artifacts/sidebar-customizations-perfect.png' });
  console.log('Captured test-artifacts/sidebar-customizations-perfect.png');
});
