// parser.js - Pure parsing logic for Medscope Question Sheet Builder

export const LET = 'abcdefgh';

export function normalizeDigits(str) {
  return String(str || '').replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
}

export const ARABIC_OPT_LET = {
  'أ': 'a', 'ا': 'a', 'إ': 'a', 'آ': 'a',
  'ب': 'b',
  'ج': 'c',
  'د': 'd',
  'ه': 'e', 'هـ': 'e',
  'و': 'f',
  'ز': 'g',
  'ح': 'h'
};

export const ARABIC_LET = {
  'أ': 0, 'ا': 0, 'إ': 0, 'آ': 0,
  'ب': 1,
  'ج': 2,
  'د': 3,
  'ه': 4, 'هـ': 4,
  'و': 5,
  'ز': 6,
  'ح': 7
};

export const RE_Q = /^(?:(?:Q(?:uestion)?(?:\s*No\.?)?|س)\s*[:.\-/]?\s*)?(\d{1,4})\s*([-.)–:/])\s*(?!\d)(\S.*)$/i;
export const RE_OPT = /^(?:[-•–*]\s+)?(\*)?(?:\[([A-Ha-hأ-ي])\]|\(?([A-Ha-hأ-ي])\s*[\).:\]/\-–])\s*(\S.*)$/;
export const RE_MARK = /\s*(?:[*✓✔✅]|\((?:correct|true|صح)\)|\[(?:correct|x|صح)\])\s*$/i;
export const RE_ANS = /^(?:answer|ans|correct(?:\s*answer)?|الإجابة|الاجابة|الحل|الجواب)\s*[:=\-]\s*\(?([A-Ha-hأ-ي])\)?/i;
export const RE_EXP = /^(?:explanation|expl?|rationale|تفسير|الشرح)\s*[:\-]\s*(.*)$/i;
export const RE_PAIR = /(\d{1,4})\s*[-–:.)/]\s*\(?([A-Ha-hأ-ي])\)?(?![A-Za-z\d])/g;

/**
 * Parses an answer key string into array of {num, ans, group}
 * Pairs format: 1-B, 2.c, 3)A, 4:D, 1-ب, 2/ج
 */
export function parseKey(text) {
  const out = [];
  let m;
  const t = normalizeDigits(String(text || ''));
  RE_PAIR.lastIndex = 0;
  while ((m = RE_PAIR.exec(t))) {
    const rawLet = m[2];
    const ansIdx = LET.indexOf(rawLet.toLowerCase()) >= 0
      ? LET.indexOf(rawLet.toLowerCase())
      : (ARABIC_LET[rawLet] ?? -1);
    if (ansIdx >= 0) {
      out.push({ num: +m[1], ans: ansIdx });
    }
  }
  let g = 0, prev = 0;
  for (const p of out) {
    if (p.num <= prev) g++;
    p.group = g;
    prev = p.num;
  }
  return out;
}

/**
 * Parses raw question text and optional external key text.
 * Implements Medscope parsing rules + forgiving parser extensions:
 * - Junk line removal (repeated non-question lines 3+ times, page numbers)
 * - Section headings (# Name, Section: Name, Physiology Qs, heading before 'Qs')
 * - Question numbering and wrapped line continuations
 * - Option letters sequential validation (a, b, c... and أ، ب، ج، د)
 * - Correct answer markers (*, ✓, answer line, embedded/external answer keys)
 * - Single option questions kept and flagged
 * - Multiple marked answers detected and flagged
 * - Unplaced lines collected
 */
