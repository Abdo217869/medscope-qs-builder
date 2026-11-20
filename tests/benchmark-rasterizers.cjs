// tests/benchmark-rasterizers.cjs
const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('mq.tourSeen', 'true'));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Load 60-question sample
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
  await page.waitForTimeout(1000);

  // Pre-import test module so no hot-reload happens during eval
  await page.evaluate(async () => {
    window.__testMod = await import('/src/testRasterizer.js');
  });

  const results = await page.evaluate(async () => {
    const { html2canvas, domToCanvas, domToBlob } = window.__testMod;

    const firstPage = document.querySelector('.page');
    if (!firstPage) return { error: 'No page found' };

    // Warm up
    await html2canvas(firstPage, { scale: 1.5, logging: false });
    await domToCanvas(firstPage, { scale: 1.5 });

    // Benchmark html2canvas over 3 runs
    const tH2C = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const canvas = await html2canvas(firstPage, { scale: 1.5, logging: false });
      const t1 = performance.now();
      tH2C.push(t1 - t0);
      canvas.width = 0;
      canvas.height = 0;
    }

    // Benchmark modern-screenshot domToCanvas over 3 runs
    const tModern = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const canvas = await domToCanvas(firstPage, { scale: 1.5 });
      const t1 = performance.now();
      tModern.push(t1 - t0);
      canvas.width = 0;
      canvas.height = 0;
    }

    // Benchmark modern-screenshot domToBlob (direct JPEG blob) over 3 runs
    const tModernBlob = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const blob = await domToBlob(firstPage, { scale: 1.5, type: 'image/jpeg', quality: 0.85 });
      const t1 = performance.now();
      tModernBlob.push(t1 - t0);
    }

    return {
      html2canvasAvgMs: (tH2C.reduce((a, b) => a + b) / tH2C.length).toFixed(1),
      modernScreenshotCanvasAvgMs: (tModern.reduce((a, b) => a + b) / tModern.length).toFixed(1),
      modernScreenshotBlobAvgMs: (tModernBlob.reduce((a, b) => a + b) / tModernBlob.length).toFixed(1),
      runs: { tH2C, tModern, tModernBlob }
    };
  });

  console.log('Rasterizer Benchmark Results:', JSON.stringify(results, null, 2));
  await browser.close();
})();
