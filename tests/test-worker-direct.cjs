// tests/test-worker-direct.cjs
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERR:', err));

  await page.goto('http://localhost:5173');

  const res = await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      try {
        console.log('Instantiating worker...');
        const worker = new Worker(
          new URL('/src/workers/pdfWorker.js', window.location.href),
          { type: 'module' }
        );

        worker.onerror = (err) => {
          console.error('Worker error:', err);
          reject(err.message || 'Worker error');
        };

        worker.onmessage = (e) => {
          console.log('Worker message:', e.data);
          if (e.data.type === 'INIT_OK') {
            console.log('Worker initialized successfully!');
            worker.terminate();
            resolve({ ok: true });
          }
        };

        worker.postMessage({
          type: 'INIT',
          payload: { title: 'Test', pageSizePt: [595.28, 841.89] }
        });
      } catch (err) {
        console.error('Failed to create worker:', err);
        reject(err.message);
      }
    });
  });

  console.log('Worker test result:', res);
  await browser.close();
})();
