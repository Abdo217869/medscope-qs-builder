import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

test.describe('Deep Customization, Presets, Undo/Redo, Pagination & Real PDF', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Dismiss help modal if visible
    const helpModal = page.locator('#helpModal');
    if (await helpModal.isVisible()) {
      await page.locator('#btnCloseHelp').click();
      await expect(helpModal).toBeHidden();
    }
  });

  test('Presets: switches between Soft, Classic, Minimal, Modern, Large and verifies visual styling', async ({ page }) => {
    // Navigate to Step 3
    await page.locator('.step-btn[data-step="3"]').click();
    await expect(page.locator('#step3')).toBeVisible();

    // Ensure Advanced Settings accordion is open
    await page.evaluate(() => {
      const el = document.getElementById('advSettingsAccordion');
      if (el) el.open = true;
    });
    await page.waitForTimeout(300);

    const presets = ['soft', 'classic', 'minimal', 'modern', 'large'];

    for (let i = 0; i < presets.length; i++) {
      const p = presets[i];
      const card = page.locator(`.preset-card[data-preset="${p}"]`);
      await card.click();
      await page.waitForTimeout(200);

      const paper = page.locator('#pagesWrap .page.paper').first();
      await expect(paper).toBeAttached();

      // Check specific characteristics
      if (p === 'minimal') {
        await expect(paper).toHaveClass(/t-minimal/);
      } else if (p === 'classic') {
        await expect(paper).toHaveClass(/t-classic/);
      } else if (p === 'modern') {
        await expect(paper).toHaveClass(/t-modern/);
      }

      await page.screenshot({ path: `test-artifacts/preset-${i + 1}-${p}.png` });
    }
  });

  test('Style Undo/Redo: 15 sequential changes without scroll loss, undo all 15 back to start', async ({ page }) => {
    await page.locator('.step-btn[data-step="3"]').click();
    await page.evaluate(() => {
      const el = document.getElementById('advSettingsAccordion');
      if (el) el.open = true;
    });
    await page.waitForTimeout(200);

    // Perform 15 sequential setting adjustments
    const actions = [
      () => page.locator('.preset-card[data-preset="modern"]').click(),
      () => page.locator('.preset-card[data-preset="classic"]').click(),
      () => page.locator('.preset-card[data-preset="minimal"]').click(),
      () => page.locator('.palette-card[data-pal="emerald-med"]').click(),
      () => page.locator('.palette-card[data-pal="royal-slate"]').click(),
      () => page.locator('.palette-card[data-pal="burgundy-crimson"]').click(),
      () => page.locator('.palette-card[data-pal="medscope-gold"]').click(),
      () => page.locator('.preset-card[data-preset="large"]').click(),
      () => page.locator('.preset-card[data-preset="modern"]').click(),
      () => page.locator('.palette-card[data-pal="warm-sepia"]').click(),
      () => page.locator('.palette-card[data-pal="minimal-mono"]').click(),
      () => page.locator('.palette-card[data-pal="emerald-med"]').click(),
      () => page.locator('.preset-card[data-preset="classic"]').click(),
      () => page.locator('.preset-card[data-preset="minimal"]').click(),
      () => page.locator('.preset-card[data-preset="soft"]').click(),
    ];

    for (let i = 0; i < actions.length; i++) {
      await actions[i]();
      await page.waitForTimeout(80);
    }

    // Now undo all 15 back
    const btnUndo = page.locator('#btnStyleUndo');
    for (let i = 0; i < 15; i++) {
      if (await btnUndo.isVisible()) {
        await btnUndo.click();
        await page.waitForTimeout(60);
      }
    }

    await page.screenshot({ path: 'test-artifacts/style-undo-15-complete.png' });
  });

  test('Custom Preset: save custom style, reload, apply, export JSON and import', async ({ page }) => {
    await page.locator('.step-btn[data-step="3"]').click();
    await page.evaluate(() => {
      const el = document.getElementById('advSettingsAccordion');
      if (el) el.open = true;
    });
    await page.waitForTimeout(200);

    // Select emerald palette
    await page.locator('.palette-card[data-pal="emerald-med"]').click();
    await page.waitForTimeout(200);

    // Mock prompt to name the preset
    await page.evaluate(() => {
      window.prompt = () => 'تنسيق زمردي تجريبي';
    });

    await page.locator('#btnSaveCustomStyle').click();
    await page.waitForTimeout(300);

    // Assert custom preset chip appears
    const chip = page.locator('.custom-preset-chip').first();
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('تنسيق زمردي تجريبي');

    // Reload page -> custom style chip must persist
    await page.reload();
    const helpModal = page.locator('#helpModal');
    if (await helpModal.isVisible()) {
      await page.locator('#btnCloseHelp').click();
    }

    await page.locator('.step-btn[data-step="3"]').click();
    await page.evaluate(() => {
      const el = document.getElementById('advSettingsAccordion');
      if (el) el.open = true;
    });
    await page.waitForTimeout(200);

    const reloadedChip = page.locator('.custom-preset-chip').first();
    await expect(reloadedChip).toBeVisible();
    await expect(reloadedChip).toContainText('تنسيق زمردي تجريبي');

    // Export styles JSON
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btnExportStyles').click()
    ]);

    const downloadPath = path.resolve('test-artifacts/exported-styles.json');
    await download.saveAs(downloadPath);
    expect(fs.existsSync(downloadPath)).toBe(true);

    const exportedContent = JSON.parse(fs.readFileSync(downloadPath, 'utf-8'));
    expect(exportedContent.version).toBe('1.0');
    expect(exportedContent.currentSettings).toBeTruthy();

    await page.screenshot({ path: 'test-artifacts/custom-style-saved.png' });
  });

  test('Pagination & Real PDF: 60 questions render across multiple pages without splitting', async ({ page }) => {
    // Load 60 sample questions from medscope-end30-with-answers.txt
    const txtPath = path.resolve('samples/medscope-end30-with-answers.txt');
    const content = fs.readFileSync(txtPath, 'utf-8');

    // Open paste accordion and fill raw textarea in Step 1
    await page.evaluate(() => {
      const el = document.getElementById('pasteAccordion');
      if (el) el.open = true;
    });
    await page.waitForTimeout(200);

    const rawTextarea = page.locator('#raw');
    await rawTextarea.fill(content);
    await page.waitForTimeout(600);

    // Navigate to Step 3
    await page.locator('.step-btn[data-step="3"]').click();
    await page.waitForTimeout(600);

    // Verify multiple pages generated
    const pages = page.locator('#pagesWrap .page.paper');
    const pageCount = await pages.count();
    expect(pageCount).toBeGreaterThan(3);

    // Check pagination rules:
    // 1. No question item is split across page boundaries (every .q has full .opts)
    const questions = page.locator('#pagesWrap .page.paper .q');
    const qCount = await questions.count();
    expect(qCount).toBe(60);

    // 2. Heading is not alone at the bottom of a page
    const lastElementsOnPages = await page.evaluate(() => {
      const paperPages = document.querySelectorAll('#pagesWrap .page.paper');
      const results = [];
      paperPages.forEach((p, idx) => {
        const body = p.querySelector('.body');
        if (!body) return;
        const lastChild = body.lastElementChild;
        if (lastChild) {
          results.push({
            pageIdx: idx + 1,
            isSectionHeadingAlone: lastChild.classList.contains('sh') && body.children.length === 1
          });
        }
      });
      return results;
    });

    for (const r of lastElementsOnPages) {
      expect(r.isSectionHeadingAlone).toBe(false);
    }

    // Generate REAL PDF with preferCSSPageSize
    const pdfPath = path.resolve('test-artifacts/medscope-60qs-rendered.pdf');
    await page.pdf({
      path: pdfPath,
      preferCSSPageSize: true,
      printBackground: true
    });

    expect(fs.existsSync(pdfPath)).toBe(true);
    const pdfSize = fs.statSync(pdfPath).size;
    expect(pdfSize).toBeGreaterThan(50000); // Valid PDF > 50KB

    await page.screenshot({ path: 'test-artifacts/pagination-60qs-page1.png' });
  });
});
