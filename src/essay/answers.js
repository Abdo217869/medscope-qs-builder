// src/essay/answers.js - Model Answers Extraction, Partitioning, and Smart Sub-part Mapping
import { isTableLine, parseTableBlock } from './tables.js';
import { LET } from '../parser.js';

export const RE_ANSWER_KEY_HEADING = /^(?:part\s*\d+\s*[:\-]\s*)?(?:answer\s*keys?|answers?|model\s*answers?|marking\s*schemes?|مفتاح\s*الإجابة|الإجابات|الاجابات|نموذج\s*الإجابة)\b/i;

/**
 * Splits document text into questions text and answer-key text if an answer key section exists.
 */
export function splitAnswerKeySection(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let keyIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (RE_ANSWER_KEY_HEADING.test(l)) {
      // Ensure it's not just a single answer line like "Answer: b"
      if (!/[:=]\s*\(?[A-Ha-hأ-ي]\)?\s*$/.test(l)) {
        keyIndex = i;
        break;
      }
    }
  }

  if (keyIndex >= 0) {
    return {
      hasKey: true,
      questionsText: lines.slice(0, keyIndex).join('\n'),
      keyText: lines.slice(keyIndex).join('\n')
    };
  }

  return {
    hasKey: false,
    questionsText: text,
    keyText: ''
  };
}

/**
 * Normalizes question label / key for robust matching:
 * "Q1.3", "Q 1.3", "Question 1.3", "1.3" -> "1.3"
 * "Q2", "2-", "Question 2" -> "2"
 */
export function normalizeKey(label) {
  if (!label) return '';
  const clean = String(label).trim().replace(/^q(?:uestion)?\s*/i, '').replace(/[:.\-)]+$/, '');
  const m = clean.match(/\d+(?:\.\d+)?/);
  return m ? m[0] : clean.toLowerCase();
}

/**
 * Parses raw answer key text into an array of answer objects:
 * [ { label: 'Q1.3', key: '1.3', section: 'Part 1', rawText: '...', tableBlock, bullets: [] } ]
 */
export function parseAnswerKeyText(keyText) {
  if (!keyText) return [];
  const lines = String(keyText).replace(/\r/g, '').split('\n');
  const answers = [];

  let currentSection = '';
  let currentAns = null;
  let tableLines = [];

  const flushCurrent = () => {
    if (!currentAns) return;
    if (tableLines.length > 0) {
      currentAns.tableBlock = parseTableBlock(tableLines);
      tableLines = [];
    }
    answers.push(currentAns);
    currentAns = null;
  };

  const RE_ANS_Q = /^(?:answers?\s+to\s+)?(?:q(?:uestion)?\s*[:.\-]?\s*)?(\d+(?:\.\d+)?)\b[:.\-]?\s*(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check section header inside answer key e.g. "Answers to Part 1: Prevention and Screening"
    if (/^(?:answers?\s+to\s+)?(?:part|section|chapter)\s*\d+/i.test(trimmed)) {
      currentSection = trimmed.replace(/^answers?\s+to\s+/i, '');
      continue;
    }

    // Check Question Answer Start e.g. "Q1.1 a) ...", "Q1.3", "Q2.1 (5 marks)..."
    const qMatch = trimmed.match(/^(?:Q(?:uestion)?\s*)?(\d+(?:\.\d+)?)\b[:.\-]?\s*(.*)$/i);
    // Guard against bullet numbers inside text or decimal values
    const isQuestionHeading = qMatch && (
      trimmed.startsWith('Q') ||
      trimmed.startsWith('q') ||
      /^\d+(?:\.\d+)?\b[:.\-]/.test(trimmed)
    );

    if (isQuestionHeading) {
      flushCurrent();
      const rawNum = qMatch[1];
      const rest = qMatch[2];
      currentAns = {
        label: `Q${rawNum}`,
        key: rawNum,
        section: currentSection,
        rawText: rest,
        lines: rest ? [rest] : [],
        bullets: [],
        tableBlock: null
      };
      continue;
    }

    if (!currentAns) continue;

    // Check table line
    if (isTableLine(trimmed)) {
      tableLines.push(trimmed);
      continue;
    } else if (tableLines.length > 0) {
      // Table ended
      currentAns.tableBlock = parseTableBlock(tableLines);
      tableLines = [];
    }

    // Check bullet line
    if (/^[-•*]\s+(.*)$/.test(trimmed)) {
      const bText = trimmed.replace(/^[-•*]\s+/, '').trim();
      currentAns.bullets.push(bText);
      currentAns.lines.push(bText);
    } else {
      currentAns.lines.push(trimmed);
      if (currentAns.rawText) {
        currentAns.rawText += ' ' + trimmed;
      } else {
        currentAns.rawText = trimmed;
      }
    }
  }

  flushCurrent();
  return answers;
}

