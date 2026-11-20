// src/essay/renderEssay.js - Comprehensive Essay & Written Question HTML Renderer
import { esc, isSoft, numLabel } from '../paper.js';
import { renderTableHTML } from './tables.js';

/**
 * Checks whether a question should be rendered as an essay/written question
 * @param {Object} q 
 * @returns {boolean}
 */
export function isEssayQuestion(q) {
  if (!q) return false;
  if (q.type && q.type !== 'mcq') return true;
  if (q.parts && q.parts.length > 0) return true;
  return false;
}

/**
 * Renders the marks badge / tag
 * @param {number} marks 
 * @param {Object} S 
 * @returns {string} HTML
 */
export function renderMarksBadge(marks, S = {}) {
  if (!marks || marks <= 0 || S.essayMarksDisplay === 'none') return '';
  const display = S.essayMarksDisplay || 'bracket';

  if (display === 'parenthesis') {
    return `<span class="essay-marks">(${marks} ${marks === 1 ? 'mark' : 'marks'})</span>`;
  }
  if (display === 'arabic') {
    return `<span class="essay-marks">(${marks} ${marks === 1 ? 'درجة' : 'درجات'})</span>`;
  }
  if (display === 'tag') {
    return `<span class="essay-marks essay-marks-tag">${marks} mks</span>`;
  }
  // Default 'bracket'
  return `<span class="essay-marks">[${marks} ${marks === 1 ? 'mark' : 'marks'}]</span>`;
}

/**
 * Converts blanks in text (______ or [   ]) into styled underline spans
 * @param {string} text 
 * @param {number} width 
 * @returns {string} HTML
 */
export function renderFillBlanks(text, width = 70) {
  const safeText = esc(text);
  // Match 3 or more underscores, dots, or brackets
  return safeText.replace(/_{3,}|\[\s{3,}\]|\.{4,}/g, () => {
    return `<span class="essay-blank-line" style="min-width:${width}px"></span>`;
  });
}

/**
 * Highlights key medical terms and numbers in model answer text
 * @param {string} text 
 * @param {boolean} enable 
 * @returns {string} HTML
 */
export function highlightAnswerText(text, enable = true) {
  if (!text) return '';
  let safe = esc(text);
  if (!enable) return safe;

  // Highlight bold markdown **text**
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<b class="key-term">$1</b>');

  // Highlight common calculation labels e.g. "Sensitivity =", "Specificity =", "PPV =", "TP ="
  safe = safe.replace(/\b(Sensitivity|Specificity|Predictive\s+value\s+positive|Predictive\s+value\s+negative|False\s+negative\s+rate|False\s+positive\s+rate|Accuracy|TP|TN|FP|FN|PPV|NPV)\s*[:=]/gi, '<b class="key-term">$&</b>');

  return safe;
}

/**
 * Renders answer space (lines, box, grid, table) on question sheet
 * @param {Object} spaceConfig 
 * @param {number} marks 
 * @param {Object} S 
 * @returns {string} HTML
 */
export function renderAnswerSpace(spaceConfig = {}, marks = 0, S = {}) {
  const mode = spaceConfig.mode || S.essayAnswerSpace || 'auto';
  if (mode === 'none') return '';

  const style = spaceConfig.style || S.essayLineStyle || 'solid';
  const ratio = +(S.essayLinesPerMark || 2);
  const lineCount = (mode === 'lines' && spaceConfig.lines)
    ? spaceConfig.lines
    : Math.min(15, Math.max(2, (marks > 0 ? marks * ratio : 3)));

  if (mode === 'lines' || mode === 'auto') {
    const lines = Array(lineCount).fill('<div class="answer-line"></div>').join('');
    return `<div class="essay-answer-space essay-space-lines line-style-${style}">${lines}</div>`;
  }

  if (mode === 'box') {
    const height = spaceConfig.height || Math.min(200, Math.max(60, lineCount * 22));
    return `<div class="essay-answer-space essay-space-box" style="height:${height}px"><span class="box-label">Answer space</span></div>`;
  }

  if (mode === 'grid') {
    const height = spaceConfig.height || Math.min(220, Math.max(80, lineCount * 24));
    return `<div class="essay-answer-space essay-space-grid" style="height:${height}px"></div>`;
  }

  return '';
}

/**
 * Renders model answer block (text, table, bullets)
 * @param {*} answerData 
 * @param {Object} S 
 * @returns {string} HTML
 */
export function renderAnswerContent(answerData, S = {}) {
  if (!answerData) return '';

  if (Array.isArray(answerData)) {
    return answerData.map(item => {
      if (typeof item === 'object' && item !== null && item.type === 'table') {
        return renderTableHTML(item);
      }
      return `<p class="model-ans-p">${highlightAnswerText(String(item), S.essayHighlightTerms !== false)}</p>`;
    }).join('');
  }

  if (typeof answerData === 'object' && answerData !== null && answerData.type === 'table') {
    return renderTableHTML(answerData);
  }

  return `<p class="model-ans-p">${highlightAnswerText(String(answerData), S.essayHighlightTerms !== false)}</p>`;
}

