// tests/test-pdf-lib-jpg.cjs
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

(async () => {
  console.log('Testing pdf-lib with embedJpg...');
  const t0 = Date.now();
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('Medscope Examination');
  pdfDoc.setAuthor('Medscope');
  pdfDoc.setProducer('Medscope Question Sheet Builder');

  // Load sample JPEG
  // Convert parity-questions-modern.png to a jpeg or create dummy jpeg buffer
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const imgBase64 = fs.readFileSync('tests/screenshots/parity-questions-modern.png').toString('base64');
  const jpgBase64 = await page.evaluate(async (b64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = 'data:image/png;base64,' + b64;
    });
  }, imgBase64);
  await browser.close();

  const jpgBuf = Buffer.from(jpgBase64.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
  console.log('Sample JPEG buffer size:', jpgBuf.length, 'bytes');

  const tJpg0 = Date.now();
  for (let i = 0; i < 26; i++) {
    const pageImg = await pdfDoc.embedJpg(jpgBuf);
    const pdfPage = pdfDoc.addPage([595.28, 841.89]);
    pdfPage.drawImage(pageImg, {
      x: 0,
      y: 0,
      width: 595.28,
      height: 841.89
    });
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  const tJpg1 = Date.now();
  console.log(`embedJpg 26 pages assembled in ${tJpg1 - tJpg0} ms! File size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
})();
