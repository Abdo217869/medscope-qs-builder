const { chromium } = require('playwright');

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
  await page.waitForTimeout(1000);

  // Take screenshot of step 3
  await page.screenshot({ path: "tests/screenshots/current-local-step3.png" });
  console.log("Captured local step 3!");

  // Let's also inspect elements in advSettingsHost
  const hostHtml = await page.evaluate(() => {
    const host = document.querySelector("#advSettingsHost");
    return host ? host.innerHTML.slice(0, 1000) : "no host";
  });
  console.log("Host HTML start:", hostHtml.slice(0, 300));

  await browser.close();
})();
