// paper.js - WYSIWYG paper engine, HTML builders for question & answer sheets

import { LET } from './parser.js';
import { state, getViewData } from './state.js';
import { paginate, MM } from './paginate.js';
import { generateQrSvg } from './qrHelper.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[c]));
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
    `--m-out:${mOut}mm`
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
    return `<div class="wm wm-${pos}" style="${posStyle}"><img src="${esc(imgSrc)}" style="width:${size}px; height:auto; max-width:85%; display:block;" alt="MEDSCOPE Watermark Logo"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">MEDSCOPE</span></div>`;
  }

  return `<div class="wm wm-${pos}" style="${posStyle}"><b>${esc(S.wmText || 'MEDSCOPE')}</b><em>${esc(S.wmSub || 'Spread your wingS')}</em></div>`;
}

export function qHTML(q, n, isAns, S = state.settings) {
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
    const totalQsHTML = S.coverTotalQs ? `<p class="cover-total-qs">Total: ${totalQsCount} MCQs</p>` : '';
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
  secs.forEach(s => {
    // Question count in section title: ONLY English, and ONLY when explicitly turned on
    const qCountText = S.secTitleCount ? ` <small class="sec-count">(${s.qs.length} Qs)</small>` : '';

    if (S.secPages && s.name) {
      const ornaments = soft ? '<div class="orn">\u25C6 \u25C6 \u25C6</div>' : '';
      const secLayout = S.secPageLayout || 'band';
      const secLogoSize = S.secPageLogoSize || 80;
      let secLogoHTML = '';
      if (S.secPageLogo !== false) {
        let logoSrc = S.wmImg || './medscope-watermark-default.png';
        if (logoSrc === '/medscope-watermark-default.png') logoSrc = './medscope-watermark-default.png';
        secLogoHTML = `<div class="sec-cover-logo"><img src="${esc(logoSrc)}" style="width:${secLogoSize}px;height:auto;display:block;margin:0 auto 16px;" alt="Logo"></div>`;
      }
      const secSub = (S.secPageSub === 'none') ? '' : `<div class="qs">${esc(S.secPageSub || 'Qs')}</div>`;

      items.push({
        full: true,
        isSecCover: true,
        html: `<div class="section-cover-page sec-layout-${secLayout}">${secLogoHTML}<h1>${esc(s.name)}${qCountText}</h1>${secSub}${ornaments}</div>`
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
      items.push({
        isQuestion: true,
        html: qHTML(q, currentNumber, isAns, S)
      });
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

    return `<div class="page paper ${themeClass}${fullClass}${frameClass}" style="${varsStyle};width:${P.PW}px;height:${P.PH}px">${topBarHTML}${headerHTML}${watermarkHTML}${footerHTML}${bodyHTML}</div>`;
  }).join('');

  return `<div class="pages-wrap" id="pagesWrap" data-pages="${totalPages}">${pagesHTML}</div>`;
}

export function fitZoom() {
  const wrap = document.getElementById('pagesWrap');
  if (!wrap) return;

  const stage = document.querySelector('.stage') || document.querySelector('.preview-card') || document.body;
  if (!stage) return;

  const availWidth = stage.clientWidth - 40;
  const pageWidth = 210 * MM;
  const zoom = state.zoomManual || Math.min(1, availWidth / pageWidth);

  wrap.style.setProperty('--z', zoom);
}
