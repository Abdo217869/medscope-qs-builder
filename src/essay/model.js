// src/essay/model.js - Schema v2 Question Model, Block Types, and Migration

export const QUESTION_TYPES = [
  'mcq',
  'essay',
  'case',
  'short',
  'fill',
  'tf',
  'match',
  'compare',
  'calc',
  'label'
];

export const QUESTION_TYPE_LABELS = {
  mcq: 'اختيار من متعدد (MCQ)',
  essay: 'سؤال مقالي حر (Essay)',
  case: 'حالة وسيناريو (Case / Scenario)',
  short: 'إجابة قصيرة (Short Answer / Define)',
  fill: 'أكمل الفراغات (Fill in the blanks)',
  tf: 'صح وخطأ مع تعليل (True / False)',
  match: 'توصيل / مطابقة (Matching)',
  compare: 'مقارنة في جدول (Compare)',
  calc: 'مسألة حسابية (Calculation)',
  label: 'رسمة وبيانات (Figure / Diagram)'
};

let idCounter = 1;
export function generateQuestionId() {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}_${idCounter++}`;
}

/**
 * Returns plain text string from stem (whether it is string or Block[])
 */
export function getStemText(q) {
  if (!q) return '';
  if (typeof q.stem === 'string') return q.stem;
  if (Array.isArray(q.stem)) {
    return q.stem.map(b => (typeof b === 'string' ? b : b.text || '')).join('\n');
  }
  return String(q.stem || '');
}

/**
 * Returns plain text from part (whether text or blocks)
 */
export function getPartText(part) {
  if (!part) return '';
  if (typeof part.text === 'string') return part.text;
  if (Array.isArray(part.blocks)) {
    return part.blocks.map(b => (typeof b === 'string' ? b : b.text || '')).join('\n');
  }
  return '';
}

/**
 * Returns plain text from model answer (whether string or Block[])
 */
export function getAnswerText(target) {
  if (!target) return '';
  const ans = target.answer;
  if (typeof ans === 'string') return ans;
  if (Array.isArray(ans)) {
    return ans.map(b => {
      if (typeof b === 'string') return b;
      if (b.type === 'table') {
        return (b.rows || []).map(r => r.join(' | ')).join('\n');
      }
      return b.text || '';
    }).join('\n');
  }
  return '';
}

/**
 * Calculates total marks for a question:
 * If parts have marks, sum of parts marks; otherwise question-level marks.
 */
export function calculateMarks(q) {
  if (!q) return 0;
  if (Array.isArray(q.parts) && q.parts.length > 0) {
    const partsSum = q.parts.reduce((sum, p) => sum + (p.marks || 0), 0);
    if (partsSum > 0) return partsSum;
  }
  return q.marks || 0;
}

/**
 * Checks if a question is an essay/written question
 */
export function isEssayQuestion(q) {
  if (!q) return false;
  return q.type && q.type !== 'mcq';
}

/**
 * Migrates a single question object to Schema v2.
 * Preserves all v1 MCQ fields (opts, ans, expl) without modifying them.
 */
export function migrateQuestion(q, defaultSection = '') {
  if (!q) return null;
  const migrated = { ...q };

  // 1. Ensure unique id
  if (!migrated.id) {
    migrated.id = generateQuestionId();
  }

  // 2. Ensure type (default to 'mcq' if not set)
  if (!migrated.type) {
    migrated.type = 'mcq';
  }

  // 3. Ensure label and key
  if (!migrated.label) {
    migrated.label = migrated.num ? `Q${migrated.num}` : 'Q1';
  }
  if (!migrated.key) {
    const km = migrated.label.match(/\d+(?:\.\d+)?/);
    migrated.key = km ? km[0] : (migrated.num ? String(migrated.num) : '1');
  }

  // 4. Section name
  if (!migrated.section) {
    migrated.section = defaultSection;
  }

  // 5. Parts array
  if (!Array.isArray(migrated.parts)) {
    migrated.parts = [];
  }

  // 6. MCQ fields backward compatibility
  migrated.opts = migrated.opts || migrated.options || [];
  if (migrated.ans === undefined) {
    migrated.ans = null;
  }
  if (migrated.expl === undefined) {
    migrated.expl = '';
  }

  // 7. Answer space settings
  if (!migrated.answerSpace) {
    migrated.answerSpace = {
      mode: 'auto',
      lines: 3,
      height: 80,
      style: 'solid'
    };
  }

  // 8. Model answer blocks
  if (!migrated.answer) {
    migrated.answer = [];
  }

  return migrated;
}

/**
 * Migrates all sections and questions to Schema v2.
 */
export function migrateSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map((sec, si) => {
    const secName = sec.name || `مادة #${si + 1}`;
    return {
      name: secName,
      qs: (sec.qs || []).map(q => migrateQuestion(q, secName))
    };
  });
}
