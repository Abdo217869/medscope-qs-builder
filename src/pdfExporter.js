// src/pdfExporter.js - Ultra-Fast, Pipelined Client-Side PDF Exporter (Prompt 7)
import { state, getViewData, parsePageRange } from './state.js';
import { renderPagesHTML } from './paper.js';
import { showToast } from './export.js';
import { ProgressTask } from './progressTask.js';

let cachedExportLibs = null;
async function loadExportLibs() {
  if (cachedExportLibs) return cachedExportLibs;
  const [{ PDFDocument }, { domToCanvas }] = await Promise.all([
    import('pdf-lib'),
    import('modern-screenshot')
  ]);
  cachedExportLibs = { PDFDocument, domToCanvas };
  return cachedExportLibs;
}

// Quality settings
export const QUALITY_PRESETS = {
  fast: {
    id: 'fast',
    name: 'سريع',
    scale: 1.25,
    quality: 0.80,
    desc: 'حجم أصغر وسرعة فائقة'
  },
  balanced: {
    id: 'balanced',
    name: 'متوازن',
    scale: 1.5,
    quality: 0.85,
    desc: 'الافتراضي - دقة ممتازة وتوازن مثالي'
  },
  high: {
    id: 'high',
    name: 'جودة عالية',
    scale: 2.0,
    quality: 0.90,
    desc: 'طباعة فائقة الدقة (190 DPI)'
  }
};

let currentQuality = 'balanced';
try {
  const savedQ = localStorage.getItem('mq.exportQuality');
  if (savedQ && QUALITY_PRESETS[savedQ]) {
    currentQuality = savedQ;
  }
} catch (e) {}

export function getExportQuality() {
  return currentQuality;
}

export function setExportQuality(qId) {
  if (QUALITY_PRESETS[qId]) {
    currentQuality = qId;
    try {
      localStorage.setItem('mq.exportQuality', qId);
    } catch (e) {}
    // Invalidate precomputed cache for new quality
    cancelBackgroundPrecompute();
    updateQualityUI();
  }
}

// In-Memory & Page Cache
const exportBlobCache = new Map(); // hash -> { blob, filename, sizeMB, pageCount }
const pageImageCache = new Map();  // pageHtmlHash -> ArrayBuffer

// In-Flight Job Tracker
let currentInFlightJob = null;

// Background Precompute State
let precomputeAbortCtrl = null;
let precomputeTimer = null;
let isPrecomputing = false;

/**
 * Computes a deterministic hash for caching
 */
export function computeExportHash(mode, qualityId, options = {}) {
  const S = state.settings || {};
  const sections = state.data?.sections || [];
  const contentKey = sections.map(s => `${s.name || ''}:${s.qs.length}`).join('|');
  const settingsKey = `${S.theme || ''}:${S.palette || ''}:${S.pageOrientation || ''}:${S.pageSize || ''}:${S.wmType || ''}:${S.coverEnabled || ''}`;
  const rangeKey = options.singlePage ? `p${options.singlePage}` : (options.pageRange || 'all');
  const excludedKey = (options.excludedPages || state.excludedPages) ? Array.from(options.excludedPages || state.excludedPages).sort().join(',') : '';
  return `exp_v7_${mode}_${qualityId}_${contentKey.length}_${settingsKey}_r${rangeKey}_ex${excludedKey}`;
}

/**
 * Updates UI badges when precomputed files are ready
 */
function updatePrecomputeUI(mode, ready) {
  if (typeof document === 'undefined') return;
  const qBtn = document.querySelector('#btnPrintQBig');
  const aBtn = document.querySelector('#btnPrintABig');

  if (mode === 'qs' && qBtn) {
    let badge = qBtn.querySelector('.precomputed-badge');
    if (ready) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'precomputed-badge';
        badge.innerHTML = `⚡ الملف جاهز بنقرة واحدة`;
        qBtn.appendChild(badge);
      }
    } else if (badge) {
      badge.remove();
    }
  }

  if (mode === 'as' && aBtn) {
    let badge = aBtn.querySelector('.precomputed-badge');
    if (ready) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'precomputed-badge';
        badge.innerHTML = `⚡ الملف جاهز بنقرة واحدة`;
        aBtn.appendChild(badge);
      }
    } else if (badge) {
      badge.remove();
    }
  }
}