/**
 * Splits a single paragraph with run-in labels like:
 * "a) Secondary prevention (...). b) Primary: specific protection (...). c) ..."
 * using the expected-next-label guard.
 * Returns Map of label -> text.
 */
export function splitRunInAnswers(text, expectedCount = 6) {
  const result = new Map();
  if (!text) return result;

  // Expected labels: a, b, c, d, e, f, g, h
  let currentExpectedIndex = 0; // expecting 'a'
  const textLen = text.length;

  // Regex to find potential label markers: e.g. "a)" or "b)" or "(a)"
  // Must be preceded by space or start of text, and followed by capital letter or digit
  const re = /(?:^|\s+)(?:\(([a-hA-H])\)|([a-hA-H])\))\s+(?=[A-Z0-9\u0621-\u064A])/g;
  let match;
  const splits = [];

  while ((match = re.exec(text)) !== null) {
    const letter = (match[1] || match[2]).toLowerCase();
    const expectedLetter = LET[currentExpectedIndex];

    if (letter === expectedLetter) {
      splits.push({
        letter,
        index: match.index + (match[0].length - match[0].trimStart().length)
      });
      currentExpectedIndex++;
    }
  }

  if (splits.length >= 2) {
    for (let i = 0; i < splits.length; i++) {
      const current = splits[i];
      const next = splits[i + 1];
      const start = current.index;
      const end = next ? next.index : textLen;
      // Strip label from text
      const chunk = text.slice(start, end).replace(/^(?:\([a-hA-H]\)|[a-hA-H]\))\s*/, '').trim();
      result.set(current.letter, chunk);
    }
  }

  return result;
}

/**
 * Maps parsed answers to sections and questions.
 */
export function matchAnswersToQuestions(sections, parsedAnswers) {
  if (!Array.isArray(sections) || !Array.isArray(parsedAnswers)) return 0;
  let matchedCount = 0;

  // Build answer lookup map by normalized key
  const ansMap = new Map();
  parsedAnswers.forEach(ans => {
    ansMap.set(ans.key, ans);
  });

  sections.forEach(sec => {
    (sec.qs || []).forEach(q => {
      const ansObj = ansMap.get(q.key);
      if (!ansObj) return;

      matchedCount++;
      const fullText = ansObj.lines.join('\n').trim();

      // Case 1: Question is MCQ and answer specifies single letter e.g. "b) Measles" or "b"
      if (q.type === 'mcq') {
        const letterM = fullText.match(/^(?:ans(?:wer)?\s*[:=\-]?\s*)?([a-hA-H])\b/i);
        if (letterM) {
          const l = letterM[1].toLowerCase();
          const idx = LET.indexOf(l);
          if (idx >= 0 && idx < q.opts.length) {
            q.ans = idx;
          }
        }
        q.answer = fullText;
        return;
      }

      // Case 2: Question has sub-parts (e.g. Q1.1, Q1.2, Q1.3)
      if (Array.isArray(q.parts) && q.parts.length > 0) {
        // Strategy A: Run-in text split (like Q1.1 and Q1.2)
        const runInMap = splitRunInAnswers(fullText, q.parts.length);
        if (runInMap.size >= 2) {
          q.parts.forEach((part, pi) => {
            const letter = (part.label || LET[pi]).toLowerCase();
            if (runInMap.has(letter)) {
              part.answer = runInMap.get(letter);
            }
          });
          q.answer = fullText;
          return;
        }

        // Strategy B: Table + Bullets (exact match for Q1.3)
        // If answer starts with a table and has (parts.length - 1) bullets:
        if (ansObj.tableBlock && ansObj.bullets.length === q.parts.length - 1) {
          // First part gets table
          q.parts[0].answer = [ansObj.tableBlock];
          // Remaining parts get bullets in order
          for (let bi = 0; bi < ansObj.bullets.length; bi++) {
            q.parts[bi + 1].answer = ansObj.bullets[bi];
          }
          q.answer = [ansObj.tableBlock, ...ansObj.bullets];
          return;
        }

        // Strategy C: Unlabeled bullets (N bullets = N parts)
        if (ansObj.bullets.length === q.parts.length) {
          q.parts.forEach((part, pi) => {
            part.answer = ansObj.bullets[pi];
          });
          q.answer = ansObj.bullets.join('\n\n');
          return;
        }

        // Fallback: Attach full text to question-level answer
        q.answer = fullText;
        return;
      }

      // Case 3: Question has no sub-parts (e.g. Q2.1, Q2.2, Q2.3, Q2.5)
      q.answer = fullText;
    });
  });

  return matchedCount;
}
