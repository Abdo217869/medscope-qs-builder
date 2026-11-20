// src/problems.js - Problems Panel, Inline Fixes, and Bento Grid Report Card

import { state } from './state.js';
import { LET } from './parser.js';

/**
 * Escapes HTML characters safely
 */
function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalizes question stem for duplicate comparison
 */
function normStem(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '').trim();
}

/**
 * Scans the current parsed state for all potential problems
 */
export function getProblemsData() {
  const sections = state.data?.sections || [];
  const allQs = sections.flatMap((sec, sIdx) =>
    sec.qs.map((q, qIdx) => ({ q, sIdx, qIdx, secName: sec.name }))
  );

  const totalQs = allQs.length;
  const noAns = allQs.filter(item => item.q.ans === null);
  const multiAns = allQs.filter(item => item.q.hasMultipleAnswers || (item.q.markedAnswers && item.q.markedAnswers.length > 1));
  const singleOpt = allQs.filter(item => item.q.opts.length === 1 || item.q.singleOption);

  // Also check skipped list for single option stems
  const skippedList = state.data?.skippedList || [];
  const skippedSingle = skippedList.filter(s => typeof s === 'object' && s.singleOption);

  // Duplicates detection
  const duplicates = [];
  const seenStems = new Map();
  allQs.forEach(item => {
    const key = normStem(item.q.stem);
    if (key.length >= 15) {
      if (seenStems.has(key)) {
        duplicates.push({ qItem: item, original: seenStems.get(key) });
      } else {
        seenStems.set(key, item);
      }
    }
  });

  // Letter distribution (A, B, C, D)
  const answered = allQs.filter(item => item.q.ans !== null);
  const dist = [0, 0, 0, 0];
  answered.forEach(item => {
    if (item.q.ans >= 0 && item.q.ans < 4) dist[item.q.ans]++;
  });

  let skewedLetter = null;
  let skewedPct = 0;
  if (answered.length >= 8) {
    dist.forEach((count, idx) => {
      const pct = Math.round((count / answered.length) * 100);
      if (pct > 50) {
        skewedLetter = LET[idx].toUpperCase();
        skewedPct = pct;
      }
    });
  }

  const unplacedLines = state.data?.unplacedLines || [];
  const totalProblemsCount = noAns.length + multiAns.length + singleOpt.length + skippedSingle.length + duplicates.length + unplacedLines.length;

  return {
    totalQs,
    sections,
    sectionsCount: sections.length,
    answeredCount: answered.length,
    dist,
    noAns,
    multiAns,
    singleOpt,
    skippedSingle,
    duplicates,
    skewedLetter,
    skewedPct,
    unplacedLines,
    totalProblemsCount
  };
}

/**
 * Subject color palette for bento chips
 */
const SUBJECT_COLORS = [
  '#ccff00', '#10b981', '#06b6d4', '#8b5cf6',
  '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6'
];

/**
 * Renders the Bento Grid summary report card (Obsidian & Lime Spec Section 3)
 */
