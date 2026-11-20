// tests/test-btn-click.cjs
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERR:', err));

  await page.addInitScript(() => localStorage.setItem('mq.tourSeen', 'true'));
  await page.goto('http://localhost:5173');

  // Load sample text
  const sampleText = fs.readFileSync('samples/medscope-end30-with-answers.txt', 'utf8');
  await page.evaluate((text) => {
    const raw = document.querySelector('#raw');
    raw.value = text;
    raw.dispatchEvent(new Event('input', { bubbles: true }));
  }, sampleText);

  await page.waitForTimeout(600);
  await page.click('#btnStep1Next');
  await page.waitForTimeout(600);
  await page.click('#btnStep2NextTop');
  await page.waitForTimeout(800);

  console.log('Clicking #btnPrintQBig...');
  const t0 = Date.now();
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.click('#btnPrintQBig');
  const download = await downloadPromise;
  const t1 = Date.now();

  const metrics = await page.evaluate(() => window.__lastExportStageMetrics);
  console.log('Stage metrics:', metrics);
  console.log(`Download received in ${t1 - t0} ms! File: ${download.suggestedFilename()}`);
  await browser.close();
})();
