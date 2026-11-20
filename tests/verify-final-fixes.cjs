const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

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

  // 1. Verify single quality bar
  console.log('2. Verifying single download quality bar in DOM...');
  const bars = await page.locator('.download-quality-bar').count();
  console.log(`Found ${bars} .download-quality-bar elements.`);
  if (bars !== 1) {
    throw new Error(`Expected exactly 1 download quality bar, found ${bars}!`);
  }

  // Load sample questions
  console.log('3. Loading sample questions...');
  await page.locator('#btnSample').click();
  await page.waitForTimeout(600);

  // Navigate to Step 3
  console.log('4. Navigating to Step 3...');
  await page.locator('.step-btn[data-step="3"]').click();
  await page.waitForTimeout(500);

  // Open the studio accordion
  await page.evaluate(() => {
    const el = document.getElementById('advSettingsAccordion');
    if (el) el.open = true;
  });
  await page.waitForTimeout(300);

  // Verify "📑 الصفحات الفاصلة" tab exists and click it
  console.log('5. Clicking on "📑 الصفحات الفاصلة" tab...');
  const dividerTab = page.locator('.settings-tab-btn[data-tab="dividers"]');
  await dividerTab.waitFor({ state: 'visible' });
  await dividerTab.click();
  await page.waitForTimeout(300);

  // Check section divider controls
  const secPagesToggle = page.locator('label.modern-toggle-switch:has(input[data-key="secPages"])');
  const secTitleInput = page.locator('input[data-key="secPageTitleOverride"]');
  const secSubInput = page.locator('input[data-key="secPageSub"]');
  const secCountToggle = page.locator('label.modern-toggle-switch:has(input[data-key="secTitleCount"])');

  if (!(await secPagesToggle.isVisible())) {
    throw new Error('secPages toggle is not visible under dividers tab!');
  }
  if (!(await secTitleInput.isVisible())) {
    throw new Error('secPageTitleOverride input is not visible under dividers tab!');
  }
  if (!(await secSubInput.isVisible())) {
    throw new Error('secPageSub input is not visible under dividers tab!');
  }

  // Verify no Arabic text in paper
  console.log('6. Checking that no Arabic default text appears on divider or cover pages...');
  const paperText = await page.locator('#pagesWrap').innerText();
  if (paperText.includes('القسم الأول')) {
    throw new Error('Paper still contains "القسم الأول"!');
  }
  if (paperText.includes('سؤال واحد') || paperText.includes('أسئلة')) {
    throw new Error('Paper still contains Arabic question counters!');
  }

  // Test live control: Override section title to "Cardiovascular System"
  console.log('7. Testing live override of Section Title to "Cardiovascular System"...');
  await secTitleInput.fill('Cardiovascular System');
  await page.waitForTimeout(300);
  let updatedPaper = await page.locator('#pagesWrap').innerText();
  if (!updatedPaper.includes('Cardiovascular System')) {
    throw new Error('Overridden section title "Cardiovascular System" was not found in paper!');
  }

  // Test live control: Change subtitle to "Final Review"
  console.log('8. Testing live change of Subtitle to "Final Review"...');
  await secSubInput.fill('Final Review');
  await page.waitForTimeout(300);
  updatedPaper = await page.locator('#pagesWrap').innerText();
  if (!updatedPaper.includes('Final Review')) {
    throw new Error('Overridden subtitle "Final Review" was not found in paper!');
  }

  // Test live control: Hide subtitle by typing "none"
  console.log('9. Testing live hiding of Subtitle with "none"...');
  await secSubInput.fill('none');
  await page.waitForTimeout(300);
  const qsElements = await page.locator('#pagesWrap .section-cover-page .qs').count();
  console.log(`Number of .qs elements on section covers: ${qsElements}`);
  if (qsElements !== 0) {
    throw new Error('Expected .qs element to be omitted when secPageSub is "none"!');
  }

  // Artifact 1: Screenshot of Section Divider Controls and Live Preview
  const artDir = 'C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98';
  const dividerScreenshot = path.join(artDir, 'verified-dividers-tab-controls.png');
  await page.screenshot({ path: dividerScreenshot, fullPage: false });
  console.log('Saved screenshot:', dividerScreenshot);

  // Test disabling section divider pages completely
  console.log('10. Testing disabling Section Divider pages...');
  await secPagesToggle.click();
  await page.waitForTimeout(300);
  const coversCount = await page.locator('#pagesWrap .section-cover-page').count();
  console.log(`Number of section-cover-page elements after unchecking: ${coversCount}`);
  if (coversCount !== 0) {
    throw new Error('Expected 0 section covers when secPages is unchecked!');
  }

  // Turn it back on
  await secPagesToggle.click();
  await page.waitForTimeout(300);

  // Scroll to download bar and take screenshot
  console.log('11. Capturing single download bar in Step 3...');
  await page.locator('#downloadQualityBar').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const downloadBarScreenshot = path.join(artDir, 'verified-single-download-bar.png');
  await page.screenshot({ path: downloadBarScreenshot, fullPage: false });
  console.log('Saved screenshot:', downloadBarScreenshot);

  console.log('ALL PLAYWRIGHT CHECKS PASSED PERFECTLY!');
  await browser.close();
})().catch(err => {
  console.error('Playwright verification failed:', err);
  process.exit(1);
});
