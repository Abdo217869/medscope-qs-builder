// src/editor.js - Question card editor, Essay / MCQ conversion, and serialization

import { LET } from './parser.js';
import { state } from './state.js';
import { esc } from './paper.js';
import { renderStats } from './stats.js';

/**
 * Serializes sections and questions back into standard question text format.
 */
export function serializeQuestions(secs) {
  return secs.map(s => {
    const secHeader = s.name ? `# ${s.name}\n\n` : '';
    const qsText = s.qs.map((q, i) => {
      const isEssay = q.type && q.type !== 'mcq';
      const label = q.label || `${i + 1}-`;
      const marksTag = q.marks ? ` (${q.marks} marks)` : '';

      if (!isEssay && q.opts && q.opts.length > 0) {
        const num = `${i + 1}- `;
        const stem = q.stem;
        const opts = q.opts.map((o, k) => `${LET[k]}) ${o}${q.ans === k ? ' ✓' : ''}`).join('\n');
        const expl = q.expl ? `\nExplanation: ${q.expl}` : '';
        return `${num}${stem}\n${opts}${expl}`;
      }

      // Essay / Case / Mixed serialization
      let partsText = '';
      if (q.parts && q.parts.length > 0) {
        partsText = '\n' + q.parts.map(p => {
          const pMarks = p.marks ? ` (${p.marks} marks)` : '';
          return `- ${p.label}) ${p.text}${pMarks}`;
        }).join('\n');
      }

      return `${label} ${q.stem}${marksTag}${partsText}`;
    }).join('\n\n');
    return `${secHeader}${qsText}`;
  }).join('\n\n\n');
}

/**
 * Serializes document including question texts and any matched model answers at end
 */
export function serializeFullDocument(secs) {
  const qsDoc = serializeQuestions(secs);
  const answers = [];
  secs.forEach(s => {
    s.qs.forEach((q, i) => {
      const label = q.label || `Q${i + 1}`;
      if (q.parts && q.parts.some(p => p.answer)) {
        const partsAns = q.parts.map(p => {
          let ansStr = '';
          if (Array.isArray(p.answer)) {
            ansStr = p.answer.map(x => typeof x === 'object' ? '[جدول]' : x).join(' ');
          } else {
            ansStr = String(p.answer || '');
          }
          return `${p.label}) ${ansStr}`;
        }).join(' ');
        answers.push(`${label} ${partsAns}`);
      } else if (q.answer) {
        let ansStr = '';
        if (Array.isArray(q.answer)) {
          ansStr = q.answer.map(x => typeof x === 'object' ? '[جدول]' : x).join('\n');
        } else {
          ansStr = String(q.answer);
        }
        answers.push(`${label} ${ansStr}`);
      }
    });
  });

  if (answers.length > 0) {
    return `${qsDoc}\n\n\nPart 7: Answer Key\n\n${answers.join('\n\n')}`;
  }
  return qsDoc;
}

