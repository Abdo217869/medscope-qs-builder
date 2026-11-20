// tests/test-jpeg-bytes.cjs
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('mq.tourSeen', 'true'));
  await page.goto('http://localhost:5173');

  const res = await page.evaluate(async () => {
    const { domToCanvas } = await import('/src/testRasterizer.js');
    const { renderPagesHTML } = await import('/src/paper.js');

    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;z-index:-9999;background:#ffffff;';
    document.body.appendChild(host);

    const temp = document.createElement('div');
    temp.innerHTML = renderPagesHTML(false).replace(/loading=["']lazy["']/g, 'loading="eager"');
    const firstPage = temp.querySelector('.page');
    host.innerHTML = firstPage.outerHTML;

    const canvas = await domToCanvas(host.firstElementChild, {
      scale: 1.5,
      backgroundColor: '#ffffff'
    });

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    const buf = await blob.arrayBuffer();
    const uint8 = new Uint8Array(buf);

    return {
      byteLength: buf.byteLength,
      first4: [uint8[0], uint8[1], uint8[2], uint8[3]],
      last2: [uint8[uint8.length - 2], uint8[uint8.length - 1]]
    };
  });

  console.log('JPEG check:', res);
  // Valid JPEG starts with [0xFF, 0xD8] (255, 216) and ends with [0xFF, 0xD9] (255, 217)
  const isJpegHeader = res.first4[0] === 255 && res.first4[1] === 216;
  console.log('Is valid JPEG header?', isJpegHeader);

  await browser.close();
})();
