const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('1. Navigating to http://localhost:4173/ ...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });

  // Dismiss help modal if visible
  const helpModal = page.locator('#helpModal');
  if (await helpModal.isVisible()) {
    await page.locator('#btnCloseHelp').click();
    await page.waitForTimeout(200);
  }

  // Load sample questions (5 sections)
  console.log('2. Loading sample questions...');
  await page.locator('#btnSample').click();
  await page.waitForTimeout(600);

  // Navigate to Step 3
  console.log('3. Navigating to Step 3...');
  await page.locator('.step-btn[data-step="3"]').click();
  await page.waitForTimeout(500);

  // Open the studio accordion
  await page.evaluate(() => {
    const el = document.getElementById('advSettingsAccordion');
    if (el) el.open = true;
  });
  await page.waitForTimeout(300);

  // Click "📑 الصفحات الفاصلة" tab
  console.log('4. Clicking "📑 الصفحات الفاصلة" tab in studio sidebar...');
  const dividerTab = page.locator('.settings-tab-btn[data-tab="dividers"]');
  await dividerTab.click();
  await page.waitForTimeout(400);

  // Verify that Individual Dividers Manager shows cards for sections
  console.log('5. Verifying Per-Section Individual Dividers Manager...');
  const dividerCards = page.locator('.sec-divider-card');
  const cardsCount = await dividerCards.count();
  console.log(`Found ${cardsCount} individual section divider cards in sidebar.`);
  if (cardsCount === 0) {
    throw new Error('Expected individual divider cards for each section!');
  }

  // Test individual customization: rename Section 1 title and subtitle
  console.log('6. Customizing Section 1 divider title and subtitle...');
  const sec1TitleInput = page.locator('.sec-divider-title-input[data-sidx="0"]');
  const sec1SubInput = page.locator('.sec-divider-sub-input[data-sidx="0"]');

  await sec1TitleInput.fill('Physiology & Homeostasis');
  await sec1SubInput.fill('High Yield 2026');
  await page.waitForTimeout(400);

  // Check that Section 1 divider page in preview updated
  const paperText = await page.locator('#pagesWrap').innerText();
  if (!paperText.includes('Physiology & Homeostasis')) {
    throw new Error('Individual title "Physiology & Homeostasis" not found in preview!');
  }
  if (!paperText.includes('High Yield 2026')) {
    throw new Error('Individual subtitle "High Yield 2026" not found in preview!');
  }

  // Test toggling OFF Section 2's divider page
  console.log('7. Toggling OFF divider page for Section 2...');
  const sec2ToggleLabel = page.locator('.sec-divider-card[data-sidx="1"] label.modern-toggle-switch');
  await sec2ToggleLabel.click();
  await page.waitForTimeout(400);

  // Capture screenshot of sidebar with individual divider cards
  const artDir = 'C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98';
  const managerScreenshot = path.join(artDir, 'verified-individual-dividers-manager.png');
  await page.screenshot({ path: managerScreenshot });
  console.log('Saved screenshot:', managerScreenshot);

  // 8. Test Custom Page Range & Page Exclusion Card in Step 3
  console.log('8. Testing Custom Page Download & Exclusion Panel...');
  const toggleCustomPagesBtn = page.locator('#btnToggleCustomPages');
  await toggleCustomPagesBtn.scrollIntoViewIfNeeded();
  await toggleCustomPagesBtn.click();
  await page.waitForTimeout(300);

  const customBody = page.locator('#customPagesBody');
  if (!(await customBody.isVisible())) {
    throw new Error('Custom pages panel body did not expand!');
  }

  // Click quick chip "ص 1 إلى 3"
  console.log('9. Clicking quick range chip "ص 1 إلى 3"...');
  await page.locator('.btn-range-chip[data-range="1-3"]').click();
  await page.waitForTimeout(200);

  const rangeVal = await page.locator('#inputCustomPageRange').inputValue();
  console.log(`Input page range is now: "${rangeVal}"`);
  if (rangeVal !== '1-3') {
    throw new Error(`Expected page range to be "1-3", got "${rangeVal}"`);
  }

  // Screenshot of custom pages download panel
  const panelScreenshot = path.join(artDir, 'verified-custom-pages-download-panel.png');
  await page.screenshot({ path: panelScreenshot });
  console.log('Saved screenshot:', panelScreenshot);

  // 10. Test Page-level toolbar: click "🗑️ استبعاد" on page 2
  console.log('10. Testing on-page "🗑️ استبعاد" action on page 2...');
  const page2ExcludeBtn = page.locator('.page[data-page="2"] .btn-page-action[data-toggle-page="2"]');
  await page2ExcludeBtn.scrollIntoViewIfNeeded();
  await page2ExcludeBtn.click();
  await page.waitForTimeout(400);

  // Verify page 2 has is-page-excluded class
  const isExcluded = await page.locator('.page[data-page="2"]').evaluate(el => el.classList.contains('is-page-excluded'));
  console.log(`Page 2 has is-page-excluded class: ${isExcluded}`);
  if (!isExcluded) {
    throw new Error('Page 2 was not marked with is-page-excluded class!');
  }

  // Verify customPagesSummaryBadge updated
  const badgeText = await page.locator('#customPagesSummaryBadge').innerText();
  console.log(`Badge text: "${badgeText}"`);
  if (!badgeText.includes('مستبعد')) {
    throw new Error('Badge text did not update to reflect excluded page!');
  }

  // Screenshot of excluded page with on-page action toolbar
  const exclusionScreenshot = path.join(artDir, 'verified-page-action-toolbar-and-exclusion.png');
  await page.screenshot({ path: exclusionScreenshot });
  console.log('Saved screenshot:', exclusionScreenshot);

  // Restore page 2
  console.log('11. Restoring page 2...');
  const page2RestoreBtn = page.locator('.page[data-page="2"] .btn-page-action.restore');
  await page2RestoreBtn.click();
  await page.waitForTimeout(400);

  const isStillExcluded = await page.locator('.page[data-page="2"]').evaluate(el => el.classList.contains('is-page-excluded'));
  if (isStillExcluded) {
    throw new Error('Page 2 should no longer be excluded after restoring!');
  }

  console.log('ALL INDIVIDUAL DIVIDER AND CUSTOM PAGE RANGE CHECKS PASSED!');
  await browser.close();
})().catch(err => {
  console.error('Playwright verification failed:', err);
  process.exit(1);
});
