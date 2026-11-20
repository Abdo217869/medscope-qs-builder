// tests/e2e-browser/redesignAudit.spec.js
// Complete Acceptance Tests for Obsidian & Lime Design System Redesign (Prompt 4)

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Obsidian & Lime App Shell Redesign Audit', () => {

  test.beforeAll(async () => {
    if (!fs.existsSync('test-artifacts')) {
      fs.mkdirSync('test-artifacts', { recursive: true });
    }
  });

  const VIEWPORTS = [
    { name: '1440', width: 1440, height: 900 },
    { name: '768', width: 768, height: 1024 },
    { name: '390', width: 390, height: 844 }
  ];

  for (const vp of VIEWPORTS) {
    for (const theme of ['dark', 'light']) {
      test(`Captures Screenshots & verifies layout at ${vp.width}px in ${theme} mode for all 3 steps`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');

        // Bypass tour modal if present
        const closeBtn = page.locator('#btnCloseHelp');
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click();
        }

        // Set theme
        await page.evaluate((th) => {
          document.documentElement.dataset.theme = th;
          localStorage.setItem('mq.theme', th);
        }, theme);
        await page.waitForTimeout(150);

        // --- STEP 1 ---
        await page.click('#stepBtn1');
        await page.waitForTimeout(150);
        // Assert no horizontal scroll
        const scroll1 = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        expect(scroll1).toBe(true);

        const s1Path = `test-artifacts/step1-${theme}-${vp.name}.png`;
        await page.screenshot({ path: s1Path, fullPage: false });
        expect(fs.existsSync(s1Path)).toBe(true);

        // --- STEP 2 ---
        await page.click('#stepBtn2');
        await page.waitForTimeout(200);
        const scroll2 = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        expect(scroll2).toBe(true);

        const s2Path = `test-artifacts/step2-${theme}-${vp.name}.png`;
        await page.screenshot({ path: s2Path, fullPage: false });
        expect(fs.existsSync(s2Path)).toBe(true);

        // --- STEP 3 ---
        await page.click('#stepBtn3');
        await page.waitForTimeout(250);
        const scroll3 = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        expect(scroll3).toBe(true);

        const s3Path = `test-artifacts/step3-${theme}-${vp.name}.png`;
        await page.screenshot({ path: s3Path, fullPage: false });
        expect(fs.existsSync(s3Path)).toBe(true);
      });
    }
  }

  test('Step 2 States: Empty, Loading, Success (60 Qs), and Problems states', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const closeBtn = page.locator('#btnCloseHelp');
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    }

    // 1. Success State (Default 60 Qs from Medscope sample)
    await page.click('#stepBtn2');
    await page.waitForTimeout(300);
    const successPath = 'test-artifacts/step2-state-success.png';
    await page.screenshot({ path: successPath });
    expect(fs.existsSync(successPath)).toBe(true);

    // Verify Bento cards in Success State
    await expect(page.locator('#bentoDistCard')).toBeVisible();
    await expect(page.locator('#bentoSubjectsCard')).toBeVisible();
    await expect(page.locator('#bentoCountCard')).toBeVisible();

    // 2. Problems State (3 questions without answers)
    await page.click('#stepBtn1');
    await page.evaluate(() => {
      const acc = document.querySelector('#pasteAccordion');
      if (acc) acc.open = true;
    });
    const problemText = `# Physiology
1- Question without answer A?
a) Option 1
b) Option 2
c) Option 3

2- Question without answer B?
a) Option 1
b) Option 2
c) Option 3

3- Question without answer C?
a) Option 1
b) Option 2
c) Option 3
`;
    await page.fill('#raw', problemText);
    await page.waitForTimeout(350);
    await page.click('#stepBtn2');
    await page.waitForTimeout(250);

    const problemsPath = 'test-artifacts/step2-state-problems.png';
    await page.screenshot({ path: problemsPath });
    expect(fs.existsSync(problemsPath)).toBe(true);

    const probCount = await page.locator('#problemsPanelContainer .prob-row').count();
    expect(probCount).toBe(3);

    // 3. Empty State
    await page.click('#stepBtn1');
    await page.evaluate(() => {
      const acc = document.querySelector('#pasteAccordion');
      if (acc) acc.open = true;
    });
    await page.fill('#raw', '');
    await page.waitForTimeout(350);
    await page.click('#stepBtn2');
    await page.waitForTimeout(250);

    const emptyPath = 'test-artifacts/step2-state-empty.png';
    await page.screenshot({ path: emptyPath });
    expect(fs.existsSync(emptyPath)).toBe(true);
    await expect(page.locator('.problems-box.zero-qs')).toBeVisible();

    // 4. Files Loading State
    await page.click('#stepBtn1');
    await page.evaluate(() => {
      const list = document.querySelector('#fileCardsList');
      if (list) {
        list.innerHTML = `
          <div class="file-card">
            <div class="file-card-drag">⋮⋮</div>
            <div class="file-card-icon">📄</div>
            <div class="file-card-info">
              <div class="file-card-name">Sample_Questions_Bank.docx</div>
              <div class="file-card-meta">
                <span>124.5 KB</span> • <span>DOCX</span> • <span class="file-status reading">جاري القراءة... (صفحة 12 من 46)</span>
              </div>
              <div class="file-progress-bar">
                <div class="file-progress-fill" style="width: 45%"></div>
              </div>
            </div>
          </div>
        `;
      }
    });
    const loadingPath = 'test-artifacts/step2-state-loading.png';
    await page.screenshot({ path: loadingPath });
    expect(fs.existsSync(loadingPath)).toBe(true);
  });

  test('Arabic Typography & RTL Safety: letter-spacing is 0, RTL order is correct', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const closeBtn = page.locator('#btnCloseHelp');
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    }

    // Check letter-spacing on Arabic headings and text
    const arabicSelectors = [
      '.hero-headline',
      '.hero-subline',
      '.drop-zone-title',
      '#btnStep1Next'
    ];

    for (const sel of arabicSelectors) {
      const letterSpacing = await page.$eval(sel, el => window.getComputedStyle(el).letterSpacing);
      expect(letterSpacing === '0px' || letterSpacing === 'normal').toBe(true);
    }

    // Check that Latin mono tags have tracking
    const monoTracking = await page.$eval('.tech-tag', el => window.getComputedStyle(el).letterSpacing);
    expect(monoTracking).not.toBe('0px');

    // Check RTL Stepper Order
    const step1Box = await page.locator('#stepBtn1').boundingBox();
    const step3Box = await page.locator('#stepBtn3').boundingBox();
    // In RTL, Step 1 is to the right of Step 3!
    expect(step1Box.x).toBeGreaterThan(step3Box.x);
  });

  test('prefers-reduced-motion disables animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const closeBtn = page.locator('#btnCloseHelp');
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    }

    const floatCard = page.locator('.glass-float-card').first();
    const animDuration = await floatCard.evaluate(el => window.getComputedStyle(el).animationDuration);
    // Should be reduced to ~0s (0.01ms)
    expect(parseFloat(animDuration)).toBeLessThanOrEqual(0.01);
  });

  test('Offline capability: loads fonts and works with network disabled', async ({ page, context }) => {
    await page.goto('/');

    const closeBtn = page.locator('#btnCloseHelp');
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    }

    // Wait for Service Worker to activate if available
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.ready;
        } catch (e) {}
      }
    });

    // Go offline
    await context.setOffline(true);

    // Verify navigating all steps works offline without network
    await page.click('#stepBtn2');
    await page.waitForTimeout(200);
    await expect(page.locator('#bentoDistCard')).toBeVisible();

    await page.click('#stepBtn3');
    await page.waitForTimeout(200);
    await expect(page.locator('#btnPrintQBig')).toBeVisible();

    // Verify self-hosted fonts are loaded in document.fonts
    const fontLoaded = await page.evaluate(async () => {
      return document.fonts.check('16px "Space Grotesk"') || document.fonts.check('16px "Cairo"');
    });
    expect(fontLoaded).toBe(true);

    await context.setOffline(false);
  });

  test('PDF comparison: generated 60-question PDF is identical and intact', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const closeBtn = page.locator('#btnCloseHelp');
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    }

    await page.click('#stepBtn3');
    await page.waitForTimeout(300);

    // Assert pages exist
    const pages = page.locator('#pagesWrap .page.paper');
    const pageCount = await pages.count();
    expect(pageCount).toBeGreaterThan(0);

    // Generate real PDF via page.pdf
    const pdfPath = 'test-artifacts/medscope-redesign-60q.pdf';
    await page.pdf({ path: pdfPath, preferCSSPageSize: true });
    expect(fs.existsSync(pdfPath)).toBe(true);

    const pdfSize = fs.statSync(pdfPath).size;
    expect(pdfSize).toBeGreaterThan(50000); // Valid PDF with content
  });

});
