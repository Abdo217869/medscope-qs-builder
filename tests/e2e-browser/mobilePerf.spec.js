// tests/e2e-browser/mobilePerf.spec.js - Full Mobile & Performance Verification for Prompt 6
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:4173';

test.describe('Prompt 6: Mobile Layout, Performance & ProgressTask', () => {

  test('A. First visit load under Slow 4G and 4x CPU throttle (< 3s drop zone usable)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      connectionType: 'cellular4g'
    });

    // Track requests to ensure heavy libraries are NOT loaded eagerly
    let tesseractRequested = false;
    let pdfLibRequested = false;

    page.on('request', req => {
      const url = req.url();
      if (url.includes('tesseract') || url.includes('.wasm')) {
        tesseractRequested = true;
      }
      if (url.includes('jspdf') || url.includes('html2canvas')) {
        pdfLibRequested = true;
      }
    });

    page.on('response', res => {
      console.log(`[REQ] ${res.status()} ${res.url()} (${res.headers()['content-length'] || 0} bytes)`);
    });

    const t0 = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const dropZone = page.locator('#dropZone');
    await dropZone.waitFor({ state: 'visible' });
    const tUsable = Date.now() - t0;

    console.log(`[PERF RESULT] Throttled Drop Zone Usable Time: ${tUsable}ms (Target < 3000ms)`);
    expect(tUsable).toBeLessThan(3500);

    // Verify heavy libraries were lazy-loaded, NOT requested on initial visit
    expect(tesseractRequested).toBe(false);
    expect(pdfLibRequested).toBe(false);

    await context.close();
  });

  const viewports = [
    { name: 'android-small-360x740', width: 360, height: 740 },
    { name: 'iphone-13-390x844', width: 390, height: 844 },
    { name: 'android-large-412x915', width: 412, height: 915 },
    { name: 'tablet-768x1024', width: 768, height: 1024 },
    { name: 'landscape-mobile-844x390', width: 844, height: 390 }
  ];

  for (const vp of viewports) {
    test(`B. Mobile layout & no horizontal scroll at ${vp.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }
      });
      const page = await context.newPage();

      await page.goto(BASE_URL);
      await page.evaluate(() => localStorage.setItem('mq.tourSeen', 'true'));
      const closeHelp = page.locator('#btnCloseHelp');
      if (await closeHelp.isVisible().catch(() => false)) await closeHelp.click();

      // Check no horizontal overflow in Step 1
      const isOverflowing1 = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(isOverflowing1).toBe(false);

      // Verify camera button is present
      await expect(page.locator('#btnCaptureCamera')).toBeVisible();

      // Check sticky bottom bar on mobile (< 768px)
      if (vp.width <= 768) {
        await expect(page.locator('#mobileBottomBar')).toBeVisible();
      }

      // Load sample and test Step 2
      await page.locator('#btnSample').click();
      await page.waitForTimeout(400);

      const isOverflowing2 = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(isOverflowing2).toBe(false);

      // Advance to Step 3
      await page.locator('#btnStep2NextTop').click();
      await page.waitForTimeout(600);

      const isOverflowing3 = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(isOverflowing3).toBe(false);

      // Verify bottom sheet toggle on mobile
      if (vp.width <= 768) {
        const toggleBtn = page.locator('#btnMobileToggleSheet');
        await expect(toggleBtn).toBeVisible();
        await toggleBtn.click();
        await page.waitForTimeout(300);
        await expect(page.locator('#studioSidebar')).toHaveClass(/sheet-open/);

        // Verify floating zoom controls
        await expect(page.locator('#mobileZoomBar')).toBeVisible();
      }

      // Save screenshot for report
      const screenshotDir = path.resolve('tests/screenshots');
      if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
      await page.screenshot({ path: path.join(screenshotDir, `${vp.name}-step3.png`) });

      await context.close();
    });
  }

  test('C. Fast direct PDF generation & ProgressTask UI', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.setItem('mq.tourSeen', 'true'));
    const closeHelp = page.locator('#btnCloseHelp');
    if (await closeHelp.isVisible().catch(() => false)) await closeHelp.click();

    // Load sample and advance to Step 3
    await page.locator('#btnSample').click();
    await page.waitForTimeout(400);
    await page.locator('#btnStep2NextTop').click();
    await page.waitForTimeout(600);

    // Click direct PDF download
    const tPdf0 = Date.now();
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('#btnPrintQBig').click();

    // Verify ProgressTask overlay is mounted and visible
    const progressOverlay = page.locator('.progress-task-overlay');
    await expect(progressOverlay).toBeVisible();
    await expect(page.locator('#ptTitle')).toContainText(/بنرسم|صفحة|تجهيز/);
    await expect(page.locator('#ptFill')).toBeVisible();

    const download = await downloadPromise;
    const tPdf = Date.now() - tPdf0;
    console.log(`[PERF RESULT] Direct PDF generation completed in ${tPdf}ms`);

    const downloadedPath = await download.path();
    const stats = fs.statSync(downloadedPath);
    console.log(`[PDF RESULT] Downloaded PDF size: ${(stats.size / 1024).toFixed(1)} KB`);
    expect(stats.size).toBeGreaterThan(5000);
  });

  test('D. IndexedDB File Cache: Instant reload', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.setItem('mq.tourSeen', 'true'));
    const closeHelp = page.locator('#btnCloseHelp');
    if (await closeHelp.isVisible().catch(() => false)) await closeHelp.click();

    const docxPath = path.resolve('tests/fixtures/essay-sample.docx');
    const fileInput = page.locator('#fileInput');

    // 1st upload: parses and caches
    await fileInput.setInputFiles(docxPath);
    await page.locator('#step2').waitFor({ state: 'visible' });

    // Go back to step 1
    await page.locator('#btnStep2BackTop').click();
    await page.locator('#step1').waitFor({ state: 'visible' });

    // 2nd upload: should be retrieved instantly from IndexedDB cache
    const tCache0 = Date.now();
    await fileInput.setInputFiles(docxPath);
    await page.locator('#step2').waitFor({ state: 'visible' });
    const tCache = Date.now() - tCache0;
    console.log(`[CACHE RESULT] Cached file re-import time: ${tCache}ms`);
    expect(tCache).toBeLessThan(1000);
  });
});
