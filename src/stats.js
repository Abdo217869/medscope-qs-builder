// stats.js - Question stats, duplicates, and answer distribution chart

import { LET } from './parser.js';
import { state } from './state.js';

export function computeStats() {
  const all = state.data.sections.flatMap(s => s.qs);
  const mcqQs = all.filter(q => !q.type || q.type === 'mcq');
  const essayQs = all.filter(q => q.type && q.type !== 'mcq');
  const noAns = mcqQs.filter(q => q.ans == null).length;
  const dist = [0, 0, 0, 0, 0, 0];

  mcqQs.forEach(q => {
    if (q.ans != null && q.ans < 6) dist[q.ans]++;
  });

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
  const seen = new Map();
  let dups = 0;
  all.forEach(q => {
    const k = norm(q.stem);
    if (seen.has(k)) dups++;
    else seen.set(k, 1);
  });

  const maxCount = Math.max(1, ...dist);
  const activeDist = dist.filter((d, i) => i < 4 || d > 0);
  const isSkewed = mcqQs.length >= 8 && Math.max(...dist) > mcqQs.length * 0.5;

  const totalMarks = state.data.totalMarks || all.reduce((sum, q) => sum + (q.marks || 0), 0);
  const partsCount = all.reduce((sum, q) => sum + (q.parts ? q.parts.length : 0), 0);

  return {
    totalQs: all.length,
    totalSections: state.data.sections.length,
    mcqCount: mcqQs.length,
    essayCount: essayQs.length,
    totalMarks,
    partsCount,
    noAns,
    dups,
    dist,
    activeDist,
    maxCount,
    isSkewed,
    skipped: state.data.skipped,
    keyPairs: state.data.keyPairs,
    keyUsed: state.data.keyUsed
  };
}

export function renderStats() {
  const st = computeStats();

  // Top toolbar stats
  const statsHost = document.getElementById('stats');
  if (statsHost) {
    let h = `<span class="chip ok">${st.totalQs} سؤال</span><span class="chip">${st.totalSections} مادة</span>`;
    if (st.essayCount > 0) {
      h += `<span class="chip info">${st.essayCount} مقالي</span>`;
      if (st.totalMarks > 0) h += `<span class="chip gold">${st.totalMarks} درجة</span>`;
    }
    if (st.noAns) {
      h += `<span class="chip warn">${st.noAns} بدون إجابة</span>`;
    } else if (st.totalQs > 0) {
      h += `<span class="chip ok">كل الأسئلة لها إجابة ✓</span>`;
    }

    if (st.dups > 0) {
      h += `<span class="chip warn">${st.dups} سؤال مكرر</span>`;
    }

    if (st.isSkewed) {
      h += `<span class="chip warn" title="أكثر من 50% من الإجابات نفس الحرف">⚠️ الإجابات متركزة في خيار واحد</span>`;
    }

    if (st.totalQs - st.noAns > 0) {
      const barsHTML = st.activeDist.map((cnt, i) => {
        const height = Math.max(3, Math.round((cnt / st.maxCount) * 26));
        const letter = (LET[i] || '').toUpperCase();
        return `<i style="height:${height}px" title="${letter}: ${cnt} (${Math.round((cnt / (st.totalQs - st.noAns)) * 100)}%)"><b>${letter}</b></i>`;
      }).join('');
      h += `<div class="dist" title="توزيع الإجابات الصحيحة">${barsHTML}</div>`;
    }

    statsHost.innerHTML = h;
  }

  // Sidebar Tab 1 chips
  const chipsHost = document.getElementById('chips');
  if (chipsHost) {
    let c = `<span class="chip ok">${st.totalQs} سؤال</span><span class="chip">${st.totalSections} مادة</span>`;
    if (st.noAns && st.totalQs) {
      c += `<span class="chip warn">${st.noAns} بدون إجابة</span>`;
    }
    if (st.skipped > 0) {
      c += `<span class="chip warn">${st.skipped} كتلة اتجاهلت (أقل من خيارين)</span>`;
    }
    chipsHost.innerHTML = c;
  }

  // Sidebar Tab 2 key chips
  const keyChipsHost = document.getElementById('keychips');
  if (keyChipsHost) {
    let kc = '';
    if (st.keyPairs > 0) {
      kc = `<span class="chip ok">${st.keyPairs} إجابة في المفتاح</span><span class="chip ${st.keyUsed ? 'ok' : 'warn'}">${st.keyUsed} اتطبقت</span>`;
    }
    keyChipsHost.innerHTML = kc;
  }
}
