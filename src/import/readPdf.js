// src/import/readPdf.js - PDF text and color-aware answer extractor

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Configure worker for browser environment
 */
export function setupPdfWorker() {
  if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';
  }
}

/**
 * Parses RGB from various PDF color representations
 */
function parsePdfColor(args) {
  if (!args || !args.length) return [0, 0, 0];

  // Case 1: Hex string e.g. '#c00000' or '#1f4e79'
  if (typeof args[0] === 'string' && args[0].startsWith('#')) {
    const hex = args[0].slice(1);
    if (hex.length === 6) {
      return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16)
      ];
    }
  }

  // Case 2: RGB normalized 0..1 or 0..255
  if (args.length >= 3) {
    let r = +args[0], g = +args[1], b = +args[2];
    if (r <= 1.0 && g <= 1.0 && b <= 1.0 && (r > 0 || g > 0 || b > 0)) {
      r = Math.round(r * 255);
      g = Math.round(g * 255);
      b = Math.round(b * 255);
    }
    return [r, g, b];
  }

  // Case 3: Grayscale 0..1
  if (args.length === 1 && typeof args[0] === 'number') {
    const val = Math.round(args[0] * 255);
    return [val, val, val];
  }

  return [0, 0, 0];
}

/**
 * Checks if RGB color is red: r>=150, g<=95, b<=95
 */
export function isRedRgb(r, g, b) {
  return r >= 150 && g <= 95 && b <= 95;
}

/**
 * Extracts text and red markings from a single PDF page
 */
async function processPage(page) {
  const textContent = await page.getTextContent();
  const opList = await page.getOperatorList();
  const ops = pdfjs.OPS || {};

  // Find operator names
  const opNames = new Map();
  for (const [k, v] of Object.entries(ops)) {
    opNames.set(v, k);
  }

  // Track colors across showText operations
  let currentColor = [0, 0, 0];
  const colorStack = [];
  const textRunsWithColor = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const name = opNames.get(fn) || fn;
    const args = opList.argsArray[i];

    if (name === 'save') {
      colorStack.push([...currentColor]);
    } else if (name === 'restore') {
      if (colorStack.length) currentColor = colorStack.pop();
    } else if (name === 'setFillRGBColor' || name === 'setFillColor') {
      currentColor = parsePdfColor(args);
    } else if (name === 'setFillGray') {
      const g = Math.round((args[0] || 0) * 255);
      currentColor = [g, g, g];
    } else if (name === 'setFillCMYKColor') {
      const c = args[0] || 0, m = args[1] || 0, y = args[2] || 0, k = args[3] || 0;
      const r = Math.round(255 * (1 - c) * (1 - k));
      const g = Math.round(255 * (1 - m) * (1 - k));
      const b = Math.round(255 * (1 - y) * (1 - k));
      currentColor = [r, g, b];
    } else if (name === 'showText') {
      if (args && args[0] && Array.isArray(args[0])) {
        const textStr = args[0]
          .map(glyph => (typeof glyph === 'object' && glyph ? glyph.unicode || '' : ''))
          .join('');
        const isRed = isRedRgb(currentColor[0], currentColor[1], currentColor[2]);
        textRunsWithColor.push({ str: textStr, isRed, color: [...currentColor] });
      }
    }
  }

  // Map red state to textContent items
  // First, check if textRunsWithColor has red chunks
  let hasRedRuns = textRunsWithColor.some(r => r.isRed);

  const rawItems = textContent.items.map((item, idx) => {
    let isRed = false;
    if (hasRedRuns && idx < textRunsWithColor.length) {
      isRed = textRunsWithColor[idx].isRed;
    }
    return {
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      w: item.width || 0,
      h: item.height || (Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1])),
      isRed
    };
  }).filter(it => it.str && it.str.trim().length > 0);

  // If textRuns didn't 1:1 match by index, match by text substring
  if (hasRedRuns) {
    const redPhrases = textRunsWithColor
      .filter(r => r.isRed && r.str.trim().length > 1)
      .map(r => r.str.trim());

    if (redPhrases.length > 0) {
      rawItems.forEach(item => {
        const trimmed = item.str.trim();
        if (redPhrases.some(p => p.includes(trimmed) || trimmed.includes(p))) {
          item.isRed = true;
        }
      });
    }
  }

  // Detect two-column layout:
  // Calculate horizontal midpoint and check if there's a distinct 2-column distribution
  let isTwoColumn = false;
  let midX = 0;
  if (rawItems.length >= 10) {
    const xs = rawItems.map(it => it.x).sort((a, b) => a - b);
    const minX = xs[0];
    const maxX = xs[xs.length - 1];
    const span = maxX - minX;

    if (span > 300) {
      midX = minX + span / 2;
      const leftCount = rawItems.filter(it => it.x < midX - 20).length;
      const rightCount = rawItems.filter(it => it.x > midX + 20).length;
      if (leftCount > 5 && rightCount > 5 && (leftCount + rightCount) / rawItems.length > 0.75) {
        isTwoColumn = true;
      }
    }
  }

  // Column sorting comparator
  const sortItems = (items) => {
    return items.sort((a, b) => {
      // In PDF, Y goes from bottom (0) to top (PH)
      const dy = b.y - a.y;
      if (Math.abs(dy) > 2.5) {
        return dy; // Higher on page comes first
      }
      return a.x - b.x; // Left to right
    });
  };

  let sortedItems = [];
  if (isTwoColumn) {
    const leftCol = rawItems.filter(it => it.x < midX);
    const rightCol = rawItems.filter(it => it.x >= midX);
    sortedItems = [...sortItems(leftCol), ...sortItems(rightCol)];
  } else {
    sortedItems = sortItems(rawItems);
  }

  // Group items into visual lines
  const lines = [];
  let curLine = null;

  sortedItems.forEach(item => {
    if (!curLine) {
      curLine = { y: item.y, items: [item] };
      return;
    }

    const dy = Math.abs(curLine.y - item.y);
    if (dy <= 3.0) {
      // Same baseline
      curLine.items.push(item);
    } else {
      // New line
      lines.push(curLine);
      curLine = { y: item.y, items: [item] };
    }
  });
  if (curLine) lines.push(curLine);

  // Build text strings for lines
  const pageLines = [];
  let prevY = null;

  lines.forEach(line => {
    line.items.sort((a, b) => a.x - b.x);

    let lineText = '';
    let redChars = 0;
    let totalChars = 0;
    let prevItem = null;

    line.items.forEach(it => {
      if (prevItem) {
        const gap = it.x - (prevItem.x + prevItem.w);
        if (gap > (prevItem.h * 0.22)) {
          lineText += ' ';
        }
      }
      lineText += it.str;
      const visible = it.str.trim().length;
      totalChars += visible;
      if (it.isRed) redChars += visible;
      prevItem = it;
    });

    lineText = lineText.trim();
    if (lineText) {
      // Check vertical gap between lines -> insert empty line if needed
      if (prevY !== null && Math.abs(prevY - line.y) > 28) {
        pageLines.push({ text: '', y: prevY });
      }

      if (totalChars > 0 && (redChars / totalChars) > 0.6) {
        const isHeadingOrQs = /^(?:Qs?|Questions?|Section|Chapter|Subject)\b/i.test(lineText) ||
          (/^[A-Z][a-z]+(\s+Qs?)?$/i.test(lineText) && !/^[a-h][\).:\-]/i.test(lineText));
        if (!isHeadingOrQs) {
          lineText += ' ✓';
        }
      }
      pageLines.push({ text: lineText, y: line.y });
      prevY = line.y;
    }
  });

  return pageLines;
}

