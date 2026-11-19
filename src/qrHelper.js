// qrHelper.js - 100% Client-side Synchronous Vector SVG QR Code Generator
import QRCode from 'qrcode';

/**
 * Generates an SVG string representation of a QR code synchronously
 * @param {string} text - Link or text to encode
 * @param {number} size - Output width/height in px
 * @returns {string} SVG markup
 */
export function generateQrSvg(text, size = 80) {
  if (!text) return '';
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const margin = 1.5;
    const totalSize = count + margin * 2;
    let pathD = '';

    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          pathD += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${size}" height="${size}" class="cover-qr-svg" shape-rendering="crispEdges" alt="QR Code"><rect width="100%" height="100%" fill="#ffffff" rx="2"/><path d="${pathD}" fill="#122036"/></svg>`;
  } catch (err) {
    console.warn('QR Code generation error:', err);
    return '';
  }
}
