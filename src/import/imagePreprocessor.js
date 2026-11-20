// src/import/imagePreprocessor.js - Smart Image Preprocessing for High-Accuracy OCR
// Handles dark mode auto-inversion, 2x upscaling, EXIF orientation, contrast boost, and edge noise masking

/**
 * Loads an image from Blob/File/URL onto a canvas with EXIF orientation applied
 *
 * @param {Blob|File|HTMLImageElement|HTMLCanvasElement|string} source
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function loadImageToCanvas(source) {
  // If already a canvas, return a copy
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    const c = document.createElement('canvas');
    c.width = source.width;
    c.height = source.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(source, 0, 0);
    return c;
  }

  // Use createImageBitmap with EXIF auto-orientation if available
  if (typeof createImageBitmap !== 'undefined' && (source instanceof Blob || source instanceof File)) {
    try {
      const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
      const c = document.createElement('canvas');
      c.width = bitmap.width;
      c.height = bitmap.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close?.();
      return c;
    } catch (e) {
      console.warn('createImageBitmap failed, falling back to Image():', e);
    }
  }

  // Standard Image fallback
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrl = null;
    if (source instanceof Blob || source instanceof File) {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    } else if (typeof source === 'string') {
      img.src = source;
    } else if (source && source.src) {
      img.src = source.src;
    } else {
      return reject(new Error('مصدر الصورة غير مدعوم'));
    }

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(c);
    };

    img.onerror = (err) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('فشل فك تشفير وتنسيق الصورة'));
    };
  });
}

/**
 * Preprocesses image for optimal Tesseract accuracy:
 * 1. Auto-detect dark mode and invert (light text on dark background -> dark text on white)
 * 2. 2x smart upscaling for phone screenshots
 * 3. Contrast normalization & adaptive thresholding
 * 4. Masking isolated floating widgets on borders
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} options - { mode: 'auto'|'dark'|'bright'|'none', upscale: boolean, maskWidgets: boolean }
 * @returns {Promise<{ canvas: HTMLCanvasElement, isDark: boolean, confidenceBoost: boolean }>}
 */
export async function preprocessImageForOcr(canvas, options = {}) {
  const mode = options.mode || 'auto'; // 'auto' | 'dark' | 'bright' | 'none'
  const allowUpscale = options.upscale !== false;
  const maskWidgets = options.maskWidgets !== false;

  let width = canvas.width;
  let height = canvas.height;
  if (width === 0 || height === 0) {
    throw new Error('أبعاد الصورة غير صالحة');
  }

  // Cap huge images to prevent OOM
  const maxPixels = 12 * 1024 * 1024; // 12 MP
  if (width * height > maxPixels) {
    const scale = Math.sqrt(maxPixels / (width * height));
    const downCanvas = document.createElement('canvas');
    downCanvas.width = Math.round(width * scale);
    downCanvas.height = Math.round(height * scale);
    const downCtx = downCanvas.getContext('2d');
    downCtx.drawImage(canvas, 0, 0, downCanvas.width, downCanvas.height);
    canvas = downCanvas;
    width = canvas.width;
    height = canvas.height;
  }

  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  // 1. Calculate Mean Luminance & Background Polarity
  let sumLuminance = 0;
  // Sample every 4th pixel for speed
  const step = 4;
  let sampleCount = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    sumLuminance += lum;
    sampleCount++;
  }
  const meanLuminance = sumLuminance / sampleCount;
  const isDark = (meanLuminance < 125);

  const shouldInvert = (mode === 'dark') || (mode === 'auto' && isDark);

  // 2. Grayscale, Inversion, and Contrast Stretch
  // Find min and max for contrast stretching
  let minLum = 255;
  let maxLum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (shouldInvert) {
      lum = 255 - lum;
    }

    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;

    data[i] = lum;
    data[i + 1] = lum;
    data[i + 2] = lum;
    data[i + 3] = 255;
  }

  // Apply contrast stretch if dynamic range is compressed
  const lumRange = maxLum - minLum;
  if (lumRange > 20 && lumRange < 240) {
    const factor = 255 / lumRange;
    for (let i = 0; i < data.length; i += 4) {
      let val = (data[i] - minLum) * factor;
      if (val < 0) val = 0;
      if (val > 255) val = 255;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  }

  // 3. Mask Edge UI Widgets (floating button on right edge like mobile Word reader)
  if (maskWidgets && width > 300) {
    // Check right 8% margin for isolated non-text blobs
    const rightMarginStart = Math.floor(width * 0.92);
    // Find background luminance (most common at edges)
    const bgVal = shouldInvert ? 255 : (data[0] || 255);

    // If there is an isolated dark/bright island near right edge vertically centered
    const midYStart = Math.floor(height * 0.35);
    const midYEnd = Math.floor(height * 0.65);

    for (let y = midYStart; y < midYEnd; y++) {
      for (let x = rightMarginStart; x < width; x++) {
        const idx = (y * width + x) * 4;
        // If pixel significantly differs from background, mask it with clean background
        if (Math.abs(data[idx] - bgVal) > 40) {
          data[idx] = bgVal;
          data[idx + 1] = bgVal;
          data[idx + 2] = bgVal;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // 4. 2x Upscaling for phone screenshots with small text
  let finalCanvas = canvas;
  if (allowUpscale && (width < 1200 || height < 1200)) {
    const scale = Math.min(2.0, 1600 / Math.max(width, height));
    if (scale > 1.2) {
      const upCanvas = document.createElement('canvas');
      upCanvas.width = Math.round(width * scale);
      upCanvas.height = Math.round(height * scale);
      const upCtx = upCanvas.getContext('2d');
      upCtx.imageSmoothingEnabled = true;
      upCtx.imageSmoothingQuality = 'high';
      upCtx.drawImage(canvas, 0, 0, upCanvas.width, upCanvas.height);
      finalCanvas = upCanvas;
    }
  }

  return {
    canvas: finalCanvas,
    isDark,
    meanLuminance,
    inverted: shouldInvert
  };
}
