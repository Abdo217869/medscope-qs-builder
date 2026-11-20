// paper.js - WYSIWYG paper engine, HTML builders for question & answer sheets

import { LET } from './parser.js';
import { state, getViewData } from './state.js';
import { paginate, MM, getPageDimensions } from './paginate.js';
import { generateQrSvg } from './qrHelper.js';
import { isEssayQuestion, renderEssayQuestionHTML, splitQuestionIntoFragments } from './essay/renderEssay.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[c]));
}

export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 6) {
    const num = parseInt(h, 16);
    if (!isNaN(num)) {
      return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
    }
  }
  return hex;
}

export function isSoft(S = state.settings) {
  return S.theme === 'soft';
}

export function numLabel(n, fmt = state.settings.numfmt) {
  switch (fmt) {
    case '1.': return `${n}.`;
    case '1)': return `${n})`;
    case '1': return `${n}`;
    case 'Q1.': return `Q${n}.`;
    case 'Q1)': return `Q${n})`;
    case '1-':
    default: return `${n}-`;
  }
}

export function letLabel(i, fmt = state.settings.letter) {
  const L = LET[i] || 'a';
  switch (fmt) {
    case 'A.': return `${L.toUpperCase()}.`;
    case '(a)': return `(${L})`;
    case 'A)': return `${L.toUpperCase()})`;
    case 'a)':
    default: return `${L})`;
  }
}

