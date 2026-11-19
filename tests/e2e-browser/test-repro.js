import { chromium } from '@playwright/test';

async function testModal() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:5173/');

  // Open the help modal
  await page.click('#btnHelp');
  console.log('Clicked #btnHelp');

  // Check if modal is visible
  const isVisibleBefore = await page.locator('#helpModal').isVisible();
  console.log('Modal visible before click "فهمت":', isVisibleBefore);

  // Click the "فهمت" button
  await page.click('#btnCloseHelp');
  console.log('Clicked #btnCloseHelp ("فهمت")');

  // Check if modal is still visible in browser DOM layout
  const isVisibleAfter = await page.locator('#helpModal').isVisible();
  console.log('Modal visible AFTER click "فهمت":', isVisibleAfter);

  // Try to click the dropZone
  let dropZoneClickable = false;
  try {
    await page.click('#dropZone', { timeout: 2000 });
    dropZoneClickable = true;
    console.log('Drop zone clicked successfully!');
  } catch (err) {
    console.log('Drop zone click FAILED (blocked by overlay!):', err.message);
  }

  await page.screenshot({ path: 'test-artifacts/repro-bugA.png' });
  await browser.close();
}

testModal().catch(console.error);
