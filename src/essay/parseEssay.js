// src/essay/parseEssay.js - Unified MCQ and Essay/Written Question Sheet Parser
import { parse as parseMCQ, LET } from '../parser.js';
import { classifyQuestion } from './classify.js';
import { splitAnswerKeySection, parseAnswerKeyText, matchAnswersToQuestions, normalizeKey } from './answers.js';
import { generateQuestionId } from './model.js';
import { isTableLine, parseTableBlock } from './tables.js';

// Regex for Question Headings / Labels:
// Q1.1, Q1.3, Q 1.3, Q1-3, Question 1.3, 1.3-, Case 4:, Scenario 2, س1, السؤال 3
export const RE_ESSAY_Q_START = /^(?:(?:Q(?:uestion)?|س(?:ؤال)?|Case|Scenario|Essay)\s*[:.\-]?\s*)?(\d+(?:\.\d+)?)(?:\s*[:.\-–)]\s*|\s+)(.*)$/i;

// Marks tag e.g. (5 marks), [5], [2 marks], (6 marks), (5 mks), Marks: 5
export const RE_MARKS = /(?:\((\d+(?:\s*\+\s*\d+)?)\s*(?:marks?|mks?|درجات?|درجة)\)|\[(\d+)\s*(?:marks?|mks?)?\]|Marks:\s*(\d+)|(\d+)\s*(?:marks|mks|درجات))\b/i;

// Sub-part bullet: - a) text, a) text, (a) text, a. text
export const RE_SUBPART_LINE = /^(?:[-•*]\s+)?(?:\(([a-hA-H])\)|([a-hA-H])\s*[\).:\-–])\s*(.*)$/;

/**
 * Extracts marks from line text and returns { cleanText, marks }
 */
export function extractMarks(text) {
  let marks = 0;
  const m = text.match(RE_MARKS);
  if (m) {
    const rawNum = m[1] || m[2] || m[3] || m[4];
    if (rawNum.includes('+')) {
      marks = rawNum.split('+').reduce((sum, n) => sum + parseInt(n.trim(), 10), 0);
    } else {
      marks = parseInt(rawNum, 10);
    }
    // Clean marks from text
    const cleanText = text.replace(RE_MARKS, '').replace(/\s{2,}/g, ' ').trim();
    return { cleanText, marks };
  }
  return { cleanText: text, marks: 0 };
}

/**
 * Parses raw text containing either MCQs, Essay questions, or a mixed exam.
 * 
 * @param {string} rawText - Input text
 * @param {string} [keyText] - Optional external answer key text
 * @param {Object} [options]
 * @param {'auto'|'mcq'|'essay'} [options.questionTypeMode='auto'] - Type override
 * @returns {Object} { sections, skipped, skippedList, unplacedLines, keyPairs, keyUsed, instructions, totalMarks }
 */
