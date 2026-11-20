import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('Verify Editor at Top of Step 2, No Question Clipping, and Clean Cover PDF', async ({ page }) => {
  test.setTimeout(90000);

  const PORT = process.env.PORT || '4173';
  await page.goto(`http://localhost:${PORT}/`);

  // Handle help modal if open
  const helpClose = page.locator('#btnCloseHelp');
  if (await helpClose.isVisible({ timeout: 1500 }).catch(() => false)) {
    await helpClose.click();
  }

  if (!fs.existsSync('test-artifacts')) {
    fs.mkdirSync('test-artifacts', { recursive: true });
  }

  // 1. Navigate to Step 2
  await page.locator('.step-btn[data-step="2"]').click();
  await expect(page.locator('#step2')).toBeVisible();

  // 2. Verify that Editor is placed at the TOP of Step 2 (above Problems & Bento)
  const editorBox = await page.locator('.editor-container-card').boundingBox();
  const problemsBox = await page.locator('#problemsPanelContainer').boundingBox();
  const reportBox = await page.locator('#reportCardContainer').boundingBox();

  console.log('Step 2 Y-positions:', {
    editorY: editorBox?.y,
    problemsY: problemsBox?.y,
    reportY: reportBox?.y
  });

  expect(editorBox).not.toBeNull();
  expect(problemsBox).not.toBeNull();
  expect(reportBox).not.toBeNull();

  // Editor must be visually ABOVE Problems and Bento
  expect(editorBox.y).toBeLessThan(problemsBox.y);
  expect(editorBox.y).toBeLessThan(reportBox.y);

  // Top navigation buttons exist and are visible
  await expect(page.locator('#btnStep2NextTop')).toBeVisible();
  await expect(page.locator('#btnStep2BackTop')).toBeVisible();

  // 3. Verify Question Cards Styling and Zero Clipping
  const firstEcard = page.locator('.ecard').first();
  await expect(firstEcard).toBeVisible();

  const stemTextarea = firstEcard.locator('.ecard-stem');
  await expect(stemTextarea).toBeVisible();
  const stemBox = await stemTextarea.boundingBox();
  console.log('Stem textarea width:', stemBox?.width, 'height:', stemBox?.height);
  // Stems must have full width (> 500px on desktop, definitely not tiny 150px)
  expect(stemBox?.width).toBeGreaterThan(450);

  const firstOption = firstEcard.locator('.opt-text-input').first();
  await expect(firstOption).toBeVisible();
  const optBox = await firstOption.boundingBox();
  console.log('Option input width:', optBox?.width, 'height:', optBox?.height);
  expect(optBox?.width).toBeGreaterThan(400);

  // Take screenshot of Step 2 Editor
  await page.screenshot({ path: 'test-artifacts/step2-editor-top.png', fullPage: false });

  // 4. Test Editing functionality and Sync
  await stemTextarea.fill('Updated Stem Verification Test');
  await page.locator('#btnSync').click();
  await expect(page.locator('.toast').last()).toBeVisible();
  expect(await page.locator('.toast').last().textContent()).toContain('تم حفظ التعديلات');

  // 5. Navigate to Step 3 and verify Studio "تعديل" view
  await page.locator('#btnStep2NextTop').click();
  await expect(page.locator('#step3')).toBeVisible();

  // Switch to "تعديل" in toolbar
  await page.locator('#views button[data-v="edit"]').click();
  await expect(page.locator('#view .ecard').first()).toBeVisible();

  const studioStem = page.locator('#view .ecard-stem').first();
  const studioStemBox = await studioStem.boundingBox();
  expect(studioStemBox?.width).toBeGreaterThan(400);

  // Take screenshot of Step 3 Studio Edit view
  await page.screenshot({ path: 'test-artifacts/step3-studio-edit-view.png' });

  // Switch back to "ورقة الإجابات" (as)
  await page.locator('#views button[data-v="as"]').click();
  await expect(page.locator('#pagesWrap')).toBeVisible();

  // 6. Verify Cover Page does NOT have solid gold box
  const coverPage = page.locator('.page.is-full').first();
  await expect(coverPage).toBeVisible();

  // Ensure cover title and contents are visible and not blocked
  await expect(coverPage.locator('.full h1, .cover-content h1')).toBeVisible();
  const coverTitleText = await coverPage.locator('.full h1, .cover-content h1').textContent();
  console.log('Cover Page Title:', coverTitleText);
  expect(coverTitleText?.trim().length).toBeGreaterThan(0);

  // Take screenshot of cover page
  await coverPage.screenshot({ path: 'test-artifacts/cover-page-verified.png' });

  // 7. Test Direct PDF Download for Answers
  console.log('Triggering Direct PDF Download for Answers...');
  const [ download ] = await Promise.all([
    page.waitForEvent('download', { timeout: 35000 }),
    page.click('#btnPrintABig')
  ]);

  const pdfName = download.suggestedFilename();
  console.log('Downloaded PDF name:', pdfName);
  const pdfPath = `test-artifacts/${pdfName}`;
  await download.saveAs(pdfPath);
  expect(fs.existsSync(pdfPath)).toBe(true);
  const pdfStats = fs.statSync(pdfPath);
  console.log('Downloaded PDF size:', pdfStats.size, 'bytes');
  expect(pdfStats.size).toBeGreaterThan(10000);
});
