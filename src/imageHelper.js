// src/imageHelper.js - Image processing, downscaling, SVG handling, and decoding

import { setAsset, getAsset, delAsset } from './idb.js';

export const DEFAULT_MEDSCOPE_LOGO = './medscope-watermark-default.png';

/**
 * Downscales an image to maximum 1600px on its longest side preserving aspect ratio and alpha transparency.
 * Handles SVG, PNG, JPG, WebP.
 * Stores result in IndexedDB and returns data URL.
 */
export async function processLogoFile(file) {
  if (!file) throw new Error('لم يتم اختيار ملف');

  const type = file.type || '';
  const name = (file.name || '').toLowerCase();

  // Support SVG
  if (type.includes('svg') || name.endsWith('.svg')) {
    const text = await file.text();
    if (!text.includes('<svg')) {
      throw new Error('ملف SVG غير صالح');
    }
    const blob = new Blob([text], { type: 'image/svg+xml' });
    const dataUrl = URL.createObjectURL(blob);
    await setAsset('custom_logo', text);
    await setAsset('custom_logo_type', 'svg');
    return { dataUrl, type: 'svg' };
  }

  // Support raster images: PNG, JPG, WebP
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('الصورة كبيرة أو تالفة، تعذر قراءتها'));
    };

    reader.onload = async () => {
      const img = new Image();
      img.onerror = () => {
        reject(new Error('الصورة كبيرة أو تالفة، تعذر فتحها'));
      };

      img.onload = async () => {
        try {
          let { width, height } = img;
          const maxSide = 1600;

          if (width > maxSide || height > maxSide) {
            if (width >= height) {
              height = Math.round((height * maxSide) / width);
              width = maxSide;
            } else {
              width = Math.round((width * maxSide) / height);
              height = maxSide;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          // Preserve PNG / WebP transparency
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Export as PNG to retain full alpha
          const finalDataUrl = canvas.toDataURL('image/png', 0.95);

          // Store in IndexedDB
          await setAsset('custom_logo', finalDataUrl);
          await setAsset('custom_logo_type', 'raster');

          // Wait for decoding
          const decodedImg = new Image();
          decodedImg.src = finalDataUrl;
          if (decodedImg.decode) {
            await decodedImg.decode();
          }

          resolve({ dataUrl: finalDataUrl, type: 'raster' });
        } catch (err) {
          reject(new Error('حدث خطأ أثناء معالجة الصورة'));
        }
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Loads the active custom logo from IndexedDB if present
 */
export async function loadStoredLogo() {
  const asset = await getAsset('custom_logo');
  const type = await getAsset('custom_logo_type');
  if (!asset) return null;

  if (type === 'svg') {
    const blob = new Blob([asset], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }
  return asset;
}

/**
 * Deletes custom logo from IndexedDB
 */
export async function removeCustomLogo() {
  await delAsset('custom_logo');
  await delAsset('custom_logo_type');
}
