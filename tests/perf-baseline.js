// tests/perf-baseline.js - Measures baseline before optimizations
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function measure() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 13
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  // 1. Throttle CPU: 4x slowdown (simulating mid-range phone)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // 2. Throttle Network: Slow 4G (1.6 Mbps download, 750 Kbps upload, 150 ms RTT)
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    connectionType: 'cellular4g'
  });

  // Track network requests and transfer bytes
  let totalBytes = 0;
  let requestCount = 0;
  const requestsByType = { js: 0, css: 0, font: 0, wasm: 0, other: 0 };
  const bytesByType = { js: 0, css: 0, font: 0, wasm: 0, other: 0 };

  page.on('response', async res => {
    try {
      const headers = res.headers();
      const len = parseInt(headers['content-length'] || '0', 10);
      const url = res.url();
      requestCount++;
      totalBytes += len;

      if (url.endsWith('.js') || url.includes('/assets/')) {
        requestsByType.js++;
        bytesByType.js += len;
      } else if (url.endsWith('.css')) {
        requestsByType.css++;
        bytesByType.css += len;
      } else if (url.endsWith('.woff2') || url.endsWith('.woff')) {
        requestsByType.font++;
        bytesByType.font += len;
      } else if (url.endsWith('.wasm')) {
        requestsByType.wasm++;
        bytesByType.wasm += len;
      } else {
        requestsByType.other++;
        bytesByType.other += len;
      }
    } catch (e) {}
  });

  console.log('--- MEASURING FIRST LOAD (Slow 4G + 4x CPU slowdown) ---');
  const t0 = Date.now();
  await page.goto('http://localhost:4173/');

  // Wait until drop zone is visible and usable
  const dropZone = page.locator('#dropZone');
  await dropZone.waitFor({ state: 'visible' });
  const tDropZone = Date.now() - t0;

  // Dismiss help modal if open
  const closeHelp = page.locator('#btnCloseHelp');
  if (await closeHelp.isVisible().catch(() => false)) {
    await closeHelp.click();
  }

  // Get Performance Metrics from browser
  const perfMetrics = await page.evaluate(() => {
    const timing = performance.getEntriesByType('navigation')[0] || {};
    const paint = performance.getEntriesByType('paint');
    const fcpEntry = paint.find(p => p.name === 'first-contentful-paint');
    return {
      fcp: fcpEntry ? fcpEntry.startTime : 0,
      domInteractive: timing.domInteractive || 0,
      loadEventEnd: timing.loadEventEnd || 0,
      heap: performance.memory ? performance.memory.usedJSHeapSize : 0
    };
  });

  console.log('Drop Zone Usable Time:', tDropZone, 'ms');
  console.log('FCP:', Math.round(perfMetrics.fcp), 'ms');
  console.log('Total Requests on load:', requestCount);
  console.log('Total Bytes transferred on load:', (totalBytes / 1024).toFixed(1), 'KB');
  console.log('Bytes by type (KB):', {
    js: (bytesByType.js / 1024).toFixed(1),
    css: (bytesByType.css / 1024).toFixed(1),
    font: (bytesByType.font / 1024).toFixed(1),
    wasm: (bytesByType.wasm / 1024).toFixed(1)
  });

  // 3. Remove network & CPU throttling for file reading & PDF generation measurement
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  console.log('\n--- MEASURING FILE PROCESSING ---');
  // Read docx fixture
  const docxPath = path.resolve('tests/fixtures/essay-sample.docx');
  const tDocxStart = Date.now();
  const fileInput = page.locator('#fileInput');
  await fileInput.setInputFiles(docxPath);
  await page.locator('#step2').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(600);
  const tDocx = Date.now() - tDocxStart;
  console.log('Docx read & parse time:', tDocx, 'ms');

  // Go to step 3
  await page.locator('#btnStep2NextTop').click();
  await page.locator('#step3').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);

  // Measure 8-question PDF generation
  console.log('\n--- MEASURING PDF GENERATION (8 Qs) ---');
  const tPdfStart = Date.now();
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.locator('#btnPrintQBig').click();
  const download = await downloadPromise;
  const tPdf8 = Date.now() - tPdfStart;
  console.log('8 Qs PDF Generation Time:', tPdf8, 'ms');

  const baselineData = {
    dropZoneUsableMs: tDropZone,
    fcpMs: Math.round(perfMetrics.fcp),
    totalRequests: requestCount,
    totalBytesKB: Math.round(totalBytes / 1024),
    bytesByType,
    tDocxMs: tDocx,
    tPdf8Ms: tPdf8,
    peakHeapMB: (perfMetrics.heap / 1024 / 1024).toFixed(2)
  };

  fs.writeFileSync('tests/baseline-results.json', JSON.stringify(baselineData, null, 2));
  console.log('\nBaseline saved to tests/baseline-results.json');

  await browser.close();
}

measure().catch(err => {
  console.error('Measurement error:', err);
  process.exit(1);
});
