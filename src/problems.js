// src/problems.js - Problems Panel, Inline Fixes, and "What I Found" Report Card

import { state } from './state.js';
import { LET } from './parser.js';

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

  // Letter distribution
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
    sectionsCount: sections.length,
    answeredCount: answered.length,
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
 * Renders the "What I Found" summary report card (Part A6)
 */
export function renderReportCardHTML(fileCount = null, mergeMessage = '') {
  const problems = getProblemsData();
  const fileNotice = fileCount !== null 
    ? `قرينا <strong>${fileCount} ${fileCount === 1 ? 'ملف' : 'ملفات'}</strong> ✓`
    : `تم فحص النصوص المدخلة ✓`;

  const ansSource = state.data?.keyUsed 
    ? ' (من مفتاح الإجابات)' 
    : (problems.answeredCount > 0 ? ' (من الإجابات المحددة في الملف)' : '');

  const hasIssues = problems.totalProblemsCount > 0;

  return `
    <div class="report-card">
      <div class="report-header">
        <span class="report-badge-check">📋 تقرير المعالجة الذكية</span>
        ${mergeMessage ? `<span class="report-merge-msg">${escapeHTML(mergeMessage)}</span>` : ''}
      </div>
      <div class="report-metrics">
        <div class="report-item success">
          <span class="metric-val">${problems.totalQs}</span>
          <span class="metric-label">سؤال تم استخراجه في ${problems.sectionsCount} ${problems.sectionsCount === 1 ? 'مادة' : 'مواد'}</span>
        </div>
        <div class="report-item success">
          <span class="metric-val">${problems.answeredCount}</span>
          <span class="metric-label">سؤال له إجابة صحيحة ${ansSource}</span>
        </div>
        <div class="report-item ${hasIssues ? 'warning' : 'ok'}">
          <span class="metric-val">${problems.totalProblemsCount}</span>
          <span class="metric-label">${hasIssues ? 'ملاحظة تحتاج مراجعتك' : 'كل شيء ممتاز وواضح ✓'}</span>
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
      <div class="problems-box all-clear">
        <div class="clear-icon">🎉</div>
        <div class="clear-text">
          <h3>ما شاء الله! كل الأسئلة مظبوطة بنسبة 100%</h3>
          <p>جميع الأسئلة محدد لها إجابة صحيحة، ولا توجد أي خيارات ناقصة أو أسئلة مكررة.</p>
        </div>
      </div>
    `;
  }

  let html = `<div class="problems-box">`;
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
          <span>⚠️ أسئلة ليها أكتر من إجابة محددة (${prob.multiAns.length})</span>
          <small>اختر الإجابة المعتمدة منها:</small>
        </div>
        <div class="prob-items">
    `;
    prob.multiAns.forEach(({ q, sIdx, qIdx }) => {
      const answers = q.markedAnswers || [q.ans];
      html += `
        <div class="prob-row" data-sidx="${sIdx}" data-qidx="${qIdx}">
          <span class="prob-qnum">س ${q.num}:</span>
          <span class="prob-qstem">${escapeHTML(q.stem.slice(0, 50))}...</span>
          <div class="prob-actions">
            ${answers.map(ansIdx => `
              <button class="btn-fix-ans gold" data-action="set-ans" data-sidx="${sIdx}" data-qidx="${qIdx}" data-ans="${ansIdx}">
                اعتماد ${LET[ansIdx]?.toUpperCase()} فقط
              </button>
            `).join('')}
          </div>
        </div>
      `;
    });
    html += `</div></div>`;
  }

  // 3. Single Option
  if (prob.singleOpt.length > 0 || prob.skippedSingle.length > 0) {
    const singles = [...prob.singleOpt, ...prob.skippedSingle];
    html += `
      <div class="prob-group">
        <div class="prob-group-title">
          <span>📝 أسئلة فيها خيار واحد فقط (${singles.length})</span>
        </div>
        <div class="prob-items">
    `;
    singles.forEach(item => {
      const stem = item.q ? item.q.stem : item.stem;
      const num = item.q ? item.q.num : item.num;
      html += `
        <div class="prob-row">
          <span class="prob-qnum">س ${num || ''}:</span>
          <span class="prob-qstem">${escapeHTML(stem.slice(0, 60))}...</span>
          <span class="prob-note">قد يكون السطر جزءًا من رأس السؤال أو ناقص خيارات</span>
        </div>
      `;
    });
    html += `</div></div>`;
  }

  // 4. Duplicate Questions
  if (prob.duplicates.length > 0) {
    html += `
      <div class="prob-group">
        <div class="prob-group-title">
          <span>🔁 أسئلة مكررة (${prob.duplicates.length})</span>
        </div>
        <div class="prob-items">
    `;
    prob.duplicates.forEach(({ qItem, original }) => {
      html += `
        <div class="prob-row">
          <span class="prob-qnum">س ${qItem.q.num}:</span>
          <span class="prob-qstem">مكرر مع سؤال رقم ${original.q.num} ("${escapeHTML(qItem.q.stem.slice(0, 45))}...")</span>
          <div class="prob-actions">
            <button class="btn-fix-del danger" data-action="del-q" data-sidx="${qItem.sIdx}" data-qidx="${qItem.qIdx}">
              حذف المكرر 🗑
            </button>
          </div>
        </div>
      `;
    });
    html += `</div></div>`;
  }

  // 5. Unplaced lines
  if (prob.unplacedLines.length > 0) {
    html += `
      <div class="prob-group">
        <div class="prob-group-title">
          <span>📄 سطور لم نتمكن من تصنيفها (${prob.unplacedLines.length})</span>
          <small>سطور مستقلة في الملف خارج نطاق الأسئلة:</small>
        </div>
        <div class="prob-items">
    `;
    prob.unplacedLines.slice(0, 5).forEach((line, idx) => {
      html += `
        <div class="prob-row">
          <span class="prob-qstem code">"${escapeHTML(line.slice(0, 70))}"</span>
          <div class="prob-actions">
            <button class="btn-fix-del" data-action="dismiss-unplaced" data-idx="${idx}">
              تجاهل ✕
            </button>
          </div>
        </div>
      `;
    });
    html += `</div></div>`;
  }

  // 6. Skewed Distribution Hint
  if (prob.skewedLetter) {
    html += `
      <div class="prob-hint-bar">
        <span>💡 <strong>ملاحظة إحصائية:</strong> أكثر من ${prob.skewedPct}% من الإجابات حرف <strong>${prob.skewedLetter}</strong>. تأكد إذا كان هذا مقصودًا في نموذج الإجابة.</span>
      </div>
    `;
  }

  html += `
    </div>
  </div>`;
  return html;
}

/**
 * Friendly Zero-Questions Found fallback screen (Part B5)
 */
export function renderZeroQuestionsHTML() {
  return `
    <div class="zero-state-box">
      <div class="zero-icon">😕</div>
      <h3 class="zero-title">ما لقيناش أسئلة في الملف ده</h3>
      <p class="zero-desc">متقلقش! دي أشهر 3 أسباب وطريقة حلها في ثواني:</p>
      
      <div class="zero-reasons">
        <div class="reason-card">
          <span class="reason-num">١</span>
          <div class="reason-content">
            <strong>ملف PDF ممسوح ضوئيًا (صور)</strong>
            <p>لو الـ PDF معمول بالسكانر، جرب ترفع صفحاته كصور (PNG/JPG) عشان نشغل قارئ النصوص الذكي (OCR).</p>
          </div>
        </div>
        
        <div class="reason-card">
          <span class="reason-num">٢</span>
          <div class="reason-content">
            <strong>الخيارات مش بحروف واضحة</strong>
            <p>البرنامج محتاج خيارات مرقمة بـ <code>a)</code> أو <code>A.</code> أو <code>(a)</code> أو <code>أ) ب) ج) د)</code>.</p>
          </div>
        </div>

        <div class="reason-card">
          <span class="reason-num">٣</span>
          <div class="reason-content">
            <strong>ملف Word بصيغة قديمة</strong>
            <p>لو الملف (.doc) افتحه في برنامج Word واحفظه بصيغة حديثة (.docx) وارفعه تاني.</p>
          </div>
        </div>
      </div>

      <div class="zero-actions">
        <button class="btn gold" id="btnZeroSample">جرّب بمثال جاهز 🚀</button>
        <button class="btn" id="btnZeroManual">أضيف الأسئلة بإيدي ✍</button>
      </div>

      <div class="zero-contact">
        لو ملفك محتاج تنسيق خاص أو معقد، ابعته لفريق Medscope Alexandria وهيتم تنسيقه فورًا.
      </div>
    </div>
  `;
}

/**
 * Binds inline fix events for the problems panel
 */
export function bindProblemEvents(onDataChanged) {
  const container = document.querySelector('.problems-box');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === 'set-ans') {
      const sIdx = +btn.dataset.sidx;
      const qIdx = +btn.dataset.qidx;
      const ansIdx = +btn.dataset.ans;

      const sec = state.data?.sections?.[sIdx];
      if (sec && sec.qs?.[qIdx]) {
        sec.qs[qIdx].ans = ansIdx;
        sec.qs[qIdx].hasMultipleAnswers = false;
        sec.qs[qIdx].markedAnswers = [ansIdx];
        if (onDataChanged) onDataChanged();
      }
    } else if (action === 'del-q') {
      const sIdx = +btn.dataset.sidx;
      const qIdx = +btn.dataset.qidx;

      const sec = state.data?.sections?.[sIdx];
      if (sec && sec.qs?.[qIdx]) {
        sec.qs.splice(qIdx, 1);
        if (onDataChanged) onDataChanged();
      }
    } else if (action === 'dismiss-unplaced') {
      const idx = +btn.dataset.idx;
      if (state.data?.unplacedLines) {
        state.data.unplacedLines.splice(idx, 1);
        if (onDataChanged) onDataChanged();
      }
    }
  });
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
