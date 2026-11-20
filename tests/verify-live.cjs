const { chromium } = require('playwright');

(async () => {
  // Use fresh context with disabled cache
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block' // block any stale service worker caches
  });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('mq.tourSeen', 'true'));

  // Go to live site with cache bypass
  await page.goto('https://abdo217869.github.io/medscope-qs-builder/?t=' + Date.now(), { waitUntil: 'networkidle' });

  // Load sample -> Step 2 -> Step 3
  await page.click('#btnSample');
  await page.waitForTimeout(600);
  await page.click('#btnStep2NextTop');
  await page.waitForTimeout(800);

  // Switch to watermark tab
  await page.click('button[data-tab="watermark"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'tests/screenshots/live-verified-clean.png' });
  console.log('Clean verified screenshot taken!');
  await browser.close();
})();