export function parseDocument(rawText, keyText = '', options = {}) {
  const mode = options.questionTypeMode || 'auto';

  // 1. Check if document has separate Answer Key part at end
  const { hasKey, questionsText, keyText: extractedKeyText } = splitAnswerKeySection(rawText);
  const combinedKeyText = (keyText || '') + (extractedKeyText ? '\n' + extractedKeyText : '');

  // 2. If mode is explicitly 'mcq'
  if (mode === 'mcq') {
    return parseMCQ(questionsText, combinedKeyText);
  }

  // Check if document has hierarchical essay questions like Q1.1, Q1.2:
  const hasHierarchicalEssay = /^Q\d+\.\d+/im.test(questionsText);

  // If in 'auto' mode and NOT explicitly hierarchical essay:
  // Try classic MCQ parser first to preserve full section segmentation and options
  if (mode === 'auto' && !hasHierarchicalEssay) {
    const mcqResult = parseMCQ(questionsText, combinedKeyText);
    const mcqCount = mcqResult.sections ? mcqResult.sections.reduce((sum, s) => sum + s.qs.length, 0) : 0;
    if (mcqCount > 0) {
      return mcqResult;
    }
  }

  // 3. Essay & Mixed Block Parser
  const lines = questionsText
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.trim());

  const sections = [];
  let currentSection = {
    name: '',
    qs: []
  };

  let currentQ = null;
  let currentPart = null;
  let expectedPartIndex = 0; // expecting 'a'
  const instructions = [];
  let isBeforeFirstQuestion = true;
  let totalMarks = 0;

  const flushPart = () => {
    if (currentQ && currentPart) {
      currentQ.parts.push(currentPart);
      currentPart = null;
    }
  };

  const flushQuestion = () => {
    flushPart();
    if (currentQ) {
      // Run classification on completed question
      const classification = classifyQuestion({
        stem: currentQ.stem,
        parts: currentQ.parts,
        options: currentQ.opts,
        label: currentQ.label,
        marks: currentQ.marks,
        correctOption: currentQ.ans
      });

      if (mode === 'essay' && classification.type === 'mcq') {
        currentQ.type = 'essay';
      } else {
        currentQ.type = classification.type;
      }

      // If classified as MCQ and sub-parts exist, convert parts to MCQ options
      if (currentQ.type === 'mcq' && currentQ.parts.length > 0 && currentQ.opts.length === 0) {
        currentQ.opts = currentQ.parts.map(p => p.text);
        currentQ.parts = [];
      }

      // Calculate total marks
      if (currentQ.marks > 0) {
        totalMarks += currentQ.marks;
      }

      currentSection.qs.push(currentQ);
      currentQ = null;
      expectedPartIndex = 0;
    }
  };

  const flushSection = () => {
    flushQuestion();
    if (currentSection.qs.length > 0 || currentSection.name) {
      if (!currentSection.name) {
        currentSection.name = sections.length === 0 ? 'Part 1' : `Part ${sections.length + 1}`;
      }
      sections.push(currentSection);
      currentSection = {
        name: '',
        qs: []
      };
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const lClean = line.replace(/[*✓✔✅]/g, '').trim();
    const words = lClean.split(/\s+/).length;
    let nextNBLine = '';
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j] && lines[j].trim()) {
        nextNBLine = lines[j].trim();
        break;
      }
    }

    // 1. Markdown Headings: "# Physiology", "## Histology", "### Unit 1"
    const isMarkdownHeading = /^#{1,4}\s*(.+)$/.test(lClean);

    // 2. Explicit Keyword Headings:
    // English: part, section, chapter, unit, lesson, topic, lecture, module, subject
    // Arabic: مادة, المادة, قسم, القسم, فصل, الفصل, درس, الدرس, وحدة, الوحدة, محاضرة, المحاضرة, موضوع, الموضوع, باب, الباب
    const isKeywordHeading = /^(?:part|section|chapter|unit|lesson|topic|lecture|module|subject|مادة|المادة|قسم|القسم|فصل|الفصل|درس|الدرس|وحدة|الوحدة|محاضرة|المحاضرة|موضوع|الموضوع|باب|الباب)\s*(?:\d+|[أ-يA-Za-z]+)?(?:\s*[:\-–]\s*|\s+)(.+)$/i.test(lClean) ||
      /^(?:part|section|chapter|unit|lesson|topic|lecture|module|مادة|المادة|قسم|القسم|فصل|الفصل|درس|الدرس|وحدة|الوحدة|محاضرة|المحاضرة|موضوع|الموضوع|باب|الباب)\s+(?:\d+|[أ-يA-Za-z]+)$/i.test(lClean);

    // 3. Standalone Heading followed by or ending in "Qs" or "Questions":
    // e.g. "Physiology Qs" or "Cardiovascular System Questions"
    const isQsHeading = words <= 6 && /^([A-Za-z\u0600-\u06ff][A-Za-z\u0600-\u06ff &,'/-]*?)\s+(?:Qs?|questions?|أسئلة)$/i.test(lClean);
    const isHeadingFollowedByQs = words <= 6 && !/[?]$/.test(lClean) && /^Qs?$/i.test(nextNBLine);

    // 4. Numbered Topic / Lesson Heading:
    // e.g. "1. Levels of Prevention and Natural History" or "2. Screening: Concepts"
    // Followed by Q-numbered question (e.g. Q1, Q1.1, 1., 1-)
    let isNumberedLessonHeading = false;
    const numHeadingMatch = lClean.match(/^\d{1,2}\s*[.)]\s+([A-Za-z\u0600-\u06ff][^?]*)$/);
    if (numHeadingMatch && !lClean.includes('?') && !/^Q\s*\d/i.test(lClean)) {
      const nextIsQ = /^(?:Q\d|س\d|\d{1,2}\s*[-.)])/.test(nextNBLine);
      if (nextIsQ && (nextNBLine.startsWith('1.') || nextNBLine.startsWith('1-') || nextNBLine.startsWith('1)') || /^Q\d/i.test(nextNBLine) || words <= 12)) {
        isNumberedLessonHeading = true;
      }
    }

    if (isMarkdownHeading || isKeywordHeading || isQsHeading || isHeadingFollowedByQs || isNumberedLessonHeading) {
      flushSection();
      let secName = lClean.replace(/^#{1,4}\s*/, '').replace(/\s+Qs?$/i, '').trim();
      if (isNumberedLessonHeading && numHeadingMatch) {
        secName = numHeadingMatch[1].trim();
      }
      currentSection.name = secName;
      continue;
    }

    // Check Instructions before first question (e.g. "Answer ALL questions", "Time: 2 hours")
    if (isBeforeFirstQuestion) {
      if (/^(?:answer\s+all|time\s*[:=]|total\s*[:=]|instructions?\s*[:=]|تعليمات\s*[:=]|أجب\s+عن)/i.test(line)) {
        instructions.push(line);
        continue;
      }
    }

    // Check Question Start:
    // e.g. "Q1.1 Match each...", "Q1.3 A new rapid test...", "Q2.1 (5 marks) Define...", "1- Homeostasis is..."
    const qMatch = line.match(RE_ESSAY_Q_START);
    const isQStart = qMatch && (
      line.startsWith('Q') ||
      line.startsWith('q') ||
      line.startsWith('س') ||
      /^(?:Case|Scenario|Essay)\b/i.test(line) ||
      /^\d+(?:\.\d+)?\s*[-.)–:]\s*[A-Za-z\u0621-\u064A]/.test(line)
    );

    if (isQStart) {
      isBeforeFirstQuestion = false;
      flushQuestion();

      const rawLabel = qMatch[1];
      const rest = qMatch[2] || '';
      const { cleanText, marks } = extractMarks(rest);

      currentQ = {
        id: generateQuestionId(),
        label: `Q${rawLabel}`,
        key: normalizeKey(rawLabel),
        num: parseInt(rawLabel.split('.')[0] || '1', 10),
        stem: cleanText,
        marks,
        parts: [],
        opts: [],
        ans: null,
        expl: '',
        answer: '',
        answerSpace: {
          mode: 'auto',
          lines: marks > 0 ? marks * 2 : 3,
          height: 80,
          style: 'solid'
        }
      };
      expectedPartIndex = 0;
      continue;
    }

    if (!currentQ) continue;

    // Inside a Question: check for Sub-parts (a, b, c, d...)
    const subMatch = line.match(RE_SUBPART_LINE);
    if (subMatch) {
      const letter = (subMatch[1] || subMatch[2]).toLowerCase();
      const expectedLetter = LET[expectedPartIndex];

      // Use expected-next-label guard: only match if it is the expected next letter!
      if (letter === expectedLetter) {
        flushPart();
        const subRest = subMatch[3] || '';
        const { cleanText, marks } = extractMarks(subRest);

        currentPart = {
          label: letter,
          text: cleanText,
          marks: marks || (currentQ.marks && currentQ.parts.length === 0 ? 0 : 0),
          answer: '',
          lines: marks > 0 ? marks * 2 : 2,
          spaceMode: 'auto'
        };
        expectedPartIndex++;
        continue;
      }
    }

    // Inside a Sub-part: continuation text
    if (currentPart) {
      currentPart.text += ' ' + line;
      continue;
    }

    // Inside Question Stem: continuation text or table
    if (currentQ) {
      if (currentQ.stem) {
        currentQ.stem += '\n' + line;
      } else {
        currentQ.stem = line;
      }
    }
  }

  flushSection();

  // 4. Parse and Match Answer Key if available
  if (extractedKeyText || keyText) {
    const parsedAnswers = parseAnswerKeyText(combinedKeyText);
    matchAnswersToQuestions(sections, parsedAnswers);
  }

  return {
    sections,
    skipped: 0,
    skippedList: [],
    unplacedLines: [],
    keyPairs: 0,
    keyUsed: 0,
    instructions,
    totalMarks
  };
}