/**
 * Renders a single sub-part (e.g. part a, b, c)
 * @param {Object} part 
 * @param {boolean} isAns 
 * @param {Object} S 
 * @param {number} parentMarks 
 * @returns {string} HTML
 */
export function renderSubPart(part, isAns = false, S = {}, parentMarks = 0) {
  const marksBadge = renderMarksBadge(part.marks, S);
  const partText = part.text || '';
  const renderedText = S.essayHighlightTerms !== false ? esc(partText) : esc(partText);

  // If student question sheet: render answer space
  let answerSpaceHTML = '';
  if (!isAns) {
    const partMarks = part.marks || (parentMarks > 0 ? Math.ceil(parentMarks / 4) : 0);
    answerSpaceHTML = renderAnswerSpace(part, partMarks, S);
  }

  // If answer sheet with inline layout: render part answer
  let partAnswerHTML = '';
  if (isAns && S.essayAnswersLayout !== 'keyEnd' && part.answer) {
    partAnswerHTML = `
      <div class="part-model-answer">
        <span class="part-ans-badge">Model answer:</span>
        <div class="part-ans-content">${renderAnswerContent(part.answer, S)}</div>
      </div>
    `;
  }

  return `
    <div class="essay-subpart" data-part="${esc(part.label)}">
      <div class="subpart-header">
        <span class="subpart-bullet">(${esc(part.label)})</span>
        <span class="subpart-text">${renderedText}</span>
        ${marksBadge}
      </div>
      ${answerSpaceHTML}
      ${partAnswerHTML}
    </div>
  `;
}

/**
 * Renders complete Essay / Written Question HTML
 * 
 * @param {Object} q - Question object
 * @param {number} n - Sequential number
 * @param {boolean} isAns - True if rendering Answer sheet
 * @param {Object} S - Settings object
 * @returns {string} HTML string
 */
export function renderEssayQuestionHTML(q, n, isAns = false, S = {}) {
  const soft = isSoft(S);
  const qbStyle = S.qBadgeStyle || (soft ? 'circle-fill' : 'plain');
  const labelText = q.label || numLabel(n, S.numfmt);

  // Question number / label display
  let numDisplay = '';
  if (qbStyle === 'plain' || S.theme === 'classic') {
    numDisplay = `<span class="qn essay-label-plain">${esc(labelText)}</span>`;
  } else if (qbStyle === 'none') {
    numDisplay = '';
  } else if (qbStyle === 'circle-outline') {
    numDisplay = `<span class="qn qn-circle-outline essay-label-badge">${esc(labelText)}</span>`;
  } else if (qbStyle === 'rounded-square') {
    numDisplay = `<span class="qn qn-rounded-square essay-label-badge">${esc(labelText)}</span>`;
  } else {
    // circle-fill default
    numDisplay = `<span class="qn essay-label-badge">${esc(labelText)}</span>`;
  }

  // Marks badge for whole question
  const marksBadge = renderMarksBadge(q.marks, S);

  // Stem rendering (with fill-blank support)
  let stemHTML = '';
  if (q.type === 'fill') {
    stemHTML = renderFillBlanks(q.stem, +(S.essayBlankWidth || 70));
  } else {
    stemHTML = esc(q.stem);
  }

  // Scenario card for case questions
  let stemWrapHTML = '';
  if (q.type === 'case' && S.essayCaseBox !== false) {
    stemWrapHTML = `
      <div class="case-scenario-card">
        <div class="case-badge">Case Scenario</div>
        <div class="case-text">${stemHTML}</div>
      </div>
    `;
  } else {
    stemWrapHTML = `<span class="q-stem essay-stem">${stemHTML}</span>`;
  }

  // True / False checkboxes
  let tfHTML = '';
  if (q.type === 'tf') {
    tfHTML = `
      <div class="tf-options-row">
        <span class="tf-choice"><span class="tf-box"></span> True</span>
        <span class="tf-choice"><span class="tf-box"></span> False</span>
      </div>
    `;
  }

  // Sub-parts rendering
  let partsHTML = '';
  if (q.parts && q.parts.length > 0) {
    partsHTML = `<div class="essay-subparts-list">${q.parts.map(p => renderSubPart(p, isAns, S, q.marks)).join('')}</div>`;
  }

  // Question-level answer space (for questions without sub-parts on question sheet)
  let questionAnswerSpaceHTML = '';
  if (!isAns && (!q.parts || q.parts.length === 0)) {
    questionAnswerSpaceHTML = renderAnswerSpace(q.answerSpace, q.marks, S);
  }

  // Question-level model answer box (on answer sheet when inline layout is selected)
  let modelAnswerHTML = '';
  if (isAns && S.essayAnswersLayout !== 'keyEnd') {
    const hasPartAnswers = q.parts && q.parts.some(p => p.answer);
    // If question has direct answer or parts don't have separate answers
    if (q.answer && (!hasPartAnswers || (q.parts && q.parts.length === 0))) {
      modelAnswerHTML = `
        <div class="essay-model-ans-box">
          <div class="essay-model-ans-header">
            <span class="essay-model-ans-label">Model Answer / الإجابة النموذجية</span>
            ${marksBadge ? `<span class="essay-ans-marks">${marksBadge}</span>` : ''}
          </div>
          <div class="essay-model-ans-content">
            ${renderAnswerContent(q.answer, S)}
          </div>
        </div>
      `;
    }
  }

  // Separator style
  const sepStyle = S.separator || 'dashed';
  const sepClass = `sep-${sepStyle}`;

  return `
    <div class="q q-essay type-${q.type || 'essay'} ${sepClass}" data-qid="${esc(q.id || '')}">
      <div class="qt essay-header-row">
        ${numDisplay}
        ${stemWrapHTML}
        ${marksBadge}
      </div>
      ${tfHTML}
      ${partsHTML}
      ${questionAnswerSpaceHTML}
      ${modelAnswerHTML}
    </div>
  `;
}

