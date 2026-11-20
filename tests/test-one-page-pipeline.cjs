// tests/test-one-page-pipeline.cjs
const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.addInitScript(() => localStorage.setItem('mq.tourSeen', 'true'));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

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

  const testResult = await page.evaluate(async () => {
    const { domToCanvas } = await import('/src/testRasterizer.js');
    const { renderPagesHTML } = await import('/src/paper.js');

    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;z-index:-9999;background:#ffffff;';
    document.body.appendChild(host);

    // Preload & decode watermark and logos
    const watermarkSrc = '/medscope-watermark-default.png';
    const preImg = new Image();
    preImg.src = watermarkSrc;
    await preImg.decode().catch(() => {});

    const temp = document.createElement('div');
    // Ensure all images are eager in export
    temp.innerHTML = renderPagesHTML(false).replace(/loading=["']lazy["']/g, 'loading="eager"');
    const pages = Array.from(temp.querySelectorAll('.page')).map(p => p.outerHTML);

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    console.log(`Testing all ${pages.length} pages...`);
    const timings = [];
    const tAll0 = performance.now();

    for (let i = 0; i < pages.length; i++) {
      const t0 = performance.now();
      host.innerHTML = pages[i];
      const pageEl = host.firstElementChild;

      const canvas = await domToCanvas(pageEl, {
        scale: 1.5,
        backgroundColor: '#ffffff'
      });

      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
      const buf = await blob.arrayBuffer();

      canvas.width = 0;
      canvas.height = 0;
      host.innerHTML = '';

      const t1 = performance.now();
      timings.push(t1 - t0);
      console.log(`Page ${i + 1}/${pages.length} done in ${(t1 - t0).toFixed(0)} ms (buf: ${buf.byteLength})`);
      await new Promise(r => setTimeout(r, 0));
    }

    host.remove();
    const totalTime = performance.now() - tAll0;
    return {
      pagesCount: pages.length,
      totalTimeMs: totalTime.toFixed(0),
      avgPerPageMs: (totalTime / pages.length).toFixed(1)
    };
  });

  console.log('Results:', testResult);
  await browser.close();
})();
