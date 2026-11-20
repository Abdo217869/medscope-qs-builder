const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    // Fresh context with cache bypassed
    bypassCSP: true
  });
  const page = await context.newPage();

  console.log('Navigating to live GitHub Pages...');
  await page.goto('https://abdo217869.github.io/medscope-qs-builder/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Check title & dropzone
  const title = await page.title();
  console.log('Page title:', title);

  // Dismiss help modal if any
  await page.evaluate(() => {
    localStorage.setItem('mq.tourSeen', 'true');
    const m = document.querySelector('#helpModal');
    if (m) m.style.display = 'none';
  });

  // Click sample button
  const sampleBtn = await page.$('#btnSample');
  if (sampleBtn) {
    await sampleBtn.click();
    await page.waitForTimeout(600);
  }

  // Navigate to Step 3
  const nextTop = await page.$('#btnStep2NextTop');
  if (nextTop) {
    await nextTop.click();
    await page.waitForTimeout(1000);
  }

  // Scroll to studio
  await page.evaluate(() => {
    const el = document.querySelector('#step3Studio');
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'tests/screenshots/live-studio-verified.png' });
  console.log('Captured tests/screenshots/live-studio-verified.png');

  await browser.close();
})();
