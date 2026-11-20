const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.addInitScript(() => {
    localStorage.setItem("mq.tourSeen", "true");
  });

  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#dropZone");

  await page.click("#btnSample");
  await page.waitForTimeout(600);
  await page.click("#btnStep2NextTop");
  await page.waitForTimeout(800);

  // Open the settings accordion
  await page.evaluate(() => {
    const acc = document.querySelector("#advSettingsAccordion");
    if (acc) acc.open = true;
  });
  await page.waitForTimeout(300);

  // 1. Color palettes tab
  const colorsTab = await page.$("button[data-tab='colors']");
  if (colorsTab) {
    await colorsTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: "tests/screenshots/desktop-step3-colors.png" });
  }

  // 2. Cover & QR tab
  const coverTab = await page.$("button[data-tab='cover']");
  if (coverTab) {
    await coverTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: "tests/screenshots/desktop-step3-cover.png" });
  }

  // 3. Layout tab
  const layoutTab = await page.$("button[data-tab='layout']");
  if (layoutTab) {
    await layoutTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: "tests/screenshots/desktop-step3-layout.png" });
  }

  console.log("All sections captured!");
  await browser.close();
})();
