// src/import/fileProcessor.js - Unified File Import Controller

import { readTxtBuffer } from './readTxt.js';
import { readDocx } from './readDocx.js';
import { recognizeImage } from './ocr.js';
import { mergeFiles } from './merge.js';

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.csv', '.png', '.jpg', '.jpeg'];

/**
 * Validates file type and returns friendly message for unsupported formats
 */
export function validateFileType(file) {
  const name = (file.name || '').toLowerCase();
  const ext = name.slice(name.lastIndexOf('.'));

  if (ext === '.doc') {
    throw new Error('الملف ده بصيغة Word قديمة (.doc). افتحه في برنامج Word واحفظه بصيغة (.docx) وارفع الملف الجديد.');
  }

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(`صيغة الملف (${ext || 'غير معروفة'}) غير مدعومة.\nالصيغ المدعومة هي: Word (.docx), PDF (.pdf), ملفات نصية (.txt, .md), وصور (.png, .jpg).`);
  }

  return ext;
}

/**
 * Processes a single file into extracted text
 */
export async function processFile(file, onProgress = null) {
  const ext = validateFileType(file);
  const buffer = await file.arrayBuffer();

  if (ext === '.txt' || ext === '.md' || ext === '.csv') {
    if (onProgress) onProgress({ status: 'reading', message: 'جاري قراءة الملف النصي...' });
    const text = readTxtBuffer(buffer);
    return { name: file.name, text, ext, metadata: {} };
  }

  if (ext === '.docx') {
    if (onProgress) onProgress({ status: 'reading', message: 'جاري فك ضغط واستخراج نصوص Word...' });
    const result = readDocx(buffer);
    return { name: file.name, text: result.text, ext, metadata: result.metadata };
  }

  if (ext === '.pdf') {
    const { readPdf } = await import('./readPdf.js');
    const result = await readPdf(buffer, (pageNum, totalPages) => {
      if (onProgress) {
        onProgress({
          status: 'reading',
          message: `صفحة ${pageNum} من ${totalPages}`,
          progress: Math.round((pageNum / totalPages) * 100)
        });
      }
    });
    return { name: file.name, text: result.text, ext, metadata: result.metadata };
  }

  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    if (onProgress) onProgress({ status: 'ocr', message: 'جاري تشغيل قارئ الصور (OCR)... قد يستغرق لحظات' });
    const ocrText = await recognizeImage(file, (pct) => {
      if (onProgress) {
        onProgress({ status: 'ocr', message: `جاري قراءة النصوص من الصورة (${pct}%)...`, progress: pct });
      }
    });
    return { name: file.name, text: ocrText, ext, metadata: { ocr: true } };
  }

  throw new Error('نوع الملف غير معروف.');
}

/**
 * Processes multiple files, updates progress, and runs smart merging
 */
export async function processMultipleFiles(fileList, onFileProgress = null) {
  const files = Array.from(fileList);
  const extractedFiles = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const extracted = await processFile(file, (p) => {
        if (onFileProgress) onFileProgress(file.name, p);
      });
      extractedFiles.push(extracted);
      if (onFileProgress) {
        onFileProgress(file.name, { status: 'done', message: 'تم بنجاح ✓' });
      }
    } catch (err) {
      if (onFileProgress) {
        onFileProgress(file.name, { status: 'failed', message: err.message || 'فشلت القراءة' });
      }
      throw err;
    }
  }

  // Merge extracted files
  const mergeResult = mergeFiles(extractedFiles);
  return {
    files: extractedFiles,
    mergedText: mergeResult.text,
    mergeMessage: mergeResult.message,
    mergeDetails: mergeResult.details
  };
}
