const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  
  await page.addInitScript(() => {
    localStorage.setItem("mq.tourSeen", "true");
  });

  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#dropZone");

  await page.click("#btnSample");
  await page.waitForTimeout(600);
  await page.click("#btnStep2NextTop");
  await page.waitForTimeout(1000);

  // Scroll to studio
  await page.evaluate(() => {
    const el = document.querySelector("#step3Studio");
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(400);

  // 1. Capture Presets and Top Toolbar
  await page.screenshot({ path: "tests/screenshots/studio-new-presets.png" });
  console.log("Captured studio-new-presets.png");

  // 2. Click Watermark Tab
  await page.evaluate(() => {
    const tab = document.querySelector("button[data-tab='watermark']");
    if (tab) tab.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "tests/screenshots/studio-new-watermark.png" });
  console.log("Captured studio-new-watermark.png");

  // 3. Click Page & Margins Tab
  await page.evaluate(() => {
    const tab = document.querySelector("button[data-tab='page']");
    if (tab) tab.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "tests/screenshots/studio-new-page.png" });
  console.log("Captured studio-new-page.png");

  // 4. Click Colors Tab
  await page.evaluate(() => {
    const tab = document.querySelector("button[data-tab='palette']");
    if (tab) tab.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "tests/screenshots/studio-new-colors.png" });
  console.log("Captured studio-new-colors.png");

  await browser.close();
})();