/**
 * Extracts full text from PDF buffer with layout detection, repeated header purging, and red answers
 */
export async function readPdf(buffer, onProgress = null) {
  setupPdfWorker();
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  let doc;
  try {
    const loadingTask = pdfjs.getDocument({
      data: bytes,
      isEvalSupported: false,
      useSystemFonts: true
    });
    doc = await loadingTask.promise;
  } catch (err) {
    if (err && (err.name === 'PasswordException' || String(err).includes('password'))) {
      throw new Error('الملف محمي بكلمة سر (Password). يرجى فك كلمة السر ورفعه مجددًا.');
    }
    throw new Error('تعذر قراءة ملف الـ PDF. قد يكون الملف تالفًا.');
  }

  const numPages = doc.numPages;
  const allPageLines = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) {
      onProgress(pageNum, numPages);
    }
    const page = await doc.getPage(pageNum);
    const lines = await processPage(page);
    allPageLines.push(lines);
    lines.forEach(l => {
      totalChars += (l.text || '').length;
    });
  }

  // Detect repeated headers and footers across pages (present at similar y on >=60% of pages)
  const lineOccurrences = new Map();
  allPageLines.forEach(pLines => {
    const seenOnPage = new Set();
    pLines.forEach(l => {
      const rawText = (l && typeof l.text === 'string') ? l.text : (typeof l === 'string' ? l : '');
      const norm = rawText.trim();
      if (norm.length > 3 && !seenOnPage.has(norm)) {
        seenOnPage.add(norm);
        lineOccurrences.set(norm, (lineOccurrences.get(norm) || 0) + 1);
      }
    });
  });

  const repeatedJunk = new Set();
  const threshold = Math.max(3, numPages * 0.55);
  lineOccurrences.forEach((count, text) => {
    if (count >= threshold && !/^(Qs|Answer Key)$/i.test(text) && !/^\d{1,3}[-.)]/.test(text)) {
      repeatedJunk.add(text);
    }
  });

  // Recombine lines without headers/footers
  const finalLines = [];
  allPageLines.forEach(pLines => {
    pLines.forEach(l => {
      const rawText = (l && typeof l.text === 'string') ? l.text : (typeof l === 'string' ? l : '');
      if (!rawText || repeatedJunk.has(rawText.trim())) return;
      finalLines.push(rawText);
    });
  });

  const fullText = finalLines.join('\n');
  const avgCharsPerPage = numPages ? (totalChars / numPages) : 0;
  const isScanned = avgCharsPerPage < 30 && numPages > 0;

  return {
    text: fullText,
    metadata: {
      numPages,
      totalChars,
      avgCharsPerPage,
      isScanned
    }
  };
}