export function renderEditorHTML() {
  const sections = state.data.sections;
  if (!sections.length) {
    return `<div class="empty-editor-placeholder">
      <div class="placeholder-icon">✏️</div>
      <h3>مفيش أسئلة لتعديلها</h3>
      <p>الصق الأسئلة أولاً في الخطوة الأولى، وستظهر هنا بطاقات التعديل.</p>
    </div>`;
  }

  let h = `
    <div class="editor-header-bar">
      <div class="editor-bulk-tools">
        <label>تحويل جماعي للنوع:</label>
        <button class="btn sm" id="btnBulkToMCQ">كله اختيار من متعدد</button>
        <button class="btn sm" id="btnBulkToEssay">كله مقالي</button>
      </div>
      <button class="btn gold sm" id="btnSync">💾 حدّث النص من التعديلات</button>
    </div>
  `;

  sections.forEach((s, si) => {
    h += `
      <div class="edit-sec-card">
        <div class="edit-sec-head">
          <span class="sec-label">مادة #${si + 1}:</span>
          <input type="text" class="sec-name-input" data-s="${si}" data-f="name" value="${esc(s.name)}" placeholder="اسم المادة (مثال: Physiology)">
          <button class="btn sm danger" data-act="delsec" data-s="${si}">🗑️ حذف المادة</button>
        </div>
        <div class="sec-qs-list">
    `;

    s.qs.forEach((q, qi) => {
      const isEssay = q.type && q.type !== 'mcq';
      const isNoAns = !isEssay && q.ans == null;
      const labelText = q.label || `سؤال #${qi + 1}`;

      h += `
        <div class="ecard ${isNoAns ? 'noans' : ''} ${isEssay ? 'ecard-essay' : ''}" data-qid="${esc(q.id || '')}">
          <div class="ehead">
            <div class="ehead-left" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="q-badge">${esc(labelText)}${isNoAns ? ' <span class="unanswered-tag">⚠️ حدد الإجابة الصح</span>' : ''}</span>
              
              <select class="ecard-type-select" data-s="${si}" data-q="${qi}" data-f="type">
                <option value="mcq" ${(!q.type || q.type === 'mcq') ? 'selected' : ''}>اختيار من متعدد (MCQ)</option>
                <option value="essay" ${q.type === 'essay' ? 'selected' : ''}>سؤال مقالي (Essay)</option>
                <option value="case" ${q.type === 'case' ? 'selected' : ''}>حالة سريرية (Case)</option>
                <option value="short" ${q.type === 'short' ? 'selected' : ''}>إجابة قصيرة (Short)</option>
                <option value="fill" ${q.type === 'fill' ? 'selected' : ''}>أكمل الفراغات (Fill)</option>
                <option value="tf" ${q.type === 'tf' ? 'selected' : ''}>صح أو خطأ (True/False)</option>
                <option value="match" ${q.type === 'match' ? 'selected' : ''}>توصيل (Match)</option>
                <option value="compare" ${q.type === 'compare' ? 'selected' : ''}>مقارنة (Compare)</option>
                <option value="calc" ${q.type === 'calc' ? 'selected' : ''}>مسألة وحسابات (Calc)</option>
              </select>

              <div class="ecard-marks-wrap" style="display:inline-flex; align-items:center; gap:4px; font-size:12px;">
                <label>الدرجة:</label>
                <input type="number" class="ecard-marks-input" style="width:50px; padding:2px 4px; border-radius:4px; border:1px solid #ccc; font-weight:700;" data-s="${si}" data-q="${qi}" data-f="marks" min="0" max="100" value="${q.marks || 0}">
              </div>
            </div>

            <div class="ecard-actions">
              <button class="btn sm" data-act="up" data-s="${si}" data-q="${qi}" title="نقل لأعلى" ${qi === 0 ? 'disabled' : ''}>↑</button>
              <button class="btn sm" data-act="down" data-s="${si}" data-q="${qi}" title="نقل لأسفل" ${qi === s.qs.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="btn sm danger" data-act="del" data-s="${si}" data-q="${qi}" title="حذف السؤال">🗑️</button>
            </div>
          </div>

          <textarea class="ecard-stem" data-s="${si}" data-q="${qi}" data-f="stem" rows="2" placeholder="نص السؤال...">${esc(q.stem)}</textarea>
      `;

      if (!isEssay) {
        // Classic MCQ Editor
        h += `<div class="ecard-options">`;
        (q.opts || []).forEach((o, oi) => {
          h += `
            <div class="erow">
              <label class="radio-label">
                <input type="radio" name="ans_${si}_${qi}" data-s="${si}" data-q="${qi}" data-f="ans" data-o="${oi}" ${q.ans === oi ? 'checked' : ''}>
                <span class="radio-custom"></span>
              </label>
              <span class="opt-letter">${(LET[oi] || '').toUpperCase()})</span>
              <input type="text" class="opt-text-input" data-s="${si}" data-q="${qi}" data-f="opt" data-o="${oi}" value="${esc(o)}">
            </div>
          `;
        });
        h += `
          </div>
          <div class="erow erow-expl">
            <span class="expl-label">الشرح:</span>
            <input type="text" class="expl-text-input" data-s="${si}" data-q="${qi}" data-f="expl" value="${esc(q.expl || '')}" placeholder="تفسير أو شرح الإجابة (اختياري)...">
          </div>
        `;
      } else {
        // Essay / Case / Mixed Editor
        if (q.parts && q.parts.length > 0) {
          h += `
            <div class="ecard-parts-box" style="margin-top:10px; background:rgba(0,0,0,0.02); padding:10px; border-radius:8px; border:1px solid rgba(0,0,0,0.08);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="font-size:12.5px;">الأجزاء والأسئلة الفرعية (${q.parts.length}):</strong>
                <button class="btn sm" data-act="addpart" data-s="${si}" data-q="${qi}">➕ إضافة جزء فرعي</button>
              </div>
          `;

          q.parts.forEach((p, pi) => {
            let ansText = '';
            if (Array.isArray(p.answer)) {
              ansText = p.answer.map(x => typeof x === 'object' ? '[جدول بيانات]' : x).join('\n');
            } else {
              ansText = String(p.answer || '');
            }

            h += `
              <div class="part-edit-row" style="display:flex; flex-direction:column; gap:4px; padding:6px; background:#fff; border-radius:6px; margin-bottom:6px; border:1px solid #e2e8f0;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="width:24px;">(${esc(p.label)})</strong>
                  <input type="text" class="part-text-input" style="flex:1;" data-s="${si}" data-q="${qi}" data-p="${pi}" data-f="part_text" value="${esc(p.text)}" placeholder="نص الجزء الفرعي...">
                  <input type="number" class="part-marks-input" style="width:45px;" data-s="${si}" data-q="${qi}" data-p="${pi}" data-f="part_marks" value="${p.marks || 0}" min="0" title="الدرجة">
                  <button class="btn sm danger" data-act="delpart" data-s="${si}" data-q="${qi}" data-p="${pi}" title="حذف هذا الجزء">✕</button>
                </div>
                <div style="display:flex; align-items:center; gap:6px; font-size:12px; margin-top:2px;">
                  <span style="color:#64748b; white-space:nowrap;">الإجابة النموذجية:</span>
                  <input type="text" class="part-ans-input" style="flex:1;" data-s="${si}" data-q="${qi}" data-p="${pi}" data-f="part_ans" value="${esc(ansText)}" placeholder="الإجابة النموذجية لهذا الجزء...">
                </div>
              </div>
            `;
          });

          h += `</div>`;
        } else {
          // No parts: direct model answer textarea
          let directAns = '';
          if (Array.isArray(q.answer)) {
            directAns = q.answer.map(x => typeof x === 'object' ? '[جدول]' : x).join('\n');
          } else {
            directAns = String(q.answer || '');
          }

          h += `
            <div style="margin-top:10px;">
              <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">الإجابة النموذجية (Model Answer):</label>
              <textarea class="ecard-direct-ans" data-s="${si}" data-q="${qi}" data-f="direct_ans" rows="3" style="width:100%; border:1px solid #cbd5e1; border-radius:6px; padding:6px;" placeholder="اكتب الإجابة النموذجية هنا...">${esc(directAns)}</textarea>
            </div>
            <div style="margin-top:6px;">
              <button class="btn sm" data-act="addpart" data-s="${si}" data-q="${qi}">➕ تحويل لأجزاء فرعية (a, b, c)</button>
            </div>
          `;
        }
      }

      h += `</div>`;
    });

    h += `
        </div>
      </div>
    `;
  });

  return h;
}

