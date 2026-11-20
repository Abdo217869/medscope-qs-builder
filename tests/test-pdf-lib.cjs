// tests/test-pdf-lib.cjs
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

(async () => {
  console.log('Testing pdf-lib assembly...');
  const t0 = Date.now();
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('Medscope Examination');
  pdfDoc.setAuthor('Medscope');
  pdfDoc.setProducer('Medscope Question Sheet Builder');

  // Load sample image
  const sampleImgBuf = fs.readFileSync('tests/screenshots/parity-questions-modern.png');

  // Simulate 26 pages
  for (let i = 0; i < 26; i++) {
    const pageImg = await pdfDoc.embedPng(sampleImgBuf);
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
    page.drawImage(pageImg, {
      x: 0,
      y: 0,
      width: 595.28,
      height: 841.89
    });
  }

  const pdfBytes = await pdfDoc.save();
  const t1 = Date.now();
  console.log(`pdf-lib 26 pages assembled in ${t1 - t0} ms! Size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
})();
