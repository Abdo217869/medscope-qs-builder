// src/import/ocr.js - Robust, Preprocessed OCR Engine with Sub-path Resolution & Watchdogs

import { loadImageToCanvas, preprocessImageForOcr } from './imagePreprocessor.js';
import { cleanOcrText } from './ocrCleaner.js';

/**
 * Resolves Tesseract asset URLs taking into account sub-paths (e.g. GitHub Pages /medscope-qs-builder/)
 */
export function getTesseractConfig() {
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
    ? import.meta.env.BASE_URL
    : '/';
  const prefix = base.endsWith('/') ? base : base + '/';
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : '';

  return {
    workerPath: `${origin}${prefix}tesseract/worker.min.js`,
    corePath: `${origin}${prefix}tesseract/tesseract-core.wasm.js`,
    langPath: `${origin}${prefix}tesseract`,
    gzip: true
  };
}

let activeWorker = null;

/**
 * Terminates the active OCR worker if running
 */
export async function terminateOcrWorker() {
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch (e) {}
    activeWorker = null;
  }
}

/**
 * Recognizes text from image with dark-mode auto-inversion, upscaling, watchdog timer,
 * and smart text reconstruction.
 *
 * @param {Blob|File|HTMLCanvasElement|string} imageSource
 * @param {Function} onProgress - Progress callback ({ status, message, progress })
 * @param {Object} [options] - { mode: 'auto'|'dark'|'bright', timeoutMs: number }
 * @returns {Promise<{ text: string, confidence: number, isDark: boolean }>}
 */
export async function recognizeImage(imageSource, onProgress = null, options = {}) {
  const timeoutMs = options.timeoutMs || 45000;
  let watchdogTimer = null;

  try {
    // 1. Dynamic import of Tesseract.js
    if (onProgress) onProgress({ status: 'ocr', message: 'جاري تحميل محرك الـ OCR...', progress: 10 });
    let Tesseract;
    try {
      Tesseract = await import('tesseract.js');
    } catch (err) {
      throw new Error('فشل تحميل مكتبة قارئ الصور. يرجى التحقق من اتصال الإنترنت أو تحديث الصفحة.');
    }

    // 2. Preprocess Image (Auto-detect dark mode, invert, 2x upscale, contrast)
    if (onProgress) onProgress({ status: 'ocr', message: 'جاري فحص وتجهيز الصورة (معالجة الألوان والتباين)...', progress: 20 });
    const rawCanvas = await loadImageToCanvas(imageSource);
    const { canvas: procCanvas, isDark, inverted } = await preprocessImageForOcr(rawCanvas, {
      mode: options.mode || 'auto'
    });

    // 3. Setup Worker with sub-path configuration
    if (onProgress) onProgress({ status: 'ocr', message: 'جاري تشغيل محرك القراءة والبيانات اللغوية...', progress: 35 });
    const config = getTesseractConfig();

    // Terminate any stuck previous worker
    await terminateOcrWorker();

    let worker = await Tesseract.createWorker('eng', 1, {
      workerPath: config.workerPath,
      corePath: config.corePath,
      langPath: config.langPath,
      gzip: true,
      logger: m => {
        if (!onProgress) return;
        if (m.status === 'loading tesseract core') {
          onProgress({ status: 'ocr', message: 'تحميل محرك Core WASM...', progress: 30 });
        } else if (m.status === 'loading language traineddata') {
          onProgress({ status: 'ocr', message: 'تحميل قاموس اللغة الإنجليزية...', progress: 45 });
        } else if (m.status === 'initializing api') {
          onProgress({ status: 'ocr', message: 'تهيئة المحرك...', progress: 55 });
        } else if (m.status === 'recognizing text') {
          const pct = Math.round(55 + (m.progress || 0) * 40);
          onProgress({ status: 'ocr', message: `جاري قراءة وتحليل النصوص (${Math.round((m.progress || 0) * 100)}%)...`, progress: pct });
        }
      }
    });
    activeWorker = worker;

    // Set page segmentation mode for uniform block/page of text (PSM 6: Assume a single uniform block of text)
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK || '6',
      preserve_interword_spaces: '1',
      user_defined_dpi: '300'
    });

    // 4. Watchdog Timeout: Reject if stuck
    const ocrPromise = (async () => {
      let result = await worker.recognize(procCanvas);
      let text = result.data.text || '';
      let confidence = result.data.confidence || 0;

      // 5. Fallback retry if confidence is low (< 60) and image was auto-inverted
      if (confidence < 60 && inverted && options.mode !== 'none') {
        if (onProgress) onProgress({ status: 'ocr', message: 'إعادة المحاولة بالوضع البديل لرفع الدقة...', progress: 80 });
        const retryRes = await worker.recognize(rawCanvas);
        if ((retryRes.data.confidence || 0) > confidence) {
          text = retryRes.data.text;
          confidence = retryRes.data.confidence;
        }
      }

      await terminateOcrWorker();

      // 6. Post-process and clean OCR text
      const clean = cleanOcrText(text, result.data.tsv);
      return {
        text: clean,
        rawText: text,
        confidence,
        isDark
      };
    })();

    const timeoutPromise = new Promise((_, reject) => {
      watchdogTimer = setTimeout(async () => {
        await terminateOcrWorker();
        reject(new Error('استغرقت قراءة الصورة وقتًا أطول من المعتاد. يرجى تجربة صورة أصغر حجمًا أو نسخ النص يدويًا.'));
      }, timeoutMs);
    });

    const finalResult = await Promise.race([ocrPromise, timeoutPromise]);
    clearTimeout(watchdogTimer);

    if (onProgress) onProgress({ status: 'done', message: 'تمت القراءة بنجاح ✓', progress: 100 });
    return finalResult;
  } catch (err) {
    clearTimeout(watchdogTimer);
    await terminateOcrWorker();
    console.error('OCR recognizeImage error:', err);
    throw err;
  }
}