/**
 * Breaks a tall essay question into atomic fragments for precise pagination
 * 
 * @param {Object} q 
 * @param {number} n 
 * @param {boolean} isAns 
 * @param {Object} S 
 * @returns {Array<Object>} Array of atomic fragment items
 */
export function splitQuestionIntoFragments(q, n, isAns = false, S = {}) {
  // If question has no parts, return as single unbreakable block
  if (!q.parts || q.parts.length === 0) {
    return [{
      isQuestion: true,
      html: renderEssayQuestionHTML(q, n, isAns, S),
      qid: q.id,
      label: q.label || numLabel(n, S.numfmt)
    }];
  }

  const fragments = [];
  const labelText = q.label || numLabel(n, S.numfmt);
  const soft = isSoft(S);
  const qbStyle = S.qBadgeStyle || (soft ? 'circle-fill' : 'plain');

  let numDisplay = '';
  if (qbStyle === 'plain' || S.theme === 'classic') {
    numDisplay = `<span class="qn essay-label-plain">${esc(labelText)}</span>`;
  } else if (qbStyle === 'none') {
    numDisplay = '';
  } else {
    numDisplay = `<span class="qn essay-label-badge">${esc(labelText)}</span>`;
  }

  const marksBadge = renderMarksBadge(q.marks, S);
  let stemHTML = esc(q.stem);
  if (q.type === 'fill') stemHTML = renderFillBlanks(q.stem, +(S.essayBlankWidth || 70));

  let stemWrapHTML = '';
  if (q.type === 'case' && S.essayCaseBox !== false) {
    stemWrapHTML = `
      <div class="case-scenario-card">
        <div class="case-badge">Case Scenario</div>
        <div class="case-text">${stemHTML}</div>
      </div>
    `;
  } else {
    stemWrapHTML = `<span class="q-stem essay-stem">${stemHTML}</span>`;
  }

  // Fragment 1: Header (number + stem + scenario + marks), must stay with first subpart
  fragments.push({
    isQuestion: true,
    isFragment: true,
    isHeader: true,
    keepWithNext: true, // Never leave header alone at bottom of page!
    qid: q.id,
    label: labelText,
    html: `
      <div class="q q-essay type-${q.type || 'essay'} essay-fragment-header" data-qid="${esc(q.id || '')}">
        <div class="qt essay-header-row">
          ${numDisplay}
          ${stemWrapHTML}
          ${marksBadge}
        </div>
      </div>
    `
  });

  // Fragments 2..N: Each sub-part
  q.parts.forEach((p, idx) => {
    fragments.push({
      isQuestion: true,
      isFragment: true,
      isPart: true,
      qid: q.id,
      label: `${labelText}(${p.label})`,
      partIndex: idx,
      html: `
        <div class="q q-essay type-${q.type || 'essay'} essay-fragment-part" data-qid="${esc(q.id || '')}">
          <div class="essay-subparts-list">
            ${renderSubPart(p, isAns, S, q.marks)}
          </div>
        </div>
      `
    });
  });

  // If overall model answer exists and not mapped to parts
  if (isAns && S.essayAnswersLayout !== 'keyEnd' && q.answer && !q.parts.some(p => p.answer)) {
    fragments.push({
      isQuestion: true,
      isFragment: true,
      isAnswer: true,
      qid: q.id,
      label: `${labelText} [Answer]`,
      html: `
        <div class="q q-essay essay-fragment-answer" data-qid="${esc(q.id || '')}">
          <div class="essay-model-ans-box">
            <div class="essay-model-ans-header">
              <span class="essay-model-ans-label">Model Answer / الإجابة النموذجية</span>
            </div>
            <div class="essay-model-ans-content">
              ${renderAnswerContent(q.answer, S)}
            </div>
          </div>
        </div>
      `
    });
  }

  return fragments;
}
