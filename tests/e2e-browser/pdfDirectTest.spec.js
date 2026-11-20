import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('Verify 1-click Direct PDF Download for Questions and Answers in Chromium', async ({ page }) => {
  test.setTimeout(60000);

  const PORT = process.env.PORT || '4173';
  await page.goto(`http://localhost:${PORT}/`);

  // Handle help modal if present
  const helpBtn = page.locator('#btnCloseHelp');
  if (await helpBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await helpBtn.click();
  }

  // Go to Step 3
  await page.locator('.step-btn[data-step="3"]').click();
  await expect(page.locator('#step3')).toBeVisible();

  if (!fs.existsSync('test-artifacts')) {
    fs.mkdirSync('test-artifacts', { recursive: true });
  }

  // 1. Test Direct Download for Questions Sheet
  console.log('Testing 1-click Direct Download for Questions...');
  const [ qDownload ] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.click('#btnPrintQBig')
  ]);

  const qFilename = qDownload.suggestedFilename();
  console.log('Downloaded Questions file:', qFilename);
  expect(qFilename).toContain('.pdf');
  const qPath = `test-artifacts/${qFilename}`;
  await qDownload.saveAs(qPath);
  expect(fs.existsSync(qPath)).toBe(true);
  const qStats = fs.statSync(qPath);
  console.log('Questions PDF size:', qStats.size, 'bytes');
  expect(qStats.size).toBeGreaterThan(5000);

  // Wait a short moment
  await page.waitForTimeout(1000);

  // 2. Test Direct Download for Answers Sheet
  console.log('Testing 1-click Direct Download for Answers...');
  const [ aDownload ] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.click('#btnPrintABig')
  ]);

  const aFilename = aDownload.suggestedFilename();
  console.log('Downloaded Answers file:', aFilename);
  expect(aFilename).toContain('.pdf');
  const aPath = `test-artifacts/${aFilename}`;
  await aDownload.saveAs(aPath);
  expect(fs.existsSync(aPath)).toBe(true);
  const aStats = fs.statSync(aPath);
  console.log('Answers PDF size:', aStats.size, 'bytes');
  expect(aStats.size).toBeGreaterThan(5000);
});
