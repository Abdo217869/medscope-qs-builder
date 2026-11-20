// export.js - Exporting to Anki, Quizlet, Moodle GIFT, JSON, and Clean Text

import { LET } from './parser.js';
import { state } from './state.js';
import { esc } from './paper.js';
import { serializeQuestions } from './editor.js';

export function showToast(message) {
  const host = document.getElementById('toastHost') || document.body;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  host.append(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translate(-50%, 10px)';
    t.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    setTimeout(() => t.remove(), 250);
  }, 2000);
}

export function downloadFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob(['\ufeff' + content], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast(`تم تحميل ${filename}`);
}

export function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('تم النسخ للحافظة ✓'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.append(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('تم النسخ للحافظة ✓');
  } catch (e) {
    showToast('تعذر النسخ التلقائي');
  }
  ta.remove();
}

const cleanLine = s => String(s || '').replace(/[\t\r\n]+/g, ' ').trim();

export const EXPORT_HANDLERS = [
  {
    id: 'anki',
    title: 'Anki',
    icon: '📇',
    desc: 'ملف TSV جاهز للاستيراد في Anki: السؤال والخيارات في الواجهة، والإجابة والشرح في الخلف، واسم المادة كـ Tag.',
    actionName: 'تحميل ملف Anki (.txt)',
    run() {
      const rows = ['#separator:tab', '#html:true', '#tags column:3'];
      state.data.sections.forEach(s => {
        const tagName = (s.name || 'Medscope').replace(/\s+/g, '_');
        s.qs.forEach(q => {
          const isEssay = q.type && q.type !== 'mcq';
          if (!isEssay && q.opts && q.opts.length > 0) {
            const front = esc(q.stem) + '<br><br>' + q.opts.map((o, i) => `${(LET[i] || '').toUpperCase()}) ${esc(o)}`).join('<br>');
            const back = q.ans == null
              ? '—'
              : `<b>${(LET[q.ans] || '').toUpperCase()}) ${esc(q.opts[q.ans])}</b>` + (q.expl ? `<br><br><i>${esc(q.expl)}</i>` : '');
            rows.push([front, back, tagName].join('\t'));
          } else {
            // Essay question card
            let front = esc(q.stem);
            if (q.parts && q.parts.length > 0) {
              front += '<br><br>' + q.parts.map(p => `<b>(${esc(p.label)})</b> ${esc(p.text)}`).join('<br>');
            }
            let back = '<b>Model Answer / الإجابة النموذجية:</b><br>';
            if (q.parts && q.parts.some(p => p.answer)) {
              back += q.parts.map(p => {
                const ans = typeof p.answer === 'object' ? JSON.stringify(p.answer) : p.answer;
                return `<b>(${esc(p.label)})</b> ${esc(ans || '—')}`;
              }).join('<br>');
            } else if (q.answer) {
              const ans = typeof q.answer === 'object' ? JSON.stringify(q.answer) : q.answer;
              back += esc(ans);
            } else {
              back += '—';
            }
            rows.push([front, back, tagName].join('\t'));
          }
        });
      });
      downloadFile('medscope-anki.txt', rows.join('\n'));
    }
  },
  {
    id: 'markdown',
    title: 'Markdown (.md)',
    icon: '📝',
    desc: 'تصدير الأسئلة والجداول بصيغة Markdown قياسية جاهزة للفتح في Obsidian أو GitHub أو Notion.',
    actionName: 'تحميل ملف Markdown (.md)',
    run() {
      const lines = [];
      state.data.sections.forEach(s => {
        if (s.name) lines.push(`# ${s.name}\n`);
        s.qs.forEach((q, i) => {
          const label = q.label || `Q${i + 1}`;
          const marks = q.marks ? ` [${q.marks} marks]` : '';
          lines.push(`### ${label}: ${q.stem}${marks}`);
          if (q.opts && q.opts.length > 0) {
            q.opts.forEach((o, oi) => {
              lines.push(`- **${LET[oi]})** ${o}${q.ans === oi ? ' ✓' : ''}`);
            });
          }
          if (q.parts && q.parts.length > 0) {
            q.parts.forEach(p => {
              const pm = p.marks ? ` [${p.marks} marks]` : '';
              lines.push(`- **(${p.label})** ${p.text}${pm}`);
              if (p.answer) lines.push(`  > *Model Answer:* ${typeof p.answer === 'object' ? JSON.stringify(p.answer) : p.answer}`);
            });
          } else if (q.answer) {
            lines.push(`> **Model Answer:** ${typeof q.answer === 'object' ? JSON.stringify(q.answer) : q.answer}`);
          }
          lines.push('');
        });
      });
      downloadFile('medscope-exam.md', lines.join('\n'));
    }
  },
  {
    id: 'quizlet',
    title: 'Quizlet',
    icon: '💡',
    desc: 'صيغة Tab-separated (Term & Definition) للاستيراد السريع في Quizlet.',
    actionName: 'تحميل ملف Quizlet (.txt)',
    run() {
      const rows = [];
      state.data.sections.forEach(s => {
        s.qs.forEach(q => {
          const term = cleanLine(q.stem) + ' ' + (q.opts || []).map((o, i) => `(${LET[i]}) ${cleanLine(o)}`).join(' ');
          const def = q.ans == null ? (q.answer ? cleanLine(q.answer) : '?') : `(${LET[q.ans]}) ${cleanLine(q.opts[q.ans])}`;
          rows.push(`${term}\t${def}`);
        });
      });
      downloadFile('medscope-quizlet.txt', rows.join('\n'));
    }
  },
  {
    id: 'moodle',
    title: 'Moodle GIFT',
    icon: '🎓',
    desc: 'صيغة GIFT الرسمية لاستيراد بنك الأسئلة في منصات Moodle ونظم الامتحانات الإلكترونية.',
    actionName: 'تحميل ملف GIFT (.txt)',
    run() {
      const escapeGift = s => String(s || '').replace(/([~=#{}:])/g, '\\$1');
      const rows = [];
      let n = 0;
      state.data.sections.forEach(s => {
        rows.push(`$CATEGORY: ${s.name || 'Medscope'}\n`);
        s.qs.forEach(q => {
          n++;
          if (q.opts && q.opts.length > 0) {
            const optsText = q.opts.map((o, i) => `${q.ans === i ? '=' : '~'}${escapeGift(o)}`).join('\n');
            rows.push(`::Q${n}::${escapeGift(q.stem)} {\n${optsText}\n}\n`);
          } else {
            rows.push(`::Q${n}::${escapeGift(q.stem)} {}\n`);
          }
        });
      });
      downloadFile('medscope-gift.txt', rows.join('\n'));
    }
  },
  {
    id: 'json',
    title: 'JSON Data (Schema v2)',
    icon: '📦',
    desc: 'تصدير البيانات بصيغة JSON مهيكلة ونظيفة Schema v2، تشمل الأسئلة المقالية والأجزاء والدرجات.',
    actionName: 'تحميل JSON',
    run() {
      const output = {
        schemaVersion: 2,
        generator: 'Medscope Question Sheet Builder',
        exportedAt: new Date().toISOString(),
        sections: state.data.sections.map(s => ({
          section: s.name,
          questions: s.qs.map(q => ({
            id: q.id,
            type: q.type || 'mcq',
            label: q.label,
            marks: q.marks || 0,
            stem: q.stem,
            parts: q.parts || [],
            options: q.opts || [],
            answer: q.ans !== null && q.ans !== undefined ? (LET[q.ans] || q.ans) : q.answer,
            explanation: q.expl || ''
          }))
        }))
      };
      downloadFile('medscope-questions.json', JSON.stringify(output, null, 2), 'application/json');
    }
  },
  {
    id: 'clean_text',
    title: 'نص منظف (للنشر)',
    icon: '📋',
    desc: 'الأسئلة مرتبة ومرقمة بشكل أنيق بدون علامات الإجابة، مناسبة للإرسال على تيليجرام أو النشر.',
    actionName: 'نسخ النص المنظف',
    run() {
      const text = serializeQuestions(state.data.sections).replace(/\s*✓/g, '');
      copyToClipboard(text);
    }
  },
  {
    id: 'text_with_key',
    title: 'نص + مفتاح إجابات بالأسفل',
    icon: '📑',
    desc: 'نص الأسئلة كاملاً بدون إشارات في الخيارات، مع مفتاح الإجابات (Answer Key) مجمّع في نهاية النص.',
    actionName: 'نسخ النص مع المفتاح',
    run() {
      const baseText = serializeQuestions(state.data.sections).replace(/\s*✓/g, '');
      const keyLines = state.data.sections.map(s => {
        const header = s.name ? `${s.name}: ` : '';
        const pairs = s.qs.map((q, i) => `${i + 1}-${q.ans == null ? '?' : (LET[q.ans] || '?').toUpperCase()}`).join(', ');
        return header + pairs;
      }).join('\n');
      copyToClipboard(`${baseText}\n\n\nAnswer Key\n${keyLines}`);
    }
  },
  {
    id: 'text_checked',
    title: 'نص بعلامات ✓ (معتمد)',
    icon: '✅',
    desc: 'نص الأسئلة كاملاً وكل إجابة صحيحة معلمة بعلامة ✓، يمكنك حفظه وإعادة لصقه في الموقع في أي وقت.',
    actionName: 'نسخ النص بعلامات ✓',
    run() {
      const text = serializeQuestions(state.data.sections);
      copyToClipboard(text);
    }
  }
];

export function renderExportHTML() {
  if (!state.data.sections.length) {
    return `<div class="empty-export-placeholder">
      <div class="placeholder-icon">📤</div>
      <h3>مفيش أسئلة للتصدير</h3>
      <p>الصق الأسئلة أولاً في التبويب الأيمن لعرض خيارات التصدير المتنوعة.</p>
    </div>`;
  }

  const cardsHTML = EXPORT_HANDLERS.map((ex, i) => `
    <div class="xcard">
      <div class="xcard-top">
        <span class="xcard-icon">${ex.icon}</span>
        <b>${ex.title}</b>
      </div>
      <p>${ex.desc}</p>
      <button class="btn gold xcard-btn" data-ex="${i}">
        <span>${ex.actionName}</span>
      </button>
    </div>
  `).join('');

  return `<div class="exp-grid">${cardsHTML}</div>`;
}

export function bindExportEvents() {
  const container = document.getElementById('view');
  if (!container) return;

  container.onclick = (e) => {
    const btn = e.target.closest('[data-ex]');
    if (!btn) return;
    const idx = +btn.dataset.ex;
    const handler = EXPORT_HANDLERS[idx];
    if (handler) handler.run();
  };
}
