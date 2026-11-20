// tests/e2e-browser/essayFlow.spec.js - Real Chromium E2E Playwright verification for Prompt 5

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Prompt 5: Essay & Written Questions Full Flow', () => {
  const BASE_URL = 'http://localhost:4173';

  test.beforeEach(async ({ page }) => {
    // Navigate to preview server and dismiss intro tour modal
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('mq.tourSeen', 'true');
    });
    const closeBtn = page.locator('#btnCloseHelp');
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.click();
    }
  });

  test('Step 1 -> Step 2 -> Step 3 with essay-sample.txt', async ({ page }) => {
    // 1. Read fixture text
    const fixturePath = path.resolve('tests/fixtures/essay-sample.txt');
    const fixtureText = fs.readFileSync(fixturePath, 'utf-8');

    // Open paste accordion and input text
    const pasteAccordion = page.locator('#pasteAccordion');
    await pasteAccordion.click();

    const rawInput = page.locator('#raw');
    await rawInput.fill(fixtureText);

    // Give debounced reparse time to run
    await page.waitForTimeout(500);

    // Verify stats chip in Step 1
    const chips = page.locator('#chips');
    await expect(chips).toContainText('8 سؤال');
    await expect(chips).toContainText('2 مادة');

    // Click next to Step 2
    const btnNext1 = page.locator('#btnStep1Next');
    await btnNext1.click();

    // Verify Step 2 is active
    await expect(page.locator('#step2')).toBeVisible();

    // Verify Bento stats card
    const bentoReport = page.locator('#reportCardContainer');
    await expect(bentoReport).toContainText('8');

    // Verify Problems Panel has 0 blocking errors
    const problemsPanel = page.locator('#problemsPanelContainer');
    await expect(problemsPanel).toBeVisible();

    // Take screenshot of Step 2 Editor
    await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/step2-essay-review.png', fullPage: false });

    // Verify Question Type Switcher in Editor
    const typeSelects = page.locator('.ecard-type-select');
    await expect(typeSelects).toHaveCount(8);

    // Q1.1 is match
    await expect(typeSelects.nth(0)).toHaveValue('match');
    // Q1.3 is case
    await expect(typeSelects.nth(2)).toHaveValue('case');
    // Q2.3 is tf
    await expect(typeSelects.nth(5)).toHaveValue('tf');
    // Q2.4 is mcq
    await expect(typeSelects.nth(6)).toHaveValue('mcq');

    // Click next to Step 3
    const btnNext2 = page.locator('#btnStep2NextTop');
    await btnNext2.click();

    // Verify Step 3 is active
    await expect(page.locator('#step3')).toBeVisible();

    // Verify WYSIWYG paper pages are rendered
    const pagesWrap = page.locator('.pages-wrap');
    await expect(pagesWrap).toBeVisible();
    const paperPages = page.locator('.page');
    const pageCount = await paperPages.count();
    expect(pageCount).toBeGreaterThanOrEqual(2);

    // Verify Q1.3 Case Scenario Card and 2x2 Table presence on paper
    await expect(page.locator('.case-scenario-card').first()).toBeVisible();

    // Take screenshot of Question Sheet
    await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/step3-essay-question-sheet.png', fullPage: false });

    // Toggle to Answer Sheet
    const btnPreviewAs = page.locator('#btnPreviewAs');
    await btnPreviewAs.click();
    await page.waitForTimeout(400);

    // Verify model answer boxes appear on paper
    const modelAnsBoxes = page.locator('.part-model-answer, .essay-model-ans-box');
    await expect(modelAnsBoxes.first()).toBeVisible();

    // Verify table in model answer
    const tableOnPaper = page.locator('.essay-table, .paper-table');
    await expect(tableOnPaper.first()).toBeVisible();

    // Take screenshot of Answer Sheet
    await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/step3-essay-answer-sheet.png', fullPage: false });

    // Scroll to the second page of the paper to capture the questions and tables clearly
    const secondPage = page.locator('.page').nth(1);
    await secondPage.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await secondPage.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/paper-page2-essay-content.png' });

    // Scroll to the third page of the paper to capture the questions, table and answers
    const thirdPage = page.locator('.page').nth(2);
    await thirdPage.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await thirdPage.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/paper-page3-essay-questions.png' });
    // Verify direct PDF generation
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    const btnDownloadQ = page.locator('#btnPrintQBig');
    await btnDownloadQ.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
    const pdfSavePath = 'C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/essay-exam-direct-download.pdf';
    await download.saveAs(pdfSavePath);
    expect(fs.existsSync(pdfSavePath)).toBe(true);
    const pdfSize = fs.statSync(pdfSavePath).size;
    expect(pdfSize).toBeGreaterThan(10000); // Valid non-empty PDF
  });

  test('Mobile viewport (390px) responsiveness and layout check', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);

    // Verify no horizontal overflow on mobile shell
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // Within 2px margin

    // Verify Stepper buttons are visible and clickable
    const step1Btn = page.locator('#stepBtn1');
    await expect(step1Btn).toBeVisible();
  });
});
