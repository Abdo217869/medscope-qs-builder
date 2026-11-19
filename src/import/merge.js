// src/import/merge.js - Smart multi-file merger for questions, answers, and keys

import { parse, parseKey, LET } from '../parser.js';

/**
 * Normalizes question stem for comparison
 */
function normStem(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '').trim();
}

/**
 * Cleans a filename to derive a readable subject name
 */
export function cleanFileName(fileName) {
  return String(fileName || '')
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[_\-]+/g, ' ')
    .replace(/\b(MCQ|Question|Bank|Qs?|Answers?|As?|Exam|Final|Mock|Medscope)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if text is an answer key (many 1-B pairs, few or no options)
 */
export function isAnswerKeyText(text, fileName = '') {
  const hasKeyName = /(answer|key|model|as|اجاب|مفتاح)/i.test(fileName);
  const pairs = parseKey(text);
  const hasOptions = /^[a-d]\s*[\).]/im.test(text);

  if (pairs.length >= 5 && (!hasOptions || hasKeyName)) {
    return true;
  }
  return false;
}

/**
 * Merges multiple extracted file texts into a single coherent question set.
 *
 * @param {Array<{ name: string, text: string }>} files - Array of files with name and extracted text
 * @returns {Object} { text, message, details }
 */
export function mergeFiles(files) {
  if (!files || !files.length) {
    return { text: '', message: '', details: {} };
  }

  if (files.length === 1) {
    return { text: files[0].text, message: '', details: { single: true } };
  }

  // Case 1: Exactly 2 files
  if (files.length === 2) {
    const f1 = files[0];
    const f2 = files[1];

    // Check if one is an answer key file
    const f1IsKey = isAnswerKeyText(f1.text, f1.name);
    const f2IsKey = isAnswerKeyText(f2.text, f2.name);

    if (f1IsKey && !f2IsKey) {
      // f1 is key, f2 is questions
      return {
        text: `${f2.text}\n\n\nAnswer Key\n${f1.text}`,
        message: 'تم دمج ملف الأسئلة مع مفتاح الإجابات من الملف الأول تلقائيًا ✓',
        details: { keyMerged: true }
      };
    }

    if (f2IsKey && !f1IsKey) {
      // f2 is key, f1 is questions
      return {
        text: `${f1.text}\n\n\nAnswer Key\n${f2.text}`,
        message: 'تم دمج ملف الأسئلة مع مفتاح الإجابات من الملف الثاني تلقائيًا ✓',
        details: { keyMerged: true }
      };
    }

    // Parse both to inspect question stems
    const p1 = parse(f1.text);
    const p2 = parse(f2.text);

    const qs1 = p1.sections.flatMap(s => s.qs);
    const qs2 = p2.sections.flatMap(s => s.qs);

    if (qs1.length > 0 && qs2.length > 0) {
      // Check stem similarity
      let matches = 0;
      const minLen = Math.min(qs1.length, qs2.length);
      const maxLen = Math.max(qs1.length, qs2.length);

      for (let i = 0; i < minLen; i++) {
        const s1 = normStem(qs1[i].stem);
        const s2 = normStem(qs2[i].stem);
        if (s1 && s2 && (s1 === s2 || s1.includes(s2) || s2.includes(s1))) {
          matches++;
        }
      }

      const matchRatio = matches / maxLen;

      if (matchRatio >= 0.7) {
        // Same questions in both files! One is likely Qs and the other is As
        const ansCount1 = qs1.filter(q => q.ans != null).length;
        const ansCount2 = qs2.filter(q => q.ans != null).length;

        const baseFile = ansCount1 >= ansCount2 ? f1 : f2;
        const otherFile = ansCount1 >= ansCount2 ? f2 : f1;

        return {
          text: baseFile.text,
          message: 'لقيت إن الملفين نفس الأسئلة، واخدت الإجابات من الملف التاني ✓',
          details: { deduped: true, answeredFile: baseFile.name }
        };
      }
    }
  }

  // Case 2: Multiple files / Multiple subjects
  const mergedSections = [];
  const messages = [];

  files.forEach(f => {
    const parsed = parse(f.text);
    const cleanSubName = cleanFileName(f.name) || 'مادة';

    // If file has no explicit section headings, add one based on file name
    if (parsed.sections.length === 1 && !parsed.sections[0].name) {
      mergedSections.push(`# ${cleanSubName}\n\n${f.text}`);
    } else {
      mergedSections.push(f.text);
    }
  });

  return {
    text: mergedSections.join('\n\n\n'),
    message: `تم دمج ${files.length} ملفات بالترتيب المعروض ✓`,
    details: { count: files.length }
  };
}
