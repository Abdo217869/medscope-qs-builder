import { test, expect } from '@playwright/test';

test.describe('Bug A Regression Tests: First-visit tour & fail-safe overlay', () => {
  test('First visit with empty storage: overlay appears, "فهمت" closes it, drop zone is clickable', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Assert overlay is visible on first visit
    const helpModal = page.locator('#helpModal');
    await expect(helpModal).toBeVisible();

    // Take screenshot of first-visit tour
    await page.screenshot({ path: 'test-artifacts/bugA-1-first-visit-modal.png' });

    // Click "فهمت" button
    const btnCloseHelp = page.locator('#btnCloseHelp');
    await btnCloseHelp.click();

    // Assert overlay is completely hidden
    await expect(helpModal).toBeHidden();

    // Assert drop zone is clickable and receptive to interactions
    const dropZone = page.locator('#dropZone');
    await expect(dropZone).toBeVisible();
    await dropZone.click();

    // Take screenshot after dismiss
    await page.screenshot({ path: 'test-artifacts/bugA-2-modal-dismissed.png' });

    // Reload page -> modal should NOT appear again because tourSeen was stored
    await page.reload();
    await expect(helpModal).toBeHidden();

    // Reopen using "❓ إزاي أستخدم الموقع؟"
    const btnHelp = page.locator('#btnHelp');
    await btnHelp.click();
    await expect(helpModal).toBeVisible();

    // Close via '✕' button
    const btnX = page.locator('#btnCloseHelpX');
    await btnX.click();
    await expect(helpModal).toBeHidden();

    // Reopen and close via Escape
    await btnHelp.click();
    await expect(helpModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(helpModal).toBeHidden();

    // Reopen and close via click outside
    await btnHelp.click();
    await expect(helpModal).toBeVisible();
    await helpModal.click({ position: { x: 10, y: 10 } });
    await expect(helpModal).toBeHidden();
  });

  test('Works safely even when localStorage is disabled or throws', async ({ page }) => {
    // Disable localStorage to simulate private mode / strict storage block
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => { throw new Error('SecurityError: Access denied'); },
          setItem: () => { throw new Error('SecurityError: Access denied'); },
          removeItem: () => { throw new Error('SecurityError: Access denied'); },
          clear: () => { throw new Error('SecurityError: Access denied'); },
        },
        configurable: true
      });
    });

    await page.goto('http://localhost:5173/');

    const helpModal = page.locator('#helpModal');
    // Even if storage throws, app loads and modal can be closed without error
    if (await helpModal.isVisible()) {
      await page.locator('#btnCloseHelp').click();
      await expect(helpModal).toBeHidden();
    }

    const dropZone = page.locator('#dropZone');
    await expect(dropZone).toBeVisible();
  });
});
