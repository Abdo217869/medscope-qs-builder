const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Testing live GitHub Pages deployment...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block' // bypass any old cached service worker
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('mq.tourSeen', 'true');
    localStorage.setItem('mq.tourSeen', '1');
  });

  const liveUrl = 'https://abdo217869.github.io/medscope-qs-builder/?v=' + Date.now();
  await page.goto(liveUrl, { waitUntil: 'networkidle' });
  console.log('Live page loaded:', await page.title());

  // Dismiss any tour modal
  await page.evaluate(() => {
    const m = document.getElementById('helpModal');
    if (m) { m.hidden = true; m.style.display = 'none'; }
  });

  // Load sample -> Step 2 -> Step 3
  await page.click('#btnSample');
  await page.waitForTimeout(600);
  await page.click('#btnStep2NextTop');
  await page.waitForTimeout(1000);

  // Switch to Watermark tab
  await page.click('button[data-tab="watermark"]');
  await page.waitForTimeout(500);

  // Verify Logo Thumbnail dimensions on live site
  const logoBox = await page.$eval('.logo-thumb-box', el => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
  console.log('Live Logo Box Dimensions:', logoBox);

  const logoImg = await page.$eval('#logoThumbImg', el => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
  console.log('Live Logo Image Dimensions:', logoImg);

  // Switch to Presets tab
  await page.click('button[data-tab="presets"]');
  await page.waitForTimeout(500);

  const activePreset = await page.$eval('.preset-card.active .preset-name', el => el.textContent.trim()).catch(() => 'NONE');
  console.log('Live Active Preset:', activePreset);

  const screenshotPath = path.resolve('C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/live-final-verified.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved live final screenshot to:', screenshotPath);

  await browser.close();
  console.log('Live verification complete!');
})();
