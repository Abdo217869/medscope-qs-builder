const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Testing duplicate removal and section divider text controls...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('mq.tourSeen', 'true');
    localStorage.setItem('mq.tourSeen', '1');
  });

  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });

  // Dismiss help modal
  await page.evaluate(() => {
    const m = document.getElementById('helpModal');
    if (m) { m.hidden = true; m.style.display = 'none'; }
  });

  // Load sample -> Step 2 -> Step 3
  await page.click('#btnSample');
  await page.waitForTimeout(500);
  await page.click('#btnStep2NextTop');
  await page.waitForTimeout(1000);

  // 1. Verify Duplicate Removal
  const qualityBarCount = await page.$$eval('.download-quality-bar', els => els.length);
  console.log('Number of download quality bars found in DOM:', qualityBarCount);
  if (qualityBarCount !== 1) {
    throw new Error('Expected exactly 1 download-quality-bar, found ' + qualityBarCount);
  }

  // Take screenshot of the download hero area showing single bar
  const singleBarArtifact = path.resolve('C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/verified-single-quality-bar.png');
  await page.screenshot({ path: singleBarArtifact });
  console.log('Saved single quality bar screenshot to:', singleBarArtifact);

  // 2. Open Cover and Section Dividers Tab
  await page.click('button[data-tab="cover"]');
  await page.waitForTimeout(500);

  // Check section title override
  const titleInput = await page.$('input[data-key="secPageTitleOverride"]');
  console.log('Found secPageTitleOverride input:', !!titleInput);

  // Set a custom title: "General Anatomy & Histology"
  await page.evaluate(() => {
    const inp = document.querySelector('input[data-key="secPageTitleOverride"]');
    if (inp) {
      inp.value = 'General Anatomy & Histology';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const subInp = document.querySelector('input[data-key="secPageSub"]');
    if (subInp) {
      subInp.value = 'Exam Questions';
      subInp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.waitForTimeout(600);

  // Check rendered paper section cover page
  const secTitle = await page.$eval('.section-cover-page h1', el => el.textContent.trim()).catch(() => 'NONE');
  console.log('Rendered section divider title:', secTitle);

  const secSub = await page.$eval('.section-cover-page .qs', el => el.textContent.trim()).catch(() => 'NONE');
  console.log('Rendered section divider subtitle:', secSub);

  // Verify NO Arabic words exist anywhere on paper pages
  const allPaperText = await page.$$eval('.paper', pages => pages.map(p => p.textContent).join(' '));
  const arabicMatches = allPaperText.match(/[\u0600-\u06FF]+/g);
  console.log('Arabic words found in rendered paper:', arabicMatches ? arabicMatches.slice(0, 10) : 'NONE (100% English!)');

  const dividerArtifact = path.resolve('C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/verified-custom-divider.png');
  await page.screenshot({ path: dividerArtifact });
  console.log('Saved custom divider screenshot to:', dividerArtifact);

  await browser.close();
  console.log('Verification completed successfully!');
})();
