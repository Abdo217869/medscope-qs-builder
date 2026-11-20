const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Starting Playwright verification of user fixes...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('mq.tourSeen', 'true');
    localStorage.setItem('mq.tourSeen', '1');
  });

  // 1. Open the preview app
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  console.log('App loaded successfully');

  // Dismiss any open modal if still present
  await page.evaluate(() => {
    const m = document.getElementById('helpModal');
    if (m) { m.hidden = true; m.style.display = 'none'; }
  });

  // 2. Click Sample Exam to load sample
  await page.click('#btnSample');
  await page.waitForTimeout(500);

  // 3. Move to Step 2 -> Step 3
  await page.click('#btnStep2NextTop');
  await page.waitForTimeout(800);

  // Check Step 3 Studio Sidebar styles
  const sidebarBg = await page.$eval('#advSettingsAccordion', el => window.getComputedStyle(el).backgroundColor);
  console.log('Sidebar accordion background:', sidebarBg);

  // Open Watermark tab
  await page.click('button[data-tab="watermark"]');
  await page.waitForTimeout(500);

  // Check Logo Thumbnail Size
  const logoBoxSize = await page.$eval('.logo-thumb-box', el => {
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  console.log('Logo box dimensions:', logoBoxSize);

  const logoImgSize = await page.$eval('#logoThumbImg', el => {
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  console.log('Logo image rendered dimensions:', logoImgSize);

  // Screenshot 1: Logo tab verified with 90x90 box
  const logoArtifactPath = path.resolve('C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/verified-logo-bounds.png');
  await page.screenshot({ path: logoArtifactPath });
  console.log('Saved logo screenshot to:', logoArtifactPath);

  // Switch to Presets tab
  await page.click('button[data-tab="presets"]');
  await page.waitForTimeout(500);
  const presetsArtifactPath = path.resolve('C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/verified-preset-cards.png');
  await page.screenshot({ path: presetsArtifactPath });
  console.log('Saved presets screenshot to:', presetsArtifactPath);

  // Check Section Divider Page and Cover Page:
  // Now let's test the 1-question practical/written scenario:
  // Go back to Step 2
  await page.click('#btnStep3Back');
  await page.waitForTimeout(500);

  // Type a 1-question practical exam in #raw via evaluate
  const sample1Q = `Community Practical Qs
# Part 1
1. Name the primary preventive measure for endemic goiter.
a) Salt iodization
b) Periodic deworming
c) Health education
d) Fluoridation
Answer: A
`;
  await page.evaluate((text) => {
    const r = document.getElementById('raw');
    if (r) {
      r.value = text;
      r.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, sample1Q);
  await page.waitForTimeout(600);

  // Move to Step 3
  await page.click('#btnStep2NextTop');
  await page.waitForTimeout(800);

  // Turn ON cover page & cover total questions in settings
  await page.click('button[data-tab="cover"]');
  await page.waitForTimeout(400);

  // Enable coverTotalQs checkbox
  await page.evaluate(() => {
    const chk = document.querySelector('input[type="checkbox"][data-key="coverTotalQs"]');
    if (chk && !chk.checked) {
      chk.checked = true;
      chk.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const chkSec = document.querySelector('input[type="checkbox"][data-key="secPages"]');
    if (chkSec && !chkSec.checked) {
      chkSec.checked = true;
      chkSec.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.waitForTimeout(600);

  // Check the rendered text in the paper pages!
  const coverTotalQsText = await page.$eval('.cover-total-qs', el => el.textContent.trim()).catch(() => 'NOT_FOUND');
  console.log('Rendered Cover Total Qs Text:', coverTotalQsText);

  // Check the Section Cover page title
  const secCoverTitle = await page.$eval('.section-cover-page h1', el => el.textContent.trim()).catch(() => 'NOT_FOUND');
  console.log('Rendered Section Cover Page Title:', secCoverTitle);

  // Check Section Subtitle
  const secCoverSub = await page.$eval('.section-cover-page .qs', el => el.textContent.trim()).catch(() => 'NOT_FOUND');
  console.log('Rendered Section Cover Page Subtitle:', secCoverSub);

  // Take full screenshot of the paper view
  const finalArtifactPath = path.resolve('C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/verified-cover-and-divider.png');
  await page.screenshot({ path: finalArtifactPath });
  console.log('Saved final paper screenshot to:', finalArtifactPath);

  await browser.close();
  console.log('Verification script completed!');
})();
