// editor.js - Question card editor and serialization

import { LET } from './parser.js';
import { state } from './state.js';
import { esc } from './paper.js';
import { renderStats } from './stats.js';

/**
 * Serializes sections and questions back into standard Medscope question format text.
 */
export function serializeQuestions(secs) {
  return secs.map(s => {
    const secHeader = s.name ? `# ${s.name}\n\n` : '';
    const qsText = s.qs.map((q, i) => {
      const num = `${i + 1}- `;
      const stem = q.stem;
      const opts = q.opts.map((o, k) => `${LET[k]}) ${o}${q.ans === k ? ' ✓' : ''}`).join('\n');
      const expl = q.expl ? `\nExplanation: ${q.expl}` : '';
      return `${num}${stem}\n${opts}${expl}`;
    }).join('\n\n');
    return `${secHeader}${qsText}`;
  }).join('\n\n\n');
}

export function renderEditorHTML() {
  const sections = state.data.sections;
  if (!sections.length) {
    return `<div class="empty-editor-placeholder">
      <div class="placeholder-icon">✏️</div>
      <h3>مفيش أسئلة لتعديلها</h3>
      <p>الصق الأسئلة أولاً في التبويب الأيمن، وستظهر هنا بطاقات التعديل.</p>
    </div>`;
  }

  let h = `
    <div class="editor-header-bar">
      <p class="hint">أي تعديل هنا يظهر فورًا في المعاينة والتصدير. اضغط «حدّث النص» لحفظ التعديلات في مربع الأسئلة الرئيسي.</p>
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
      const isNoAns = q.ans == null;
      h += `
        <div class="ecard ${isNoAns ? 'noans' : ''}">
          <div class="ehead">
            <span class="q-badge">سؤال #${qi + 1}${isNoAns ? ' <span class="unanswered-tag">⚠️ حدد الإجابة الصح</span>' : ''}</span>
            <div class="ecard-actions">
              <button class="btn sm" data-act="up" data-s="${si}" data-q="${qi}" title="نقل لأعلى" ${qi === 0 ? 'disabled' : ''}>↑</button>
              <button class="btn sm" data-act="down" data-s="${si}" data-q="${qi}" title="نقل لأسفل" ${qi === s.qs.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="btn sm danger" data-act="del" data-s="${si}" data-q="${qi}" title="حذف السؤال">🗑️</button>
            </div>
          </div>
          <textarea class="ecard-stem" data-s="${si}" data-q="${qi}" data-f="stem" rows="2" placeholder="نص السؤال...">${esc(q.stem)}</textarea>
          <div class="ecard-options">
      `;

      q.opts.forEach((o, oi) => {
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
        </div>
      `;
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
    }
    renderStats();
  };

  container.onchange = (e) => {
    const t = e.target;
    if (t.dataset.f === 'ans') {
      const s = +t.dataset.s;
      const q = +t.dataset.q;
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
    }
  };

  container.onclick = (e) => {
    const btn = e.target.closest('[data-act], #btnSync');
    if (!btn) return;

    if (btn.id === 'btnSync') {
      const serialized = serializeQuestions(state.data.sections);
      onSync && onSync(serialized);
      return;
    }

    const s = +btn.dataset.s;
    const q = +btn.dataset.q;
    const act = btn.dataset.act;
    const sec = state.data.sections[s];
    if (!sec) return;

    if (act === 'del') {
      sec.qs.splice(q, 1);
    } else if (act === 'up' && q > 0) {
      [sec.qs[q - 1], sec.qs[q]] = [sec.qs[q], sec.qs[q - 1]];
    } else if (act === 'down' && q < sec.qs.length - 1) {
      [sec.qs[q + 1], sec.qs[q]] = [sec.qs[q], sec.qs[q + 1]];
    } else if (act === 'delsec') {
      state.data.sections.splice(s, 1);
    }

    state.data.sections = state.data.sections.filter(x => x.qs.length);
    renderStats();
    onUpdate && onUpdate();
  };
}