export function bindEditorEvents(onSync, onUpdate, hostEl) {
  const container = hostEl || document.getElementById('view');
  if (!container) return;

  container.oninput = (e) => {
    const t = e.target;
    const s = +t.dataset.s;
    const q = +t.dataset.q;
    const f = t.dataset.f;
    if (!f) return;

    if (f === 'name') {
      if (state.data.sections[s]) {
        state.data.sections[s].name = t.value;
      }
    } else {
      const targetQ = state.data.sections[s]?.qs[q];
      if (!targetQ) return;
      if (f === 'stem') targetQ.stem = t.value;
      else if (f === 'opt') targetQ.opts[+t.dataset.o] = t.value;
      else if (f === 'expl') targetQ.expl = t.value;
      else if (f === 'marks') targetQ.marks = Math.max(0, parseInt(t.value, 10) || 0);
      else if (f === 'direct_ans') targetQ.answer = t.value;
      else if (f === 'part_text') {
        const p = +t.dataset.p;
        if (targetQ.parts?.[p]) targetQ.parts[p].text = t.value;
      } else if (f === 'part_marks') {
        const p = +t.dataset.p;
        if (targetQ.parts?.[p]) targetQ.parts[p].marks = Math.max(0, parseInt(t.value, 10) || 0);
      } else if (f === 'part_ans') {
        const p = +t.dataset.p;
        if (targetQ.parts?.[p]) targetQ.parts[p].answer = t.value;
      }
    }
    renderStats();
  };

  container.onchange = (e) => {
    const t = e.target;
    const s = +t.dataset.s;
    const q = +t.dataset.q;
    const f = t.dataset.f;

    if (f === 'ans') {
      const o = +t.dataset.o;
      if (state.data.sections[s]?.qs[q]) {
        state.data.sections[s].qs[q].ans = o;
        const card = t.closest('.ecard');
        if (card) {
          card.classList.remove('noans');
          const tag = card.querySelector('.unanswered-tag');
          if (tag) tag.remove();
        }
        renderStats();
      }
    } else if (f === 'type') {
      const targetQ = state.data.sections[s]?.qs[q];
      if (!targetQ) return;
      const newType = t.value;

      // Conversion logic:
      if (newType === 'mcq' && targetQ.type !== 'mcq') {
        // Essay -> MCQ: convert parts to options
        if (targetQ.parts && targetQ.parts.length > 0) {
          targetQ.opts = targetQ.parts.map(p => p.text);
          targetQ.parts = [];
        }
        targetQ.type = 'mcq';
      } else if (newType !== 'mcq' && (!targetQ.type || targetQ.type === 'mcq')) {
        // MCQ -> Essay: convert options to sub-parts
        if (targetQ.opts && targetQ.opts.length > 0) {
          targetQ.parts = targetQ.opts.map((optText, idx) => ({
            label: LET[idx] || String.fromCharCode(97 + idx),
            text: optText,
            marks: 0,
            answer: ''
          }));
          targetQ.opts = [];
        }
        targetQ.type = newType;
      } else {
        targetQ.type = newType;
      }

      renderStats();
      onUpdate && onUpdate();
    }
  };

  container.onclick = (e) => {
    const btn = e.target.closest('[data-act], #btnSync, #btnBulkToMCQ, #btnBulkToEssay');
    if (!btn) return;

    if (btn.id === 'btnSync') {
      const serialized = serializeFullDocument(state.data.sections);
      onSync && onSync(serialized);
      return;
    }

    if (btn.id === 'btnBulkToMCQ') {
      state.data.sections.forEach(s => {
        s.qs.forEach(q => {
          if (q.type !== 'mcq' && q.parts && q.parts.length > 0) {
            q.opts = q.parts.map(p => p.text);
            q.parts = [];
          }
          q.type = 'mcq';
        });
      });
      renderStats();
      onUpdate && onUpdate();
      return;
    }

    if (btn.id === 'btnBulkToEssay') {
      state.data.sections.forEach(s => {
        s.qs.forEach(q => {
          if ((!q.type || q.type === 'mcq') && q.opts && q.opts.length > 0) {
            q.parts = q.opts.map((optText, idx) => ({
              label: LET[idx] || String.fromCharCode(97 + idx),
              text: optText,
              marks: 0,
              answer: ''
            }));
            q.opts = [];
          }
          q.type = 'essay';
        });
      });
      renderStats();
      onUpdate && onUpdate();
      return;
    }

    const s = +btn.dataset.s;
    const q = +btn.dataset.q;
    const act = btn.dataset.act;
    const sec = state.data.sections[s];
    if (!sec) return;

    const targetQ = sec.qs[q];

    if (act === 'del') {
      sec.qs.splice(q, 1);
    } else if (act === 'up' && q > 0) {
      [sec.qs[q - 1], sec.qs[q]] = [sec.qs[q], sec.qs[q - 1]];
    } else if (act === 'down' && q < sec.qs.length - 1) {
      [sec.qs[q + 1], sec.qs[q]] = [sec.qs[q], sec.qs[q + 1]];
    } else if (act === 'delsec') {
      state.data.sections.splice(s, 1);
    } else if (act === 'addpart' && targetQ) {
      if (!targetQ.parts) targetQ.parts = [];
      const nextLetter = LET[targetQ.parts.length] || String.fromCharCode(97 + targetQ.parts.length);
      targetQ.parts.push({
        label: nextLetter,
        text: '',
        marks: 0,
        answer: ''
      });
    } else if (act === 'delpart' && targetQ) {
      const p = +btn.dataset.p;
      if (targetQ.parts) {
        targetQ.parts.splice(p, 1);
      }
    }

    state.data.sections = state.data.sections.filter(x => x.qs.length);
    renderStats();
    onUpdate && onUpdate();
  };
}
