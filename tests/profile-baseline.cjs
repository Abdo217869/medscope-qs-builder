// tests/profile-baseline.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';

async function profileExport(page, label, isThrottled = false) {
  const cdp = await page.context().newCDPSession(page);
  if (isThrottled) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  } else {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }

  // Instrument Long Task observer and stage metrics in the browser
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
    }, 50);
  });

  const tStart = Date.now();
  const downloadPromise = page.waitForEvent('download', { timeout: 180000 }).catch(() => null);
  
  await page.evaluate(async () => {
    const { downloadDirectPDF } = await import('/src/pdfExporter.js');
    await downloadDirectPDF('qs');
  });

  const download = await downloadPromise;
  let fileSize = 0;
  if (download) {
    const downloadPath = path.join('tests', 'test-download.pdf');
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
    totalTime,
    totalPages: stageMetrics.totalPages || 0,
    fileSize,
    fileSizeMB: (fileSize / 1024 / 1024).toFixed(2),
    longTaskCount: perfData.longTasks.length,
    maxLongTaskMs: perfData.longTasks.reduce((max, t) => Math.max(max, t.duration), 0).toFixed(0),
    peakHeapMB: (perfData.peakHeap / 1024 / 1024).toFixed(1),
    stages: {
      fontsImagesReadyMs: (stageMetrics.fontsImagesReady || 0).toFixed(0),
      buildPageDOMMs: (stageMetrics.buildPageDOM || 0).toFixed(0),
      rasterisePageTotalMs: (stageMetrics.rasterisePageTotal || 0).toFixed(0),
      avgRasterisePerPageMs: (stageMetrics.avgRasterisePerPage || 0).toFixed(0),
      encodeImageTotalMs: (stageMetrics.encodeImageTotal || 0).toFixed(0),
      addToPDFTotalMs: (stageMetrics.addToPDFTotal || 0).toFixed(0),
      saveBlobMs: (stageMetrics.saveBlob || 0).toFixed(0),
      downloadTriggerMs: (stageMetrics.downloadTrigger || 0).toFixed(0)
    }
  };
}

(async () => {
  const browser = await chromium.launch({
    args: ['--enable-precise-memory-info']
  });
  
  console.log('--- Starting PDF Export Profiling Baseline ---');
  
  // 1. Profile 60 Questions (Desktop)
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => localStorage.setItem('mq.tourSeen', 'true'));
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#dropZone');

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
    await page.waitForTimeout(800);

    const resDesktop60 = await profileExport(page, '60 Questions (Desktop)', false);
    console.log('[BASELINE RESULT 60 Qs Desktop]:', JSON.stringify(resDesktop60, null, 2));
    
    // Save to baseline results file
    fs.writeFileSync('tests/export-baseline-60-desktop.json', JSON.stringify(resDesktop60, null, 2));
    await page.close();
  }

  await browser.close();
  console.log('--- Baseline Profiling Done ---');
})();