/**
 * Updates the Quality Pills UI
 */
export function updateQualityUI() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.btn-quality-pill').forEach(btn => {
    const q = btn.dataset.quality;
    if (q === currentQuality) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Cancels background precomputing (e.g. when content or settings change)
 */
export function cancelBackgroundPrecompute() {
  if (precomputeTimer) {
    clearTimeout(precomputeTimer);
    precomputeTimer = null;
  }
  if (precomputeAbortCtrl) {
    precomputeAbortCtrl.abort();
    precomputeAbortCtrl = null;
  }
  isPrecomputing = false;
  exportBlobCache.clear();
  pageImageCache.clear();
  updatePrecomputeUI('qs', false);
  updatePrecomputeUI('as', false);
}

/**
 * Starts background precompute during idle time when in Step 3
 */
export function scheduleBackgroundPrecompute() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // Don't precompute if user has Save-Data or low battery
  if (navigator.connection && navigator.connection.saveData) return;

  cancelBackgroundPrecompute();

  precomputeTimer = setTimeout(async () => {
    // Battery check if API available
    if (navigator.getBattery) {
      try {
        const battery = await navigator.getBattery();
        if (battery && !battery.charging && battery.level < 0.25) return;
      } catch (e) {}
    }

    const sections = getViewData();
    if (!sections || !sections.length) return;

    precomputeAbortCtrl = new AbortController();
    isPrecomputing = true;

    try {
      // Precompute Questions PDF in background idle slices
      await runExportPipeline('qs', {
        qualityId: currentQuality,
        isBackground: true,
        signal: precomputeAbortCtrl.signal
      });
      updatePrecomputeUI('qs', true);

      // Precompute Answers PDF next
      if (!precomputeAbortCtrl.signal.aborted) {
        await runExportPipeline('as', {
          qualityId: currentQuality,
          isBackground: true,
          signal: precomputeAbortCtrl.signal
        });
        updatePrecomputeUI('as', true);
      }
    } catch (e) {
      // Background job cancelled or idle interrupted
    } finally {
      isPrecomputing = false;
      precomputeAbortCtrl = null;
    }
  }, 1200);
}

/**
 * Core export pipeline (used by both direct download and background precompute)
 */
