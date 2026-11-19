import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:5173/');

  const helpModal = page.locator('#helpModal');
  if (await helpModal.isVisible()) {
    await page.locator('#btnCloseHelp').click();
  }

  await page.locator('.step-btn[data-step="3"]').click();
  await page.waitForTimeout(1000);

  const wmImages = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('.wm img, .cover-logo-wrap img'));
    return imgs.map(img => ({
      src: img.src,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      offsetParent: img.offsetParent !== null,
      computedDisplay: getComputedStyle(img).display,
      computedOpacity: getComputedStyle(img.closest('.wm') || img).opacity,
      computedVisibility: getComputedStyle(img).visibility,
      parentClass: img.parentElement ? img.parentElement.className : '',
      box: img.getBoundingClientRect()
    }));
  });

  console.log('Images in Step 3:', JSON.stringify(wmImages, null, 2));

  // Also check if .wm is covered by .body or anything else
  const zIndexes = await page.evaluate(() => {
    const p1 = document.querySelector('.page.paper');
    if (!p1) return null;
    const wm = p1.querySelector('.wm');
    const body = p1.querySelector('.body');
    const coverLogo = p1.querySelector('.cover-logo-wrap');
    return {
      p1Z: getComputedStyle(p1).zIndex,
      wmZ: wm ? getComputedStyle(wm).zIndex : null,
      wmOpacity: wm ? getComputedStyle(wm).opacity : null,
      bodyZ: body ? getComputedStyle(body).zIndex : null,
      bodyBg: body ? getComputedStyle(body).backgroundColor : null,
      coverLogoZ: coverLogo ? getComputedStyle(coverLogo).zIndex : null,
    };
  });
  console.log('Z-Indexes and opacities:', zIndexes);

  await page.screenshot({ path: 'test-artifacts/step3-preview.png', fullPage: true });
  await browser.close();
})();