export function paperVars(S = state.settings) {
  const pb = S.tint ? (S.bgColor || '#fffcf3') : '#ffffff';
  let qc = S.qColor || '#122036';
  let ac = S.ansColor || '#c00000';
  let hc = S.headColor || S.qColor || '#122036';
  let hdrc = S.hdrColor || '#64748b';
  let sc = S.stemColor || '#1c2430';
  let oc = S.optColor || '#2b3648';
  let accent = S.accent || '#d4a343';

  if (S.theme === 'minimal') {
    qc = '#111111';
    hc = '#222222';
    sc = '#000000';
    oc = '#1a1a1a';
    accent = '#111111';
  }

  const fStem = S.fontStem || S.font || 'Carlito, Calibri, sans-serif';
  const fOpt = S.fontOpt || S.font || 'Carlito, Calibri, sans-serif';

  const fsStem = S.fsStem || S.fs || 15;
  const fsOpt = S.fsOpt || (S.fs ? S.fs - 0.5 : 14.5);
  const fsHead = S.fsHead || 20;
  const fsHdr = S.fsHdr || 11;

  const lhStem = S.lhStem || 1.45;
  const lhOpt = S.lhOpt || 1.4;

  const gap = +(S.colGap || S.gap || 10);
  const qg = +(S.qgap || 14);
  const optg = +(S.optGap || 6);

  const wo = S.wmOp !== undefined ? S.wmOp : (S.theme === 'minimal' ? 0.12 : 0.16);

  const mTop = (S.marginTop !== undefined ? S.marginTop : (S.margin || 16));
  const mBot = (S.marginBottom !== undefined ? S.marginBottom : (S.margin || 16));
  const mIn = (S.marginInside !== undefined ? S.marginInside : (S.margin || 16));
  const mOut = (S.marginOutside !== undefined ? S.marginOutside : (S.margin || 16));

  let bgPattern = 'none';
  let bgPatternSize = 'auto';
  if (S.bgPattern === 'dots') {
    bgPattern = 'radial-gradient(rgba(0, 0, 0, 0.07) 1px, transparent 1px)';
    bgPatternSize = '14px 14px';
  } else if (S.bgPattern === 'grid') {
    bgPattern = 'linear-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px)';
    bgPatternSize = '18px 18px';
  }

  const frameRad = S.frameRadius !== undefined ? S.frameRadius : 8;
  const hlColor = S.highlightColor || '#fef08a';
  const textAlign = S.textAlign || 'left';
  const hyphens = S.hyphenate !== false ? 'auto' : 'none';

  const qcTint = hexToRgba(qc, 0.08);
  const qcTint12 = hexToRgba(qc, 0.12);
  const qcBorder20 = hexToRgba(qc, 0.20);
  const qcBorder22 = hexToRgba(qc, 0.22);
  const qcBorder25 = hexToRgba(qc, 0.25);
  const qcBorder30 = hexToRgba(qc, 0.30);
  const qcBorder35 = hexToRgba(qc, 0.35);
  const accentTint14 = hexToRgba(accent, 0.14);
  const accentBorder40 = hexToRgba(accent, 0.40);

  return [
    `--pb:${pb}`,
    `--pf:${fStem}`,
    `--pf-stem:${fStem}`,
    `--pf-opt:${fOpt}`,
    `--fs:${fsStem}`,
    `--fs-stem:${fsStem}pt`,
    `--fs-opt:${fsOpt}pt`,
    `--fs-head:${fsHead}pt`,
    `--fs-hdr:${fsHdr}pt`,
    `--lh-stem:${lhStem}`,
    `--lh-opt:${lhOpt}`,
    `--qc:${qc}`,
    `--ac:${ac}`,
    `--hc:${hc}`,
    `--hdrc:${hdrc}`,
    `--sc:${sc}`,
    `--oc:${oc}`,
    `--accent:${accent}`,
    `--fw:${S.stemWeight || (S.bold ? 700 : 400)}`,
    `--gap:${gap}px`,
    `--qg:${qg}px`,
    `--optg:${optg}px`,
    `--wo:${wo}`,
    `--m:${mIn}mm`,
    `--m-t:${mTop}mm`,
    `--m-b:${mBot}mm`,
    `--m-in:${mIn}mm`,
    `--m-out:${mOut}mm`,
    `--bg-pattern:${bgPattern}`,
    `--bg-pattern-size:${bgPatternSize}`,
    `--frame-radius:${frameRad}px`,
    `--hl-c:${hlColor}`,
    `--text-align:${textAlign}`,
    `--hyphens:${hyphens}`,
    `--qc-tint:${qcTint}`,
    `--qc-tint-12:${qcTint12}`,
    `--qc-b-20:${qcBorder20}`,
    `--qc-b-22:${qcBorder22}`,
    `--qc-b-25:${qcBorder25}`,
    `--qc-b-30:${qcBorder30}`,
    `--qc-b-35:${qcBorder35}`,
    `--accent-tint-14:${accentTint14}`,
    `--accent-b-40:${accentBorder40}`
  ].join(';');
}

export function wmHTML(S = state.settings) {
  if (S.wmType === 'none') return '';
  const op = S.wmOp !== undefined ? S.wmOp : (S.theme === 'minimal' ? 0.12 : 0.16);
  const size = S.wmSize || 340;
  const rot = S.wmRot || 0;
  const pos = S.wmPos || 'center';

  let posStyle = `opacity: ${op};`;
  if (pos === 'top') {
    posStyle += ` top: 12%; transform: translateY(-50%) rotate(${rot}deg);`;
  } else if (pos === 'bottom') {
    posStyle += ` top: 88%; transform: translateY(-50%) rotate(${rot}deg);`;
  } else if (pos === 'tile') {
    posStyle += ` transform: rotate(${rot || -25}deg);`;
  } else {
    posStyle += ` transform: rotate(${rot}deg);`;
  }

  let imgSrc = S.wmImg || './medscope-watermark-default.png';
  if (imgSrc === '/medscope-watermark-default.png') {
    imgSrc = './medscope-watermark-default.png';
  }

  if (S.wmType === 'image') {
    return `<div class="wm wm-${pos}" style="${posStyle}"><img src="${esc(imgSrc)}" loading="lazy" style="width:${size}px; height:auto; max-width:85%; display:block;" alt="MEDSCOPE Watermark Logo"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">MEDSCOPE</span></div>`;
  }

  return `<div class="wm wm-${pos}" style="${posStyle}"><b>${esc(S.wmText || 'MEDSCOPE')}</b><em>${esc(S.wmSub || 'Spread your wingS')}</em></div>`;
}