async function runExportPipeline(mode, options = {}) {
  const {
    qualityId = currentQuality,
    isBackground = false,
    signal = null,
    progress = null
  } = options;

  const preset = QUALITY_PRESETS[qualityId] || QUALITY_PRESETS.balanced;
  const sections = getViewData();
  if (!sections.length) throw new Error('لا توجد أسئلة لتحميلها');

  const S = state.settings || {};
  const baseTitle = (S.title || 'Medscope').replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
  let filename = `${baseTitle}-questions.pdf`;
  if (mode === 'as') filename = `${baseTitle}-answers.pdf`;
  if (mode === 'both') filename = `${baseTitle}-complete-exam-and-answers.pdf`;

  if (options.singlePage) {
    filename = `${baseTitle}-${mode === 'as' ? 'answers' : 'questions'}-page-${options.singlePage}.pdf`;
  } else if (options.pageRange && options.pageRange.trim() && options.pageRange.trim().toLowerCase() !== 'all') {
    const rangeSlug = options.pageRange.replace(/[^0-9,-]/g, '').replace(/,/g, '_');
    filename = `${baseTitle}-${mode === 'as' ? 'answers' : 'questions'}-pages-${rangeSlug}.pdf`;
  }

  const cacheKey = computeExportHash(mode, qualityId, options);
  if (exportBlobCache.has(cacheKey)) {
    return exportBlobCache.get(cacheKey);
  }

  // Capability-based scale & iOS clamp
  const isMobile = (typeof window !== 'undefined' && window.innerWidth <= 768) ||
    (typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));

  let scale = preset.scale;
  if (isMobile && scale > 1.5) scale = 1.5;

  // iOS Canvas limit check (14 Mpixel clamp)
  // A4 ratio: 210mm x 297mm -> approx 794 x 1123 px at scale 1.0
  const estimatedPixels = (794 * scale) * (1123 * scale);
  if (estimatedPixels > 14_000_000) {
    scale = Math.sqrt(14_000_000 / (794 * 1123));
  }

  // 1. Preload fonts & decoded watermark image once
  if (progress) progress.update(0, 1, 'بنجهّز الخطوط والصور...');
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const watermarkSrc = S.wmCustomLogo || '/medscope-watermark-default.png';
  if (watermarkSrc) {
    const preImg = new Image();
    preImg.src = watermarkSrc;
    await preImg.decode().catch(() => {});
  }

  if (signal?.aborted) throw new Error('Cancelled');

  // 2. Gather HTML of pages to render
  const isAnswers = (mode === 'as');
  let pagesHtml = '';
  if (mode === 'both') {
    pagesHtml = renderPagesHTML(false) + renderPagesHTML(true);
  } else {
    pagesHtml = renderPagesHTML(isAnswers);
  }

  // Parse individual pages
  const tempWrap = document.createElement('div');
  // Make all images eager in export sandbox to prevent lazy load hangs
  tempWrap.innerHTML = pagesHtml.replace(/loading=["']lazy["']/g, 'loading="eager"');
  // Strip page hover action toolbars from export DOM
  tempWrap.querySelectorAll('.page-action-toolbar').forEach(el => el.remove());

  const allPageEls = Array.from(tempWrap.querySelectorAll('.page'));
  const totalAvailablePages = allPageEls.length;
  if (totalAvailablePages === 0) throw new Error('لم يتم العثور على صفحات صالحة');

  // Determine pages to include
  let targetPages = [];
  const excluded = options.excludedPages || state.excludedPages || new Set();

  if (options.singlePage) {
    const p = parseInt(options.singlePage, 10);
    if (p >= 1 && p <= totalAvailablePages) targetPages = [p];
  } else if (options.pageRange && options.pageRange.trim()) {
    targetPages = parsePageRange(options.pageRange, totalAvailablePages);
  } else {
    for (let i = 1; i <= totalAvailablePages; i++) targetPages.push(i);
  }

  // Filter out excluded pages
  const finalPages = targetPages.filter(p => !excluded.has(p));
  if (finalPages.length === 0) {
    throw new Error('لم يتم تحديد أي صفحات صالحة للتحميل (ربما تم استبعاد كافة الصفحات المحددة)!');
  }

  const pageEls = finalPages.map(pNum => allPageEls[pNum - 1]).filter(Boolean);
  const totalPages = pageEls.length;

  // 3. Isolated minimal DOM sandbox
  let sandbox = document.getElementById('pdfExportIsolatedHost');
  if (!sandbox) {
    sandbox = document.createElement('div');
    sandbox.id = 'pdfExportIsolatedHost';
    sandbox.className = 'pdf-export-isolated-host';
    sandbox.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;min-height:297mm;z-index:-9999;background:#ffffff;';
    document.body.appendChild(sandbox);
  }

  // 4. Initialize Web Worker (or inline PDFDocument fallback)
  let worker = null;
  let inlineDoc = null;
  const useWorker = (typeof Worker !== 'undefined' && !window.__FORCE_INLINE_PDF__);

  const pageSizePt = [595.28, 841.89]; // A4 in points
  if (S.pageOrientation === 'landscape') {
    pageSizePt.reverse();
  }

  const { PDFDocument, domToCanvas } = await loadExportLibs();

  if (useWorker) {
    try {
      worker = new Worker(
        new URL('./workers/pdfWorker.js', import.meta.url),
        { type: 'module' }
      );
      worker.postMessage({
        type: 'INIT',
        payload: {
          title: S.title || 'Medscope Examination',
          pageSizePt,
          totalPages
        }
      });
    } catch (e) {
      console.warn('Web Worker initialization failed, using inline pdf-lib fallback:', e);
      worker = null;
    }
  }

  if (!worker) {
    inlineDoc = await PDFDocument.create();
    inlineDoc.setTitle(S.title || 'Medscope Examination');
    inlineDoc.setAuthor('Medscope');
    inlineDoc.setProducer('Medscope Question Sheet Builder');
  }

  const pageBuffers = [];
  const tAll0 = performance.now();

  try {
    for (let i = 0; i < totalPages; i++) {
      if (signal?.aborted) throw new Error('Cancelled');

      if (progress) {
        progress.update(i + 1, totalPages, `بنرسم صفحة ${i + 1} من ${totalPages}...`);
      }

      const pageHtml = pageEls[i].outerHTML;
      const pageKey = `pg_${pageHtml.length}_${pageHtml.slice(0, 80)}`;

      let jpgBuffer = null;
      if (pageImageCache.has(pageKey)) {
        // Reuse cached image for identical pages (e.g. cover page, subject dividers)
        jpgBuffer = pageImageCache.get(pageKey);
      } else {
        const tNode0 = performance.now();
        sandbox.innerHTML = pageHtml;
        const pageNode = sandbox.firstElementChild;
        const tDomInsert = performance.now() - tNode0;

        // Render page to canvas
        const tCanvas0 = performance.now();
        const canvas = await domToCanvas(pageNode, {
          scale,
          backgroundColor: '#ffffff',
          font: false,
          features: { copyScrollbar: false }
        });
        const tDomToCanvas = performance.now() - tCanvas0;

        // Live thumbnail for progress UI
        if (progress && i === 0) {
          try {
            const thumbUrl = canvas.toDataURL('image/jpeg', 0.5);
            progress.setThumbnail(thumbUrl);
          } catch (e) {}
        }

        // Convert canvas to JPEG blob asynchronously
        const tBlob0 = performance.now();
        let blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', preset.quality));
        if (!blob) {
          const dataUrl = canvas.toDataURL('image/jpeg', preset.quality);
          const bin = atob(dataUrl.split(',')[1]);
          const arr = new Uint8Array(bin.length);
          for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
          jpgBuffer = arr.buffer;
        } else {
          jpgBuffer = await blob.arrayBuffer();
        }
        const tBlob = performance.now() - tBlob0;

        if (i < 3) {
          console.log(`[PAGE ${i}] DomInsert: ${tDomInsert.toFixed(1)}ms | DomToCanvas: ${tDomToCanvas.toFixed(1)}ms | Blob: ${tBlob.toFixed(1)}ms`);
        }

        // Clean up canvas & sandbox immediately
        canvas.width = 0;
        canvas.height = 0;
        sandbox.innerHTML = '';

        // Store in page-level cache for reuse
        pageImageCache.set(pageKey, jpgBuffer);
      }

      // Feed to PDF assembler
      if (worker) {
        // Transfer ArrayBuffer without copy
        const copyBuf = jpgBuffer.slice(0);
        worker.postMessage(
          {
            type: 'ADD_PAGE',
            payload: {
              pageIndex: i,
              imageBuffer: copyBuf,
              widthPt: pageSizePt[0],
              heightPt: pageSizePt[1]
            }
          },
          [copyBuf]
        );
      } else if (inlineDoc) {
        const embeddedImg = await inlineDoc.embedJpg(new Uint8Array(jpgBuffer));
        const pdfPage = inlineDoc.addPage(pageSizePt);
        pdfPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: pageSizePt[0],
          height: pageSizePt[1]
        });
      }

      // Yield to UI to avoid long tasks (> 50ms)
      if (typeof scheduler !== 'undefined' && scheduler.yield) {
        await scheduler.yield();
      } else {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    if (signal?.aborted) throw new Error('Cancelled');

    if (progress) {
      progress.update(totalPages, totalPages, 'بنجمّع الملف...');
    }

    // 5. Finalize PDF
    let finalPdfBytes = null;
    if (worker) {
      finalPdfBytes = await new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
          if (e.data.type === 'DONE') {
            resolve(e.data.pdfBuffer);
          } else if (e.data.type === 'ERROR') {
            reject(new Error(e.data.error));
          }
        };
        worker.onerror = (err) => reject(err);
        worker.postMessage({ type: 'FINISH' });
      });
      worker.terminate();
      worker = null;
    } else if (inlineDoc) {
      const bytes = await inlineDoc.save({ useObjectStreams: true });
      finalPdfBytes = bytes.buffer;
    }

    const totalDuration = performance.now() - tAll0;
    const finalBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });
    const sizeMB = (finalBlob.size / 1024 / 1024).toFixed(2);

    const result = {
      blob: finalBlob,
      filename,
      sizeBytes: finalBlob.size,
      sizeMB,
      totalPages,
      durationMs: totalDuration,
      scale
    };

    // Store in cache
    exportBlobCache.set(cacheKey, result);

    if (typeof window !== 'undefined') {
      window.__lastExportStageMetrics = {
        totalTime: totalDuration,
        totalPages,
        fileSizeBytes: finalBlob.size,
        scale
      };
    }

    return result;
  } catch (err) {
    if (worker) {
      worker.postMessage({ type: 'CANCEL' });
      worker.terminate();
    }
    if (sandbox) sandbox.innerHTML = '';
    throw err;
  }
}

