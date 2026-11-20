// tests/profile-pipeline-after.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';

async function measureExportRun(page, label, isThrottled = false) {
  const cdp = await page.context().newCDPSession(page);
  if (isThrottled) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  } else {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }

  // Instrument long tasks and heap
  await page.evaluate(() => {
    window.__perfData = {
      longTasks: [],
      startHeap: performance.memory ? performance.memory.usedJSHeapSize : 0,
      peakHeap: 0
    };

    if (window.PerformanceObserver) {
      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              window.__perfData.longTasks.push({
                duration: entry.duration,
                startTime: entry.startTime
              });
            }
          }
        });
        obs.observe({ entryTypes: ['longtask'] });
      } catch (e) {}
    }

    window.__heapInterval = setInterval(() => {
      if (performance.memory) {
        const heap = performance.memory.usedJSHeapSize;
        if (heap > window.__perfData.peakHeap) {
          window.__perfData.peakHeap = heap;
        }
      }
    }, 20);
  });

  const tStart = Date.now();
  const downloadPromise = page.waitForEvent('download', { timeout: 120000 }).catch(() => null);

  await page.evaluate(async () => {
    const { downloadDirectPDF } = await import('/src/pdfExporter.js');
    await downloadDirectPDF('qs');
  });

  const download = await downloadPromise;
  let fileSize = 0;
  if (download) {
    const downloadPath = path.join('tests', 'test-after-download.pdf');
    await download.saveAs(downloadPath);
    fileSize = fs.statSync(downloadPath).size;
    fs.unlinkSync(downloadPath);
  }

  const { perfData, stageMetrics } = await page.evaluate(() => {
    clearInterval(window.__heapInterval);
    return {
      perfData: window.__perfData,
      stageMetrics: window.__lastExportStageMetrics || {}
    };
  });

  const totalTime = Date.now() - tStart;
  return {
    label,
    isThrottled,
    totalTimeMs: totalTime,
    totalPages: stageMetrics.totalPages || 0,
    fileSize,
    fileSizeMB: (fileSize / 1024 / 1024).toFixed(2),
    longTaskCount: perfData.longTasks.length,
    maxLongTaskMs: perfData.longTasks.reduce((max, t) => Math.max(max, t.duration), 0).toFixed(0),
    peakHeapMB: (perfData.peakHeap / 1024 / 1024).toFixed(1)
  };
}

(async () => {
  const browser = await chromium.launch({
    args: ['--enable-precise-memory-info']
  });

  console.log('=== Running Prompt 7 Pipeline Verification & Benchmarks ===');

  // Test 1: 60 Questions Sample
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

    // 1A. First download on Desktop (Target <= 5s)
    const resDesktop60 = await measureExportRun(page, '60 Qs (Desktop First Run)', false);
    console.log('[RESULT 60 Qs Desktop]:', resDesktop60);

    // 1B. Second download on Desktop (Cache Target < 0.5s)
    const resCache60 = await measureExportRun(page, '60 Qs (Second Run - Cache Hit)', false);
    console.log('[RESULT 60 Qs Cache Hit]:', resCache60);

    // 1C. 4x Throttled Phone Simulation (Target <= 10s)
    // Clear cache by changing quality to test fresh throttled export
    await page.evaluate(async () => {
      const { setExportQuality } = await import('/src/pdfExporter.js');
      setExportQuality('balanced');
    });
    const resThrottled60 = await measureExportRun(page, '60 Qs (4x Throttled CPU)', true);
    console.log('[RESULT 60 Qs 4x Throttled]:', resThrottled60);

    await page.close();
  }

  // Test 2: 227 Questions Bank
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => localStorage.setItem('mq.tourSeen', 'true'));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    const sampleText = fs.readFileSync('samples/epidemiology_extracted.txt', 'utf8');
    await page.evaluate((text) => {
      const raw = document.querySelector('#raw');
      raw.value = text;
      raw.dispatchEvent(new Event('input', { bubbles: true }));
    }, sampleText);

    await page.waitForTimeout(800);
    await page.click('#btnStep1Next');
    await page.waitForTimeout(800);
    await page.click('#btnStep2NextTop');
    await page.waitForTimeout(1200);

    // 2A. 227 Qs Desktop (Target <= 15s)
    const resDesktop227 = await measureExportRun(page, '227 Qs (Desktop)', false);
    console.log('[RESULT 227 Qs Desktop]:', resDesktop227);

    // 2B. 227 Qs Cache Hit (Target < 0.5s)
    const resCache227 = await measureExportRun(page, '227 Qs (Cache Hit)', false);
    console.log('[RESULT 227 Qs Cache Hit]:', resCache227);

    await page.close();
  }

  await browser.close();
  console.log('=== All Benchmarks Complete ===');
})();