export function qHTML(q, n, isAns, S = state.settings) {
  if (isEssayQuestion(q)) {
    return renderEssayQuestionHTML(q, n, isAns, S);
  }
  const markStyle = S.markStyle || S.mark || 'circle-fill';
  const mkClass = `mk-${markStyle}`;
  const soft = isSoft(S);

  // Question number style
  const qbStyle = S.qBadgeStyle || (soft ? 'circle-fill' : 'plain');
  let numDisplay = '';
  if (qbStyle === 'plain' || S.theme === 'classic') {
    numDisplay = `<span class="qn">${esc(numLabel(n, S.numfmt))}</span>`;
  } else if (qbStyle === 'none') {
    numDisplay = '';
  } else if (qbStyle === 'circle-outline') {
    numDisplay = `<span class="qn qn-circle-outline">${n}</span>`;
  } else if (qbStyle === 'rounded-square') {
    numDisplay = `<span class="qn qn-rounded-square">${n}</span>`;
  } else {
    // circle-fill default
    numDisplay = `<span class="qn">${n}</span>`;
  }

  // Option layout
  let optLayoutClass = 'opts-vertical';
  if (S.optLayout === 'grid2') {
    optLayoutClass = 'opts-grid2';
  } else if (S.optLayout === 'inline') {
    optLayoutClass = 'opts-inline';
  } else if (S.optLayout === 'auto') {
    const allShort = q.opts.every(o => (o || '').length <= 25);
    optLayoutClass = allShort ? 'opts-inline' : 'opts-vertical';
  }

  // Option letter badge style
  const obStyle = S.optBadgeStyle || (soft ? 'circle' : 'plain');

  const optsHTML = q.opts.map((o, i) => {
    const isCorrect = isAns && q.ans === i;
    const optClass = isCorrect ? ` ok ${mkClass}` : '';

    let letterDisplay = '';
    if (obStyle === 'square') {
      letterDisplay = `<span class="ol ol-square">${LET[i]}</span>`;
    } else if (obStyle === 'plain' || S.theme === 'classic') {
      letterDisplay = `<span class="ol">${esc(letLabel(i, S.letter))}</span>`;
    } else {
      letterDisplay = `<span class="ol">${LET[i]}</span>`;
    }

    return `<div class="o${optClass}">${letterDisplay}<span class="ot">${esc(o)}</span></div>`;
  }).join('');

  const explHTML = (isAns && S.showExpl !== false && q.expl)
    ? `<div class="q-expl">${esc(q.expl)}</div>`
    : '';

  // Separator style
  const sepStyle = S.separator || 'dashed';
  const sepClass = `sep-${sepStyle}`;

  return `<div class="q ${sepClass}"><div class="qt">${numDisplay}<span class="q-stem">${esc(q.stem)}</span></div><div class="opts ${optLayoutClass}">${optsHTML}${explHTML}</div></div>`;
}

export function formatTotalQuestions(count, S = {}, secs = []) {
  if (S.coverTotalQsLabel && S.coverTotalQsLabel.trim()) {
    const custom = S.coverTotalQsLabel.trim();
    if (custom.toLowerCase().startsWith('total') || /^\d+/.test(custom)) {
      return custom;
    }
    let label = custom;
    if (count === 1) {
      if (/^mcqs$/i.test(label)) label = 'MCQ';
      else if (/^questions$/i.test(label)) label = 'Question';
    }
    return `Total: ${count} ${label}`;
  }

  const title = ((S.title || '') + ' ' + (S.subtitle || '')).trim();
  const isPractical = /practical/i.test(title);
  const isEssayOrWritten = /written|essay|case/i.test(title) || (secs.length > 0 && secs.every(s => s.qs.every(q => q.type === 'essay')));

  if (isPractical || isEssayOrWritten) {
    return count === 1 ? `Total: 1 Question` : `Total: ${count} Questions`;
  }

  return count === 1 ? `Total: 1 MCQ` : `Total: ${count} MCQs`;
}