export function renderReportCardHTML(fileCount = null, mergeMessage = '', currentFilesList = []) {
  const problems = getProblemsData();
  const sections = problems.sections || [];
  const totalQs = problems.totalQs;
  const answeredCount = problems.answeredCount;
  const dist = problems.dist || [0, 0, 0, 0];
  const maxDist = Math.max(...dist, 1);

  const allAnswered = totalQs > 0 && problems.noAns.length === 0;
  const needAnsCount = problems.noAns.length;

  // 1. Answer distribution bars HTML
  const distBarsHTML = ['A', 'B', 'C', 'D'].map((letter, idx) => {
    const count = dist[idx] || 0;
    const pct = totalQs > 0 ? Math.round((count / Math.max(answeredCount, 1)) * 100) : 0;
    const heightPct = Math.round((count / maxDist) * 100);
    return `
      <div class="bento-dist-col">
        <div class="bento-dist-bar-track">
          <div class="bento-dist-bar-fill" style="height: ${heightPct}%;"></div>
        </div>
        <span class="bento-dist-letter" lang="en">${letter}</span>
        <span class="bento-dist-count">${count} <small>(${pct}%)</small></span>
      </div>
    `;
  }).join('');

  // 2. Subjects list HTML with color swatch chips
  const subjectsHTML = sections.map((sec, idx) => {
    const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
    const name = sec.name || `مادة ${idx + 1}`;
    const count = sec.qs ? sec.qs.length : 0;
    return `
      <div class="bento-subject-row" data-sidx="${idx}" title="اضغط للانتقال للمادة في المحرر">
        <span class="bento-subject-chip" style="background-color: ${color};"></span>
        <span class="bento-subject-name">${escapeHTML(name)}</span>
        <span class="bento-subject-count">${count} س</span>
      </div>
    `;
  }).join('');

  // 3. Files list HTML
  const filesHTML = currentFilesList && currentFilesList.length > 0
    ? currentFilesList.map(f => `
        <div class="bento-file-row">
          <span class="bento-file-icon">📄</span>
          <span class="bento-file-name" title="${escapeHTML(f.name)}">${escapeHTML(f.name)}</span>
          <span class="bento-file-badge ${f.status === 'done' ? 'ok' : ''}">${f.status === 'done' ? 'جاهز ✓' : 'قيد المعالجة'}</span>
        </div>
      `).join('')
    : `<div class="bento-empty-text">تم إدخال الأسئلة عبر اللصق المباشر</div>`;

  return `
    <div class="report-card bento-grid-wrapper">
      <div class="report-header" style="margin-bottom: 1.5rem;">
        <span class="tech-tag" lang="en">BENTO DASHBOARD · STEP 02</span>
        <h2 class="report-badge-check" style="margin: 0.5rem 0 0.25rem;">تقرير المعالجة الذكية وتحليل الأسئلة</h2>
        ${mergeMessage ? `<span class="report-merge-msg">${escapeHTML(mergeMessage)}</span>` : ''}
      </div>

      <div class="bento-grid">
        <!-- Card 1: 2x2 Answer Distribution Bars -->
        <div class="bento-card bento-2x2 glass-card" id="bentoDistCard">
          <div class="bento-card-header">
            <span class="bento-card-title">توزيع الإجابات (A · B · C · D)</span>
            <span class="tech-mono-label" lang="en">DISTRIBUTION</span>
          </div>
          <div class="bento-dist-chart">
            ${distBarsHTML}
          </div>
          ${problems.skewedLetter ? `
            <div class="bento-skew-warning">
              <span>⚠️ تنبيه: حرف <strong>${problems.skewedLetter}</strong> مكرر بنسبة ${problems.skewedPct}% من الإجابات.</span>
            </div>
          ` : `
            <div class="bento-dist-footer">
              <span class="bento-dist-status-text">توزيع الخيارات متوازن وطبيعي ✓</span>
            </div>
          `}
        </div>

        <!-- Card 2: 1x2 Tall Subjects List -->
        <div class="bento-card bento-1x2 glass-card" id="bentoSubjectsCard">
          <div class="bento-card-header">
            <span class="bento-card-title">المواد والأقسام (${problems.sectionsCount})</span>
            <span class="tech-mono-label" lang="en">SUBJECTS</span>
          </div>
          <div class="bento-subjects-list">
            ${subjectsHTML || '<div class="bento-empty-text">لا توجد مواد مقسمة</div>'}
          </div>
        </div>

        <!-- Card 3: Solid Lime Accent Card -->
        <div class="bento-card bento-lime-accent" id="bentoCountCard">
          <div class="bento-lime-inner">
            <span class="bento-lime-tag" lang="en">TOTAL QUESTIONS</span>
            <div class="bento-lime-big-num" id="bentoQCount">${totalQs}</div>
            <div class="bento-lime-status">
              ${allAnswered
                ? `<span>كلهم ليهم إجابة صحيحة ✓</span>`
                : `<span>${needAnsCount} أسئلة محتاجة إجابة ⚠️</span>`
              }
            </div>
          </div>
        </div>

        <!-- Card 4: Files Status Card -->
        <div class="bento-card bento-files glass-card" id="bentoFilesCard">
          <div class="bento-card-header">
            <span class="bento-card-title">الملفات المحمّلة</span>
            <span class="tech-mono-label" lang="en">FILES</span>
          </div>
          <div class="bento-files-list">
            ${filesHTML}
          </div>
        </div>

        <!-- Card 5: Duplicates & Integrity Card -->
        <div class="bento-card bento-dups glass-card" id="bentoDupsCard">
          <div class="bento-card-header">
            <span class="bento-card-title">فحص التكرار والتكامل</span>
            <span class="tech-mono-label" lang="en">INTEGRITY</span>
          </div>
          <div class="bento-dups-content">
            <div class="bento-dup-metric">
              <span class="bento-dup-num ${problems.duplicates.length > 0 ? 'warn' : 'ok'}">
                ${problems.duplicates.length}
              </span>
              <span class="bento-dup-desc">
                ${problems.duplicates.length > 0 ? 'أسئلة مكررة محتملة' : 'لا يوجد تكرار في الأسئلة ✓'}
              </span>
            </div>
            <div class="bento-integrity-line">
              <span>نسبة الإجابات: <strong>${totalQs > 0 ? Math.round((answeredCount / totalQs) * 100) : 0}%</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the interactive Problems Panel with one-click inline fixes (Part B4)
 */
export function renderProblemsPanelHTML() {
  const prob = getProblemsData();

  if (prob.totalQs === 0) {
    return renderZeroQuestionsHTML();
  }

  if (prob.totalProblemsCount === 0 && !prob.skewedLetter) {
    return `
      <div class="problems-box all-clear glass-card">
        <div class="clear-icon">🎉</div>
        <div class="clear-text">
          <h3>ما شاء الله! كل الأسئلة مظبوطة بنسبة 100%</h3>
          <p>جميع الأسئلة محدد لها إجابة صحيحة، ولا توجد أي خيارات ناقصة أو أسئلة مكررة.</p>
        </div>
      </div>
    `;
  }

  let html = `<div class="problems-box glass-card">`;
  html += `
    <div class="problems-header">
      <div class="problems-title">
        <span class="warn-icon">⚠</span>
        <span>ملاحظات محتاجة نظرة منك (${prob.totalProblemsCount})</span>
      </div>
      <span class="problems-hint">الملاحظات دي للتأكيد فقط ومش هتمنعك من تنزيل الـ PDF</span>
    </div>
    <div class="problems-list">
  `;

  // 1. Missing Answers
  if (prob.noAns.length > 0) {
    html += `
      <div class="prob-group">
        <div class="prob-group-title">
          <span>❌ أسئلة مفيهاش إجابة صح (${prob.noAns.length})</span>
          <small>اضغط على الحرف الصح لتحديده مباشرة:</small>
        </div>
        <div class="prob-items">
    `;
    prob.noAns.slice(0, 15).forEach(({ q, sIdx, qIdx }) => {
      html += `
        <div class="prob-row" data-sidx="${sIdx}" data-qidx="${qIdx}">
          <span class="prob-qnum">س ${q.num}:</span>
          <span class="prob-qstem" title="${escapeHTML(q.stem)}">${escapeHTML(q.stem.slice(0, 60))}...</span>
          <div class="prob-actions">
            ${q.opts.map((opt, oIdx) => `
              <button class="btn-fix-ans" data-action="set-ans" data-sidx="${sIdx}" data-qidx="${qIdx}" data-ans="${oIdx}">
                ${LET[oIdx].toUpperCase()}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    });
    if (prob.noAns.length > 15) {
      html += `<div class="prob-more">و ${prob.noAns.length - 15} أسئلة تانية بدون إجابة...</div>`;
    }
    html += `</div></div>`;
  }

  // 2. Multiple Answers
  if (prob.multiAns.length > 0) {
    html += `
      <div class="prob-group">
        <div class="prob-group-title">
          <span>⚠️ أسئلة متعلم فيها أكتر من إجابة (${prob.multiAns.length})</span>
          <small>اختر الإجابة المعتمدة فقط:</small>
        </div>
        <div class="prob-items">
    `;
    prob.multiAns.forEach(({ q, sIdx, qIdx }) => {
      html += `
        <div class="prob-row" data-sidx="${sIdx}" data-qidx="${qIdx}">
          <span class="prob-qnum">س ${q.num}:</span>
          <span class="prob-qstem" title="${escapeHTML(q.stem)}">${escapeHTML(q.stem.slice(0, 60))}...</span>
          <div class="prob-actions">
            ${q.opts.map((opt, oIdx) => `
              <button class="btn-fix-ans ${q.ans === oIdx ? 'selected' : ''}" data-action="set-ans" data-sidx="${sIdx}" data-qidx="${qIdx}" data-ans="${oIdx}">
                ${LET[oIdx].toUpperCase()}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    });
    html += `</div></div>`;
  }

  // 3. Single Option Stems
  if (prob.singleOpt.length > 0) {
    html += `
      <div class="prob-group">
        <div class="prob-group-title">
          <span>⚠️ أسئلة بخيار واحد فقط (${prob.singleOpt.length})</span>
        </div>
        <div class="prob-items">
    `;
    prob.singleOpt.forEach(({ q, sIdx, qIdx }) => {
      html += `
        <div class="prob-row">
          <span class="prob-qnum">س ${q.num}:</span>
          <span class="prob-qstem">${escapeHTML(q.stem.slice(0, 70))}...</span>
          <span class="prob-tag">خيار وحيد</span>
        </div>
      `;
    });
    html += `</div></div>`;
  }

  // 4. Duplicate Stems
  if (prob.duplicates.length > 0) {
    html += `
      <div class="prob-group">
        <div class="prob-group-title">
          <span>🔄 أسئلة مكررة (${prob.duplicates.length})</span>
        </div>
        <div class="prob-items">
    `;
    prob.duplicates.slice(0, 8).forEach(({ qItem, original }) => {
      html += `
        <div class="prob-row">
          <span class="prob-qnum">س ${qItem.q.num} مكرر مع س ${original.q.num}:</span>
          <span class="prob-qstem">${escapeHTML(qItem.q.stem.slice(0, 60))}...</span>
          <button class="btn-delete-dup" data-action="delete-q" data-sidx="${qItem.sIdx}" data-qidx="${qItem.qIdx}">
            حذف المكرر 🗑
          </button>
        </div>
      `;
    });
    html += `</div></div>`;
  }

  html += `</div></div>`;
  return html;
}

/**
 * Empty state when zero questions were found
 */
function renderZeroQuestionsHTML() {
  return `
    <div class="problems-box zero-qs glass-card">
      <div class="zero-icon">🔍</div>
      <h3>مفيش أسئلة واضحة في النص أو الملف</h3>
      <p>تأكد إن الملف فيه ترقيم للأسئلة زي <code>1-</code> أو <code>Q1.</code> وخيارات زي <code>a) b) c) d)</code>.</p>
      <div class="zero-actions">
        <button class="btn neon-pulse-btn" id="btnZeroSample">جرّب أسئلة تجريبية جاهزة</button>
        <button class="btn glass-btn" id="btnZeroManual">كتابة الأسئلة يدويًا</button>
      </div>
    </div>
  `;
}

/**
 * Binds inline fix actions in Problems Panel and Bento Card interactions
 */
export function bindProblemEvents(onStateChanged) {
  const panel = document.querySelector('#problemsPanelContainer');
  if (panel) {
    panel.onclick = (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const sIdx = +btn.dataset.sidx;
      const qIdx = +btn.dataset.qidx;

      if (action === 'set-ans') {
        const ans = +btn.dataset.ans;
        const targetQ = state.data?.sections?.[sIdx]?.qs?.[qIdx];
        if (targetQ) {
          targetQ.ans = ans;
          targetQ.hasMultipleAnswers = false;
          if (onStateChanged) onStateChanged();
        }
      } else if (action === 'delete-q') {
        const sec = state.data?.sections?.[sIdx];
        if (sec && sec.qs) {
          sec.qs.splice(qIdx, 1);
          if (onStateChanged) onStateChanged();
        }
      }
    };
  }

  // Bento Subject click jumps to subject in editor
  const bentoSubjects = document.querySelector('#bentoSubjectsCard');
  if (bentoSubjects) {
    bentoSubjects.onclick = (e) => {
      const row = e.target.closest('.bento-subject-row');
      if (!row) return;
      const sidx = row.dataset.sidx;
      const targetSec = document.querySelector(`.editor-sec[data-sidx="${sidx}"]`);
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        targetSec.classList.add('highlight-flash');
        setTimeout(() => targetSec.classList.remove('highlight-flash'), 1500);
      }
    };
  }
}
