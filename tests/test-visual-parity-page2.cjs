// tests/test-visual-parity-page2.cjs
const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('mq.tourSeen', 'true'));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Load 60-question sample
  const sampleText = fs.readFileSync('samples/medscope-end30-with-answers.txt', 'utf8');
  await page.evaluate((text) => {
    const raw = document.querySelector('#raw');
    raw.value = text;
    raw.dispatchEvent(new Event('input', { bubbles: true }));
  }, sampleText);

  await page.waitForTimeout(600);
  await page.click('#btnStep1Next');
  await page.waitForTimeout(600);
  await page.click('#btnStep2NextTop');
  await page.waitForTimeout(1000);

  const images = await page.evaluate(async () => {
    const { html2canvas, domToCanvas } = await import('/src/testRasterizer.js');

    const pages = document.querySelectorAll('.page');
    const qPage = pages[1] || pages[0]; // Questions page
    const h2cCanvas = await html2canvas(qPage, { scale: 1.5, logging: false });
    const modernCanvas = await domToCanvas(qPage, { scale: 1.5 });

    return {
      h2cData: h2cCanvas.toDataURL('image/png'),
      modernData: modernCanvas.toDataURL('image/png')
    };
  });

  const saveBase64 = (dataUrl, filePath) => {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  };

  saveBase64(images.h2cData, 'tests/screenshots/parity-qpage-html2canvas.png');
  saveBase64(images.modernData, 'tests/screenshots/parity-qpage-modern.png');

  console.log('Q-Page parity images saved!');
  await browser.close();
})();