export function buildItems(secs, isAns, S = state.settings) {
  const items = [];
  const soft = isSoft(S);

  // 1. Cover Page
  if (S.cover) {
    const coverLayout = S.coverLayout || 'band';
    let logoSrc = S.wmImg || './medscope-watermark-default.png';
    if (logoSrc === '/medscope-watermark-default.png') {
      logoSrc = './medscope-watermark-default.png';
    }
    const logoSize = S.coverLogoSize || 140;
    const logoPos = S.coverLogoPos || 'top';
    const logoShape = S.coverLogoShape || 'original';

    let logoHTML = '';
    if (S.coverLogo !== false) {
      let shapeClass = '';
      if (logoShape === 'circle') shapeClass = 'logo-shape-circle';
      else if (logoShape === 'card') shapeClass = 'logo-shape-card';

      logoHTML = `<div class="cover-logo-wrap cover-logo-pos-${logoPos} ${shapeClass}"><img src="${esc(logoSrc)}" style="width:${logoSize}px; height:auto; display:block; margin: 0 auto;" alt="Logo"></div>`;
    }

    const ornaments = soft ? '<div class="orn">\u25C6 \u25C6 \u25C6</div>' : '';
    const subtitleAnswers = isAns ? ' — Answers' : '';

    const totalQsCount = secs.reduce((sum, s) => sum + s.qs.length, 0);
    const totalQsText = formatTotalQuestions(totalQsCount, S, secs);
    const totalQsHTML = S.coverTotalQs ? `<p class="cover-total-qs">${esc(totalQsText)}</p>` : '';
    const dateHTML = S.coverDate ? `<p class="cover-date">${esc(S.coverDate)}</p>` : '';
    const examInfoHTML = S.coverExamInfo ? `<p class="cover-exam-info">${esc(S.coverExamInfo)}</p>` : '';

    const titleStyle = S.coverTitleSize ? `style="font-size:${S.coverTitleSize}pt"` : '';
    const subStyle = S.coverSubtitleSize ? `style="font-size:${S.coverSubtitleSize}pt"` : '';

    const borderClass = (S.coverBorder && S.coverBorder !== 'none') ? `cover-border-${S.coverBorder}` : '';
    const alignClass = S.coverAlign ? `cover-align-${S.coverAlign}` : 'cover-align-center';

    let qrHTML = '';
    if (S.coverQr !== false && S.coverQrUrl) {
      const qrSvg = generateQrSvg(S.coverQrUrl, S.coverQrSize || 84);
      const qrLabel = S.coverQrLabel ? `<span class="cover-qr-label">${esc(S.coverQrLabel)}</span>` : '';
      qrHTML = `<div class="cover-qr-wrap">${qrSvg}${qrLabel}</div>`;
    }

    const coverHTML = `
      <div class="cover-content cover-layout-${coverLayout} ${borderClass} ${alignClass}">
        ${logoPos === 'top' ? logoHTML : ''}
        <h1 ${titleStyle}>${esc(S.title)}</h1>
        ${logoPos === 'middle' ? logoHTML : ''}
        <h2 ${subStyle}>${esc(S.subtitle)}${subtitleAnswers}</h2>
        ${totalQsHTML}
        ${dateHTML}
        ${examInfoHTML}
        ${ornaments}
        ${logoPos === 'bottom' ? logoHTML : ''}
        <p class="cover-by">${esc(S.by)}</p>
        <p class="cover-join">${esc(S.joinText)}</p>
        ${qrHTML}
      </div>
    `;

    items.push({ full: true, html: coverHTML, isCover: true });
  }

  // 2. Sections & Questions
  let globalNum = 0;
  secs.forEach((s, sIdx) => {
    // Question count in section title: ONLY English, and ONLY when explicitly turned on
    const qCountText = S.secTitleCount ? ` <small class="sec-count">(${s.qs.length} Qs)</small>` : '';

    const secPageEnabled = (s.secPageEnabled !== undefined) ? s.secPageEnabled : S.secPages;

    if (secPageEnabled && s.name) {
      const ornaments = soft ? '<div class="orn">\u25C6 \u25C6 \u25C6</div>' : '';
      const secLayout = s.secPageLayout || S.secPageLayout || 'band';
      const secLogoSize = S.secPageLogoSize || 80;
      let secLogoHTML = '';
      const showLogo = (s.secPageLogo !== undefined) ? s.secPageLogo : (S.secPageLogo !== false);
      if (showLogo) {
        let logoSrc = S.wmImg || './medscope-watermark-default.png';
        if (logoSrc === '/medscope-watermark-default.png') logoSrc = './medscope-watermark-default.png';
        secLogoHTML = `<div class="sec-cover-logo"><img src="${esc(logoSrc)}" style="width:${secLogoSize}px;height:auto;display:block;margin:0 auto 16px;" alt="Logo"></div>`;
      }
      // Convert Arabic default/generic section labels to English Part 1 / Part 2 / etc.
      let displayName = s.secPageTitle || s.name;
      const trimmedName = (displayName || '').trim();
      const arabicOrdinals = {
        'القسم الأول': 'Part 1',
        'الدرس الأول': 'Part 1',
        'الفصل الأول': 'Part 1',
        'الوحدة الأولى': 'Part 1',
        'المحاضرة الأولى': 'Part 1',
        'القسم الثاني': 'Part 2',
        'الدرس الثاني': 'Part 2',
        'الفصل الثاني': 'Part 2',
        'الوحدة الثانية': 'Part 2',
        'المحاضرة الثانية': 'Part 2',
        'القسم الثالث': 'Part 3',
        'الدرس الثالث': 'Part 3',
        'الفصل الثالث': 'Part 3',
        'الوحدة الثالثة': 'Part 3',
        'المحاضرة الثالثة': 'Part 3',
        'القسم الرابع': 'Part 4',
        'الدرس الرابع': 'Part 4',
        'الفصل الرابع': 'Part 4',
        'القسم الخامس': 'Part 5',
        'الدرس الخامس': 'Part 5',
        'الفصل الخامس': 'Part 5',
        'القسم السادس': 'Part 6',
        'الدرس السادس': 'Part 6',
        'القسم السابع': 'Part 7',
        'الدرس السابع': 'Part 7',
        'القسم الثامن': 'Part 8',
        'الدرس الثامن': 'Part 8',
        'القسم التاسع': 'Part 9',
        'الدرس التاسع': 'Part 9',
        'القسم العاشر': 'Part 10',
        'الدرس العاشر': 'Part 10'
      };

      if (arabicOrdinals[trimmedName]) {
        displayName = (trimmedName === 'القسم الأول' || trimmedName === 'الدرس الأول') && S.secPageTitleOverride
          ? S.secPageTitleOverride
          : arabicOrdinals[trimmedName];
      } else if (/^(?:قسم|القسم|درس|الدرس|فصل|الفصل|وحدة|الوحدة|محاضرة|المحاضرة|موضوع|الموضوع|باب|الباب)\s*(\d+)/i.test(trimmedName)) {
        const numMatch = trimmedName.match(/\d+/);
        displayName = numMatch ? `Part ${numMatch[0]}` : 'Part';
      }

      if (!s.secPageTitle && S.secPageTitleOverride && (secs.length === 1 || sIdx === 0 || /^Part\s*1?$/i.test(displayName))) {
        displayName = S.secPageTitleOverride;
      }

      let secSub = '';
      const subVal = (s.secPageSub !== undefined) ? s.secPageSub : S.secPageSub;
      if (subVal && subVal.toLowerCase() !== 'none' && subVal.trim() !== '') {
        secSub = `<div class="qs">${esc(subVal)}</div>`;
      } else if (subVal === undefined || subVal === null) {
        secSub = `<div class="qs">Qs</div>`;
      }

      items.push({
        full: true,
        isSecCover: true,
        html: `<div class="section-cover-page sec-layout-${secLayout}">${secLogoHTML}<h1>${esc(displayName)}${qCountText}</h1>${secSub}${ornaments}</div>`
      });
    } else if (s.name) {
      items.push({
        keep: true,
        html: `<div class="sh">${esc(s.name)}${qCountText}</div>`
      });
    }

    s.qs.forEach((q, i) => {
      globalNum++;
      const currentNumber = S.renumber ? (i + 1) : globalNum;
      if (isEssayQuestion(q)) {
        const frags = splitQuestionIntoFragments(q, currentNumber, isAns, S);
        frags.forEach(f => items.push(f));
      } else {
        items.push({
          isQuestion: true,
          html: qHTML(q, currentNumber, isAns, S)
        });
      }
    });
  });

  // 3. Answer Key Page (Optional, at end of answers sheet)
  if (S.keyPage && isAns) {
    const keyCols = S.keyCols || 5;
    const parts = secs.map(s => {
      const secTitle = s.name ? `<h2 style="width:100%;text-align:left;font-size:15pt;margin-top:6pt">${esc(s.name)}</h2>` : '';
      const grid = `<div class="keygrid" style="grid-template-columns:repeat(${keyCols}, 1fr);">${s.qs.map((q, i) => {
        const num = S.renumber ? (i + 1) : '';
        const letter = q.ans == null ? '?' : LET[q.ans].toUpperCase();
        return `<span>${num}<b> ${letter}</b></span>`;
      }).join('')}</div>`;
      return secTitle + grid;
    }).join('');

    items.push({
      full: true,
      top: true,
      html: `<h2>Answer Key</h2>${parts}`
    });
  }

  return items;
}

