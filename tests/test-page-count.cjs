const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('mq.tourSeen', 'true'));
  await page.goto('http://localhost:5173');

  const text227 = fs.readFileSync('samples/epidemiology_extracted.txt', 'utf8');
  await page.evaluate((text) => {
    const raw = document.querySelector('#raw');
    raw.value = text;
    raw.dispatchEvent(new Event('input', { bubbles: true }));
  }, text227);

  await page.waitForTimeout(800);
  await page.click('#btnStep1Next');
  await page.waitForTimeout(800);
  await page.click('#btnStep2NextTop');
  await page.waitForTimeout(1000);

  const count227 = await page.evaluate(() => {
    return {
      pages: document.querySelectorAll('.page').length
    };
  });
  console.log('227 Qs test:', count227);

  await browser.close();
})();
