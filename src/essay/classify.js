// src/essay/classify.js - Intelligent Question Type Classifier

const IMPERATIVE_WORDS = [
  'calculate', 'construct', 'define', 'describe', 'explain', 'discuss',
  'list', 'name', 'state', 'compare', 'identify', 'outline', 'mention',
  'interpret', 'what', 'why', 'how', 'when', 'which', 'give', 'draw',
  'complete', 'match', 'differentiate', 'classify', 'evaluate', 'justify',
  // Arabic equivalents
  'احسب', 'اذكر', 'عرّف', 'اشرح', 'قارن', 'وضّح', 'ما هي', 'ما هو',
  'لماذا', 'كيف', 'سمّ', 'علل', 'عدّد', 'ميّز', 'فسّر', 'ناقش'
];

/**
 * Classifies a question block into a specific type with confidence score and reasons.
 * 
 * @param {Object} block
 * @param {string} block.stem - Question stem text
 * @param {Array} block.parts - Array of sub-parts (if any)
 * @param {Array} block.options - Array of raw options (if parsed as lettered list)
 * @param {boolean} block.hasAnswerKey - Whether an answer key exists for this question
 * @param {number|null} block.correctOption - Index of marked correct option if any
 * @param {string} block.label - Question label e.g. "Q1.3"
 * @param {number} block.marks - Question marks e.g. 5
 * @returns {{ type: string, confidence: number, reasons: string[] }}
 */
export function classifyQuestion(block) {
  const stem = String(block.stem || '').trim();
  const stemLower = stem.toLowerCase();
  const parts = block.parts || [];
  const options = block.options || [];
  const items = parts.length > 0 ? parts.map(p => p.text || '') : options;
  const reasons = [];

  let essayScore = 0;
  let mcqScore = 0;

  // 1. Check for specific distinct question types first

  // Fill in the blanks: contains ____ or ...... or [   ]
  if (/[_]{3,}|\.{4,}|\[\s{3,}\]|\(\s{3,}\)/.test(stem)) {
    return {
      type: 'fill',
      confidence: 0.95,
      reasons: ['يحتوي على فراغات مكتوبة (____ أو ......)']
    };
  }

  // True or False: "True or false", "صح وخطأ", "صح أم خطأ"
  if (/(?:true\s+or\s+false|true\/false|صح\s*(?:أم|أو|و)\s*خطأ|صواب\s*(?:أم|أو)\s*خطأ)/i.test(stem)) {
    return {
      type: 'tf',
      confidence: 0.95,
      reasons: ['يبدأ بـ True or false أو صح وخطأ']
    };
  }

  // Compare in a table: "compare ... in a table", "قارن بين ... في جدول"
  if (/compare\b.*?\bin a table\b|compare\b/i.test(stemLower) && (stemLower.includes('table') || stemLower.includes('vs'))) {
    return {
      type: 'compare',
      confidence: 0.92,
      reasons: ['طلب مقارنة في جدول (Compare in a table)']
    };
  }

  // Calculation: "calculate", "احسب", formulas, sensitivity/specificity
  if (/^(?:calculate|compute|احسب)\b/i.test(stem) && items.length === 0) {
    return {
      type: 'calc',
      confidence: 0.9,
      reasons: ['مسألة حسابية مباشرة']
    };
  }

  // Matching: "match each ... to" / "طابق بين"
  if (/^match\b|match each\b|وصل بين|طابق بين/i.test(stemLower)) {
    return {
      type: 'match',
      confidence: 0.92,
      reasons: ['سؤال مطابقة وتوصيل (Match each)']
    };
  }

  // 2. Strong MCQ signals
  if (block.correctOption !== null && block.correctOption !== undefined && block.correctOption >= 0) {
    mcqScore += 40;
    reasons.push('يوجد خيار محدد كإجابة صحيحة (✓ أو *)');
  }

  if (/(?:choose the (?:correct|best|most)|اختر الإجابة الصحيحة|اختر البديل)/i.test(stemLower)) {
    mcqScore += 30;
    reasons.push('نص السؤال يبدأ بـ "Choose the correct answer"');
  }

  // 3. Sub-parts vs MCQ Options analysis
  if (items.length > 0) {
    let imperativeCount = 0;
    let fullSentenceCount = 0;
    let totalWords = 0;

    items.forEach(item => {
      const trimmed = String(item).trim();
      const firstWord = (trimmed.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z\u0621-\u064a]/g, '');
      if (IMPERATIVE_WORDS.includes(firstWord)) {
        imperativeCount++;
      }
      if (trimmed.endsWith('?') || (trimmed.endsWith('.') && trimmed.split(/\s+/).length > 6)) {
        fullSentenceCount++;
      }
      totalWords += trimmed.split(/\s+/).filter(Boolean).length;
    });

    const avgWords = totalWords / Math.max(items.length, 1);

    if (imperativeCount >= 1) {
      essayScore += (imperativeCount / items.length) * 50;
      reasons.push(`تبدأ العناصر بأفعال أمر أو أسئلة مثل (${imperativeCount} عناصر)`);
    }

    if (avgWords > 12) {
      essayScore += 25;
      reasons.push(`طول العناصر كبير (${Math.round(avgWords)} كلمة في المتوسط)`);
    } else if (avgWords < 7 && items.length >= 3 && items.length <= 5) {
      mcqScore += 25;
      reasons.push('خيارات قصيرة ومباشرة تناسب الاختيار من متعدد');
    }

    if (items.length > 5) {
      essayScore += 20;
      reasons.push(`عدد العناصر (${items.length}) أكبر من خيارات الاختيار من متعدد المعتادة`);
    }

    if (fullSentenceCount >= 2) {
      essayScore += 20;
      reasons.push('العناصر جمل كاملة أو تنتهي بعلامة استفهام');
    }
  }

  // Hierarchical label e.g. Q1.3
  if (/^q?\d+\.\d+/i.test(block.label || '')) {
    essayScore += 20;
    reasons.push('ترقيم هرمي مركب (مثل Q1.3)');
  }

  // Case scenario detection: stem has numbers and multiple sentences
  if (stem.length > 120 && /\d+/.test(stem) && items.length >= 2) {
    if (/evaluated against|tested positive|gold standard|patient|diagnosed/i.test(stemLower)) {
      return {
        type: 'case',
        confidence: 0.95,
        reasons: ['سيناريو حالة طبية وإحصائية متبوعة بعدة أسئلة فرعية']
      };
    }
  }

  // Marks tag present
  if (block.marks && block.marks > 0) {
    essayScore += 20;
    reasons.push(`محدد له درجات (${block.marks} درجات)`);
  }

  // Evaluate final score
  if (essayScore > mcqScore) {
    let finalType = 'essay';
    if (/^(?:name|define|list|state|mention|اذكر|عرّف|عدّد)\b/i.test(stemLower)) {
      finalType = 'short';
    } else if (items.length >= 3 && stem.length > 80) {
      finalType = 'case';
    }
    return {
      type: finalType,
      confidence: Math.min(0.95, 0.5 + (essayScore - mcqScore) / 100),
      reasons
    };
  }

  return {
    type: 'mcq',
    confidence: Math.min(0.95, 0.5 + (mcqScore - essayScore) / 100),
    reasons
  };
}