export function renderPagesHTML(isAns) {
  const secs = getViewData();
  const S = state.settings;

  if (!secs.length) {
    return `<div class="hint" style="text-align:center;padding:60px 0">Paste questions or drop files to preview the print-ready exam sheet here.</div>`;
  }

  const varsStyle = paperVars(S);
  const items = buildItems(secs, isAns, S);
  const P = paginate(items, S, varsStyle);

  const totalPages = P.pages.length;

  const pagesHTML = P.pages.map((p, i) => {
    const pageNumber = i + 1;
    const isCoverPage = p.full && p.full.isCover;

    // Header HTML
    let headerHTML = '';
    if (S.header && !isCoverPage) {
      const hAlign = S.headerAlign || 'right';
      let logoSrc = S.wmImg || './medscope-watermark-default.png';
      if (logoSrc === '/medscope-watermark-default.png') {
        logoSrc = './medscope-watermark-default.png';
      }
      const headerLogoSize = S.headerLogoSize || 18;
      const logoIcon = S.headerLogo ? `<img src="${esc(logoSrc)}" style="height:${headerLogoSize}px;width:auto;vertical-align:middle;margin-inline-end:6px;" alt="Logo">` : '';
      headerHTML = `<div class="hdr hdr-align-${hAlign}"><span>${logoIcon}${esc(S.header)}</span></div>`;
    }

    // Footer HTML & Page numbering
    let footerHTML = '';
    if ((S.pageNums || S.footer) && !isCoverPage) {
      const footerText = S.footer ? esc(S.footer) : '';
      let pageNumText = '';
      if (S.pageNums) {
        if (S.pageNumFmt === 'Page 1') pageNumText = `Page ${pageNumber}`;
        else if (S.pageNumFmt === '1 / 12') pageNumText = `${pageNumber} / ${totalPages}`;
        else pageNumText = `${pageNumber}`;
      }
      const footerSeparator = (footerText && pageNumText) ? ' • ' : '';
      const fAlign = S.footerAlign || 'center';
      footerHTML = `<div class="ftr ftr-align-${fAlign}">${footerText}${footerSeparator}${pageNumText}</div>`;
    }

    // Watermark HTML
    let showWm = !isCoverPage || S.wmCover;
    if (S.wmTarget === 'qs-only' && (isCoverPage || p.full)) {
      showWm = false;
    }
    const watermarkHTML = showWm ? wmHTML(S) : '';

    // Top colour bar
    const topBarHTML = S.topBar !== false ? `<div class="page-top-bar" style="height:${S.topBarH || 5}px;"></div>` : '';

    // Page frame border
    const frameClass = S.pageFrame ? ' has-frame' : '';

    let bodyHTML = '';
    const bodyW = P.PW - P.ml - P.mr;

    if (p.full) {
      bodyHTML = `<div class="body full" style="top:${P.mt}px;left:${P.ml}px;width:${bodyW}px;height:${P.availH}px">${p.full.html}</div>`;
    } else {
      const dividerClass = S.colDivider ? ' with-col-divider' : '';
      const colsHTML = p.cols.map(c => `<div class="col">${c.join('')}</div>`).join('');
      bodyHTML = `<div class="body${dividerClass}" style="top:${P.mt}px;left:${P.ml}px;width:${bodyW}px;height:${P.availH}px;grid-template-columns:repeat(${S.cols || 1},1fr);column-gap:${S.colGap || S.gap || 10}px">${colsHTML}</div>`;
    }

    const themeClass = `t-${S.theme || 'soft'}`;
    const fullClass = p.full ? ' is-full' : '';
    const isExcluded = state.excludedPages && state.excludedPages.has(pageNumber);
    const excludedClass = isExcluded ? ' is-page-excluded' : '';

    const pageActionsHTML = `
      <div class="page-action-toolbar" data-page-num="${pageNumber}">
        <span class="page-badge-pill">ص ${pageNumber}</span>
        <div class="page-action-buttons">
          <button type="button" class="btn-page-action download" data-download-page="${pageNumber}" title="تحميل هذه الصفحة فقط كـ PDF">📥 صفحة واحدة</button>
          <button type="button" class="btn-page-action ${isExcluded ? 'restore' : 'exclude'}" data-toggle-page="${pageNumber}" title="${isExcluded ? 'استعادة هذه الصفحة للـ PDF والطباعة' : 'استبعاد هذه الصفحة من ملف الـ PDF'}">
            ${isExcluded ? '↺ استعادة' : '🗑️ استبعاد'}
          </button>
        </div>
      </div>
    `;

    return `<div class="page paper ${themeClass}${fullClass}${frameClass}${excludedClass}" data-page="${pageNumber}" style="${varsStyle};width:${P.PW}px;height:${P.PH}px">${pageActionsHTML}${topBarHTML}${headerHTML}${watermarkHTML}${footerHTML}${bodyHTML}</div>`;
  }).join('');

  return `<div class="pages-wrap" id="pagesWrap" data-pages="${totalPages}">${pagesHTML}</div>`;
}

export function fitZoom() {
  if (typeof document === 'undefined') return;
  const wrap = document.getElementById('pagesWrap');
  if (!wrap) return;

  const stage = document.querySelector('.stage') || document.querySelector('.preview-card') || document.body;
  if (!stage) return;

  const dims = getPageDimensions(state.settings);
  const availWidth = stage.clientWidth - 40;
  const pageWidth = dims.PW || (210 * MM);
  const zoom = state.zoomManual || Math.max(0.25, Math.min(1, availWidth / pageWidth));

  wrap.style.setProperty('--z', zoom);
}
