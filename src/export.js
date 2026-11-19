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
          const front = esc(q.stem) + '<br><br>' + q.opts.map((o, i) => `${(LET[i] || '').toUpperCase()}) ${esc(o)}`).join('<br>');
          const back = q.ans == null
            ? '—'
            : `<b>${(LET[q.ans] || '').toUpperCase()}) ${esc(q.opts[q.ans])}</b>` + (q.expl ? `<br><br><i>${esc(q.expl)}</i>` : '');
          rows.push([front, back, tagName].join('\t'));
        });
      });
      downloadFile('medscope-anki.txt', rows.join('\n'));
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
          const term = cleanLine(q.stem) + ' ' + q.opts.map((o, i) => `(${LET[i]}) ${cleanLine(o)}`).join(' ');
          const def = q.ans == null ? '?' : `(${LET[q.ans]}) ${cleanLine(q.opts[q.ans])}`;
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
          const optsText = q.opts.map((o, i) => `${q.ans === i ? '=' : '~'}${escapeGift(o)}`).join('\n');
          rows.push(`::Q${n}::${escapeGift(q.stem)} {\n${optsText}\n}\n`);
        });
      });
      downloadFile('medscope-gift.txt', rows.join('\n'));
    }
  },
  {
    id: 'json',
    title: 'JSON Data',
    icon: '📦',
    desc: 'تصدير البيانات بصيغة JSON مهيكلة ونظيفة، مفيدة للربط البرمجي أو الحفظ في Supabase.',
    actionName: 'تحميل JSON',
    run() {
      const output = state.data.sections.map(s => ({
        section: s.name,
        questions: s.qs.map(q => ({
          question: q.stem,
          options: q.opts,
          answer: q.ans == null ? null : (LET[q.ans] || null),
          explanation: q.expl || ''
        }))
      }));
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
