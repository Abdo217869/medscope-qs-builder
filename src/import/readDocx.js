// src/import/readDocx.js - Word (.docx) document extractor

import { unzipSync, strFromU8 } from 'fflate';

/**
 * Converts decimal number to Roman numeral
 */
function toRoman(num) {
  const lookup = [
    ['m', 1000], ['cm', 900], ['d', 500], ['cd', 400],
    ['c', 100], ['xc', 90], ['l', 50], ['xl', 40],
    ['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1]
  ];
  let res = '';
  for (const [letter, val] of lookup) {
    while (num >= val) {
      res += letter;
      num -= val;
    }
  }
  return res;
}

/**
 * Formats a sequence number according to Word numFmt
 */
function formatNumber(num, fmt) {
  if (fmt === 'lowerLetter') {
    return String.fromCharCode(96 + ((num - 1) % 26) + 1);
  }
  if (fmt === 'upperLetter') {
    return String.fromCharCode(64 + ((num - 1) % 26) + 1);
  }
  if (fmt === 'lowerRoman') {
    return toRoman(num);
  }
  if (fmt === 'upperRoman') {
    return toRoman(num).toUpperCase();
  }
  if (fmt === 'bullet' || fmt === 'none') {
    return '';
  }
  return String(num); // decimal default
}

/**
 * Decodes XML entities
 */
function decodeXml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * Parses word/numbering.xml into a definitions map
 */
function parseNumbering(numXml) {
  const numDefs = new Map(); // numId -> abstractNumId
  const abstractLevels = new Map(); // abstractNumId:ilvl -> { numFmt, lvlText, start }

  if (!numXml) return { numDefs, abstractLevels };

  // Parse num mappings: <w:num w:numId="1"><w:abstractNumId w:val="0"/>...
  const numRegex = /<w:num\s+[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g;
  let m;
  while ((m = numRegex.exec(numXml)) !== null) {
    const numId = m[1];
    const body = m[2];
    const absM = body.match(/<w:abstractNumId\s+[^>]*w:val="(\d+)"/);
    if (absM) {
      numDefs.set(numId, absM[1]);
    }
  }

  // Parse abstractNum levels: <w:abstractNum w:abstractNumId="0">...<w:lvl w:ilvl="0">...
  const absRegex = /<w:abstractNum\s+[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
  while ((m = absRegex.exec(numXml)) !== null) {
    const absId = m[1];
    const body = m[2];
    const lvlRegex = /<w:lvl\s+[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g;
    let lm;
    while ((lm = lvlRegex.exec(body)) !== null) {
      const ilvl = lm[1];
      const lbody = lm[2];

      const numFmtM = lbody.match(/<w:numFmt\s+[^>]*w:val="([^"]+)"/);
      const lvlTextM = lbody.match(/<w:lvlText\s+[^>]*w:val="([^"]+)"/);
      const startM = lbody.match(/<w:start\s+[^>]*w:val="(\d+)"/);

      const numFmt = numFmtM ? numFmtM[1] : 'decimal';
      const lvlText = lvlTextM ? decodeXml(lvlTextM[1]) : '%1.';
      const start = startM ? +startM[1] : 1;

      abstractLevels.set(`${absId}:${ilvl}`, { numFmt, lvlText, start });
    }
  }

  return { numDefs, abstractLevels };
}

/**
 * Checks if a color hex string is red: r>=150, g<=95, b<=95
 */
export function isRedHex(hex) {
  if (!hex || hex === 'auto') return false;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return r >= 150 && g <= 95 && b <= 95;
}

/**
 * Extracts clean question text with answers from Word .docx file
 */
export function readDocx(buffer, options = {}) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let unzipped;
  try {
    unzipped = unzipSync(bytes);
  } catch (err) {
    throw new Error('الملف غير صالح أو تالف كـ Word (.docx)');
  }

  const docFile = unzipped['word/document.xml'];
  if (!docFile) {
    throw new Error('الملف لا يحتوي على نص Word صالح (document.xml مفقود)');
  }

  const docXml = strFromU8(docFile);
  const numberingXml = unzipped['word/numbering.xml'] ? strFromU8(unzipped['word/numbering.xml']) : '';

  // Check embedded images
  const imageFiles = Object.keys(unzipped).filter(k => k.startsWith('word/media/'));
  const imageCount = imageFiles.length;

  const { numDefs, abstractLevels } = parseNumbering(numberingXml);

  // Counters per list instance: `${numId}:${ilvl}` -> count
  const counters = new Map();

  const lines = [];
  let paragraphCount = 0;

  // Walk elements inside w:body
  const bodyMatch = docXml.match(/<w:body>([\s\S]*?)<\/w:body>/);
  const bodyContent = bodyMatch ? bodyMatch[1] : docXml;

  // Regex to split body into paragraphs (w:p) and table rows (w:tr)
  const elementRegex = /<w:p(?:\s+[^>]*)?>([\s\S]*?)<\/w:p>|<w:tr(?:\s+[^>]*)?>([\s\S]*?)<\/w:tr>/g;
  let elem;

  while ((elem = elementRegex.exec(bodyContent)) !== null) {
    const isRow = !!elem[2];
    const content = isRow ? elem[2] : elem[1];

    if (isRow) {
      // Table row: extract cells
      const tcRegex = /<w:tc(?:\s+[^>]*)?>([\s\S]*?)<\/w:tc>/g;
      let tc;
      const cellTexts = [];
      while ((tc = tcRegex.exec(content)) !== null) {
        // extract all text inside cell
        const tMatches = [...tc[1].matchAll(/<w:t(?:\s+[^>]*)?>([^<]*)<\/w:t>/g)];
        const cellStr = tMatches.map(m => decodeXml(m[1])).join('').trim();
        if (cellStr) cellTexts.push(cellStr);
      }
      if (cellTexts.length) {
        lines.push(cellTexts.join('  '));
      }
      continue;
    }

    // Standard paragraph
    paragraphCount++;

    // Check list numbering properties: <w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/>
    let listPrefix = '';
    const numPrMatch = content.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
    if (numPrMatch) {
      const numPr = numPrMatch[1];
      const numIdM = numPr.match(/<w:numId\s+[^>]*w:val="(\d+)"/);
      const ilvlM = numPr.match(/<w:ilvl\s+[^>]*w:val="(\d+)"/);

      if (numIdM) {
        const numId = numIdM[1];
        const ilvl = ilvlM ? +ilvlM[1] : 0;
        const absId = numDefs.get(numId);
        const def = abstractLevels.get(`${absId}:${ilvl}`);

        if (def) {
          // Reset deeper levels
          for (let deeper = ilvl + 1; deeper <= 9; deeper++) {
            counters.delete(`${numId}:${deeper}`);
          }

          const key = `${numId}:${ilvl}`;
          const currentCount = counters.has(key) ? counters.get(key) + 1 : def.start;
          counters.set(key, currentCount);

          // Build prefix from lvlText e.g. "%1." or "%2)"
          let prefix = def.lvlText;
          for (let lvlIdx = 0; lvlIdx <= ilvl; lvlIdx++) {
            const lvlDef = abstractLevels.get(`${absId}:${lvlIdx}`) || def;
            const lvlVal = counters.get(`${numId}:${lvlIdx}`) || lvlDef.start;
            const formatted = formatNumber(lvlVal, lvlDef.numFmt);
            prefix = prefix.replace(new RegExp(`%${lvlIdx + 1}`, 'g'), formatted);
          }
          if (prefix) {
            listPrefix = `${prefix} `;
          }
        }
      }
    }

    // Extract text runs: <w:r>...</w:r>
    const runRegex = /<w:r(?:\s+[^>]*)?>([\s\S]*?)<\/w:r>/g;
    let rMatch;
    let pText = '';
    let redLen = 0;
    let totalLen = 0;

    while ((rMatch = runRegex.exec(content)) !== null) {
      const rContent = rMatch[1];

      // Check run properties
      const rPrMatch = rContent.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
      let isRed = false;
      let isBold = false;
      let isHighlight = false;

      if (rPrMatch) {
        const rPr = rPrMatch[1];
        const colorM = rPr.match(/<w:color\s+[^>]*w:val="([A-Fa-f0-9]{6})"/);
        if (colorM && isRedHex(colorM[1])) isRed = true;

        if (options.boldAsCorrect && /<w:b(?:\s|\/|>)/.test(rPr) && !/<w:b\s+[^>]*w:val="0"/.test(rPr)) {
          isBold = true;
        }
        if (options.highlightAsCorrect && /<w:highlight(?:\s|\/|>)/.test(rPr) && !/<w:highlight\s+[^>]*w:val="none"/.test(rPr)) {
          isHighlight = true;
        }
      }

      // Extract text, tabs, and brs
      const textTokenRegex = /<w:t(?:\s+[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g;
      let tToken;
      while ((tToken = textTokenRegex.exec(rContent)) !== null) {
        if (tToken[0] === '<w:tab/>') {
          pText += ' ';
        } else if (tToken[0] === '<w:br/>') {
          pText += '\n';
        } else if (tToken[1]) {
          const runStr = decodeXml(tToken[1]);
          pText += runStr;
          const visibleLength = runStr.replace(/\s+/g, '').length;
          totalLen += visibleLength;
          if (isRed || isBold || isHighlight) {
            redLen += visibleLength;
          }
        }
      }
    }

    // Normalise typography & whitespace
    let cleanLine = pText
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u00A0\u200E\u200F\u202F]/g, ' ')
      .replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanLine) {
      let finalLine = listPrefix ? `${listPrefix}${cleanLine}` : cleanLine;
      if (totalLen > 0 && (redLen / totalLen) > 0.6) {
        finalLine += ' ✓';
      }
      lines.push(finalLine);
    }
  }

  const resultText = lines.join('\n');
  const hasImagesOnly = resultText.length < 50 && imageCount > 0;

  return {
    text: resultText,
    metadata: {
      imageCount,
      paragraphCount,
      hasImagesOnly
    }
  };
}