export function parse(text, keyText) {
  let lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(l => normalizeDigits(l.replace(/[\u00a0\u200e\u200f]/g, ' ')).trim());

  let embeddedKey = '';
  const ki = lines.findIndex(l =>
    /^(answer\s*keys?|answers?|model answers?|مفتاح الإجابة|الإجابات|الاجابات|حل الأسئلة)\b[^?]{0,30}$/i.test(l) &&
    !/[:=]\s*\(?[A-Ha-hأ-ي]\)?\s*$/.test(l)
  );

  if (ki >= 0) {
    const rest = lines.slice(ki + 1).join('\n');
    if (parseKey(rest).length >= 3) {
      embeddedKey = rest;
      lines = lines.slice(0, ki);
    }
  }

  // repeated page headers / footers
  const cnt = new Map();
  lines.forEach(l => {
    if (l) cnt.set(l, (cnt.get(l) || 0) + 1);
  });
  const junk = new Set();
  cnt.forEach((n, l) => {
    if (n >= 3 && l.length > 3 && !/^Qs$/i.test(l) && !RE_Q.test(l) && !RE_OPT.test(l)) {
      junk.add(l);
    }
  });

  lines = lines.filter(
    l => !junk.has(l) && !/^page\s*\d+(\s*of\s*\d+)?$/i.test(l) && !/^\d{1,3}$/.test(l)
  );

  const qPrefix = lines.filter(l => /^Q\s*\d+\s*[.)]/i.test(l)).length >= 3;
  const nextNB = i => {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j]) return lines[j];
    }
    return '';
  };

  const sections = [];
  let sec = null;
  let cur = null;
  let mode = 'stem';
  let skipped = 0;
  const skippedList = [];
  const unplacedLines = [];

  const newSec = name => {
    if (sec && !sec.qs.length && !sec.name) {
      sec.name = name;
      return;
    }
    sec = { name, qs: [] };
    sections.push(sec);
  };

  const flush = () => {
    if (!cur) return;
    if (cur.opts.length >= 2) {
      if (!sec) newSec('');
      sec.qs.push(cur);
    } else {
      skipped++;
      skippedList.push({
        num: cur.num,
        stem: cur.stem,
        opts: cur.opts,
        singleOption: cur.opts.length === 1,
        summary: cur.stem.slice(0, 70)
      });
      unplacedLines.push(cur.stem + (cur.opts.length ? ' (' + cur.opts.join(', ') + ')' : ''));
    }
    cur = null;
  };

  const markOpt = txt => {
    let ok = false;
    let t = txt;
    if (RE_MARK.test(t)) {
      ok = true;
      t = t.replace(RE_MARK, '');
    }
    return { t: t.trim(), ok };
  };

  const addOpt = (letter, txt, star) => {
    const r = markOpt(txt);
    cur.opts.push(r.t);
    const optIdx = cur.opts.length - 1;
    if (r.ok || star) {
      if (cur.ans !== null && cur.ans !== optIdx) {
        cur.hasMultipleAnswers = true;
        if (!cur.markedAnswers) cur.markedAnswers = [cur.ans];
        if (!cur.markedAnswers.includes(optIdx)) cur.markedAnswers.push(optIdx);
      } else {
        cur.ans = optIdx;
      }
    }
    mode = 'opt';
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    let m;

    if (cur && (m = l.match(RE_ANS))) {
      const rawAns = m[1];
      const ansIdx = LET.indexOf(rawAns.toLowerCase()) >= 0
        ? LET.indexOf(rawAns.toLowerCase())
        : (ARABIC_LET[rawAns] ?? null);
      if (ansIdx !== null) {
        if (cur.ans !== null && cur.ans !== ansIdx) {
          cur.hasMultipleAnswers = true;
          if (!cur.markedAnswers) cur.markedAnswers = [cur.ans];
          if (!cur.markedAnswers.includes(ansIdx)) cur.markedAnswers.push(ansIdx);
        } else {
          cur.ans = ansIdx;
        }
      }
      continue;
    }
    if (cur && (m = l.match(RE_EXP))) {
      cur.expl = m[1];
      mode = 'expl';
      continue;
    }

    const lClean = l.replace(/[*✓✔✅]/g, '').trim();
    const nx = nextNB(i);
    const nxClean = nx.replace(/[*✓✔✅]/g, '').trim();
    const words = lClean.split(/\s+/).length;

    // Heading: "# Physiology" or "Section: Physiology" or "مادة: الفسيولوجي"
    if (
      (m = lClean.match(/^#{1,3}\s*(.+)$/)) ||
      (m = lClean.match(/^(?:section|chapter|subject|مادة|قسم)\s*[:\-]\s*(.+)$/i))
    ) {
      flush();
      newSec(m[1].replace(/\s+Qs?$/i, '').trim());
      continue;
    }

    // "Physiology Qs"
    if (
      !RE_OPT.test(lClean) &&
      words <= 6 &&
      (m = lClean.match(/^([A-Za-z\u0600-\u06ff][A-Za-z\u0600-\u06ff &,'/-]*?)\s+Qs?$/i))
    ) {
      flush();
      newSec(m[1].trim());
      continue;
    }

    // heading followed by "Qs"
    if (
      /^Qs$/i.test(nxClean) &&
      words <= 6 &&
      !/[?]$/.test(lClean) &&
      !RE_Q.test(lClean) &&
      !(cur && mode === 'opt' && cur.opts.length < 2)
    ) {
      flush();
      newSec(lClean);
      continue;
    }

    // "3. Criteria for Screening" followed by Q-numbered question
    if (
      (m = lClean.match(/^\d{1,2}\s*[.)]\s+([A-Za-z\u0600-\u06ff][^?]*)$/)) &&
      !/^Q\s*\d/i.test(lClean) &&
      (/^Q\s*\d/i.test(nxClean) || (qPrefix && words <= 14 && !/[.:;,]$/.test(lClean)))
    ) {
      flush();
      newSec(m[1].trim());
      continue;
    }

    if (/^Qs$/i.test(lClean)) continue;

    // Check option match
    let optLetter = null;
    let optTxt = null;
    let optStar = false;
    if ((m = l.match(RE_OPT))) {
      optStar = !!m[1];
      const rawL = m[2] || m[3];
      optLetter = ARABIC_OPT_LET[rawL] ? ARABIC_OPT_LET[rawL] : rawL.toLowerCase();
      optTxt = m[4];
    }

    // option: must match expected sequential letter
    if (cur && optLetter && optLetter === LET[cur.opts.length]) {
      // inline options "a) x b) y c) z" or "أ) س ب) ص"
      if (cur.opts.length === 0) {
        const parts = l.split(/\s+(?=(?:\[[b-hأ-ي]\]|\(?[b-hأ-ي]\s*[\).:\]/\-–]))/i);
        if (parts.length > 1) {
          let ok = true;
          parts.forEach((p, k) => {
            const mm = p.match(RE_OPT);
            if (!mm) {
              ok = false;
              return;
            }
            const raw = mm[2] || mm[3];
            const norm = ARABIC_OPT_LET[raw] ? ARABIC_OPT_LET[raw] : raw.toLowerCase();
            if (norm !== LET[k]) ok = false;
          });
          if (ok) {
            parts.forEach(p => {
              const mm = p.match(RE_OPT);
              const raw = mm[2] || mm[3];
              const norm = ARABIC_OPT_LET[raw] ? ARABIC_OPT_LET[raw] : raw.toLowerCase();
              addOpt(norm, mm[4], !!mm[1]);
            });
            continue;
          }
        }
      }
      addOpt(optLetter, optTxt, optStar);
      continue;
    }

    // question
    if ((m = l.match(RE_Q))) {
      const isHeadingish =
        (cur && mode === 'opt' && cur.opts.length < 2) ||
        (cur && mode === 'stem' && cur.opts.length === 0 && +m[1] !== cur.num + 1);
      if (!isHeadingish) {
        flush();
        cur = { num: +m[1], stem: m[3].trim(), opts: [], ans: null, expl: '' };
        mode = 'stem';
        continue;
      }
    }

    // continuation
    if (cur) {
      if (mode === 'opt' && cur.opts.length) {
        const r = markOpt(l);
        cur.opts[cur.opts.length - 1] = (cur.opts[cur.opts.length - 1] + ' ' + r.t).trim();
        if (r.ok) {
          const optIdx = cur.opts.length - 1;
          if (cur.ans !== null && cur.ans !== optIdx) {
            cur.hasMultipleAnswers = true;
            if (!cur.markedAnswers) cur.markedAnswers = [cur.ans];
            if (!cur.markedAnswers.includes(optIdx)) cur.markedAnswers.push(optIdx);
          } else {
            cur.ans = optIdx;
          }
        }
      } else if (mode === 'expl') {
        cur.expl += ' ' + l;
      } else {
        cur.stem += ' ' + l;
      }
    } else {
      unplacedLines.push(l);
    }
  }

  flush();
  const secs = sections.filter(s => s.qs.length);

  // groups (numbering restarts)
  let g = 0, prev = 0;
  secs.forEach(s =>
    s.qs.forEach(q => {
      if (q.num <= prev) g++;
      q.group = g;
      prev = q.num;
    })
  );

  // apply key
  const keyPairs = parseKey((keyText || '') + '\n' + embeddedKey);
  const all = secs.flatMap(s => s.qs);
  let keyUsed = 0;
  if (keyPairs.length) {
    if (keyPairs.length === all.length) {
      all.forEach((q, i) => {
        q.ans = keyPairs[i].ans;
        keyUsed++;
      });
    } else {
      const byGN = new Map();
      const byN = new Map();
      keyPairs.forEach(p => {
        byGN.set(p.group + ':' + p.num, p.ans);
        byN.set(p.num, p.ans);
      });
      all.forEach(q => {
        const v = byGN.has(q.group + ':' + q.num)
          ? byGN.get(q.group + ':' + q.num)
          : byN.get(q.num);
        if (v !== undefined && v >= 0 && v < q.opts.length) {
          q.ans = v;
          keyUsed++;
        }
      });
    }
  }

  return {
    sections: secs,
    skipped,
    skippedList,
    unplacedLines,
    keyPairs: keyPairs.length,
    keyUsed
  };
}

/**
 * Rich paste: detect red (or bold-marked) answers from Word/HTML clipboard.
 * Uses a sandboxed hidden iframe to compute element styles accurately.
 */
export function richLines(html, boldMode = false) {
  if (typeof document === 'undefined') {
    return { text: '', anyRed: false };
  }
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-9999px;width:800px;height:600px;border:0';
  f.setAttribute('sandbox', 'allow-same-origin');
  document.body.append(f);

  const d = f.contentDocument;
  d.open();
  d.write(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<(img|link|iframe|object|embed)\b[^>]*>/gi, '')
  );
  d.close();

  const out = [];
  let line = '';
  let red = 0;
  let tot = 0;
  let blk = null;
  let anyRed = false;

  const BL = /^(P|DIV|LI|H[1-6]|TR|TD|PRE|BLOCKQUOTE|BODY|UL|OL|TABLE)$/;
  const blockOf = n => {
    let e = n.parentElement;
    while (e && !BL.test(e.tagName)) e = e.parentElement;
    return e;
  };

  const flush = () => {
    const t = line.replace(/\s+/g, ' ').trim();
    if (t) {
      if (tot && red / tot > 0.6) {
        out.push(t + ' ✓');
        anyRed = true;
      } else {
        out.push(t);
      }
    }
    line = '';
    red = 0;
    tot = 0;
  };

  const w = d.createTreeWalker(d.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 1) {
      if (n.tagName === 'BR' || /^(STYLE|SCRIPT|HEAD|TITLE)$/.test(n.tagName)) {
        if (n.tagName === 'BR') flush();
      }
      continue;
    }
    if (n.parentElement && /^(STYLE|SCRIPT|TITLE)$/.test(n.parentElement.tagName)) continue;

    const b = blockOf(n);
    if (b !== blk) {
      flush();
      blk = b;
    }

    const txt = n.nodeValue.replace(/\s+/g, ' ');
    if (!txt.trim()) {
      line += txt;
      continue;
    }

    const cs = f.contentWindow.getComputedStyle(n.parentElement);
    const mm = cs.color.match(/\d+(\.\d+)?/g) || [0, 0, 0];
    const isRed = +mm[0] >= 150 && +mm[1] <= 95 && +mm[2] <= 95;
    const isBold = boldMode && +cs.fontWeight >= 600;
    const len = txt.trim().length;

    line += txt;
    tot += len;
    if (isRed || isBold) red += len;
  }
  flush();
  f.remove();

  return { text: out.join('\n'), anyRed };
}
