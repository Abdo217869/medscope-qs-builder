// src/import/ocr.js - Optional lazy-loaded OCR for scanned documents and images

/**
 * Recognizes text from image or canvas using lazy-loaded Tesseract.js (English)
 *
 * @param {Blob|File|HTMLCanvasElement|string} imageSource
 * @param {Function} onProgress - Progress callback ({ status, progress })
 * @returns {Promise<string>}
 */
export async function recognizeImage(imageSource, onProgress = null) {
  let Tesseract;
  try {
    // Dynamic import to avoid bundling Tesseract into the main application bundle
    Tesseract = await import('tesseract.js');
  } catch (err) {
    throw new Error('لم نتمكن من تشغيل قارئ الصور (OCR). يرجى التأكد من اتصال الإنترنت لتنزيل محرك الـ OCR.');
  }

  const worker = await Tesseract.createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/tesseract-core.wasm.js',
    langPath: '/tesseract',
    gzip: true,
    logger: m => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    }
  });

  try {
    const ret = await worker.recognize(imageSource);
    await worker.terminate();
    return ret.data.text;
  } catch (err) {
    await worker.terminate();
    throw new Error('حدث خطأ أثناء قراءة الصورة: ' + (err.message || ''));
  }
}
