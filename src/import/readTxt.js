// src/import/readTxt.js - Pure text, Markdown, and CSV file reader

/**
 * Normalizes text content:
 * - Line endings (\r\n -> \n, \r -> \n)
 * - Unicode spaces and control characters (BOM, zero-width, non-breaking space)
 */
export function normalizeText(str) {
  return String(str || '')
    .replace(/^\uFEFF/, '') // Strip UTF-8 BOM
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u00A0\u200E\u200F\u202F]/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
}

/**
 * Reads a text file buffer (ArrayBuffer or Uint8Array) into a clean string.
 * Detects UTF-8, UTF-16LE, and UTF-16BE by BOM.
 */
export function readTxtBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // Check UTF-16 BOMs
  if (bytes.length >= 2) {
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return normalizeText(new TextDecoder('utf-16le').decode(bytes.subarray(2)));
    }
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return normalizeText(new TextDecoder('utf-16be').decode(bytes.subarray(2)));
    }
  }

  // Default to UTF-8
  return normalizeText(new TextDecoder('utf-8').decode(bytes));
}

/**
 * Reads a File or Blob as text with encoding detection.
 */
export async function readTxtFile(file) {
  const buffer = await file.arrayBuffer();
  return readTxtBuffer(buffer);
}