/**
 * Main Direct Download Entrypoint
 * @param {'qs'|'as'|'both'} mode - 'qs' (Questions), 'as' (Answers), 'both' (Combined)
 */
export async function downloadDirectPDF(mode = 'qs', options = {}) {
  const sections = getViewData();
  if (!sections.length) {
    showToast('لا توجد أسئلة لتحميلها!');
    return;
  }

  const cacheKey = computeExportHash(mode, currentQuality, options);
  const S = state.settings || {};
  const baseTitle = (S.title || 'Medscope').replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');

  // Instant Cache Hit (< 0.1s)
  if (exportBlobCache.has(cacheKey)) {
    const cached = exportBlobCache.get(cacheKey);
    triggerDownloadOrShare(cached.blob, cached.filename, baseTitle);
    showToast(`تم التحميل فوراً من الذاكرة ✓ (${cached.sizeMB} MB)`);
    return;
  }

  let isCancelled = false;
  const abortCtrl = new AbortController();

  const progress = new ProgressTask({
    title: options.singlePage ? `بنجهّز تحميل صفحة ${options.singlePage}...` : 'بنجهّز محرك الـ PDF السريع...',
    total: 1,
    onCancel: () => {
      isCancelled = true;
      abortCtrl.abort();
      showToast('تم إلغاء تصدير ملف الـ PDF');
    }
  });

  // 15s gentle tip to suggest "سريع"
  progress.setHintAction(
    'الورقة كبيرة وممكن تاخد وقت، تحب تقلل الجودة لـ "سريع"؟',
    'حوّل لسريع وابدأ فوراً',
    () => {
      setExportQuality('fast');
      setTimeout(() => downloadDirectPDF(mode, options), 100);
    }
  );

  try {
    const result = await runExportPipeline(mode, {
      qualityId: currentQuality,
      isBackground: false,
      signal: abortCtrl.signal,
      progress,
      ...options
    });

    if (isCancelled) return;

    progress.done(`تم ✓ (${result.sizeMB} MB)`);
    triggerDownloadOrShare(result.blob, result.filename, baseTitle);
    showToast(`تم تحميل ${result.filename} بنجاح ✓ (${result.sizeMB} MB)`);
  } catch (err) {
    if (isCancelled || err.message === 'Cancelled') return;
    console.error('Direct PDF export error:', err);
    progress.cancel();

    // Auto-retry once at lower scale if memory or canvas failure
    if (currentQuality !== 'fast') {
      showToast('جاري إعادة المحاولة بجودة سريعة لتوفير الذاكرة...');
      setExportQuality('fast');
      setTimeout(() => downloadDirectPDF(mode, options), 300);
      return;
    }

    showToast('حدث خطأ أثناء التصدير السريع، جاري التحويل لنافذة الطباعة...');
    setTimeout(() => {
      window.print();
    }, 400);
  }
}

/**
 * Triggers file download or Web Share API on mobile
 */
function triggerDownloadOrShare(pdfBlob, filename, baseTitle) {
  const isMobile = (typeof window !== 'undefined' && window.innerWidth <= 768) ||
    (typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));

  const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

  // Web Share API
  if (isMobile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    navigator.share({
      files: [pdfFile],
      title: baseTitle,
      text: `ورقة امتحانات Medscope: ${filename}`
    }).catch((e) => {
      if (e.name !== 'AbortError') {
        fallbackBlobDownload(pdfBlob, filename);
      }
    });
    return;
  }

  fallbackBlobDownload(pdfBlob, filename);
}

function fallbackBlobDownload(pdfBlob, filename) {
  const blobUrl = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}
