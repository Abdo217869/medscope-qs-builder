// paginate.js - High precision A4 / A5 / Letter pagination engine

export const MM = 96 / 25.4; // 1mm in px at 96 DPI

export const PAGE_SIZES = {
  A4: { width: 210 * MM, height: 297 * MM },
  A5: { width: 148 * MM, height: 210 * MM },
  Letter: { width: 215.9 * MM, height: 279.4 * MM }
};

export const A4_WIDTH = PAGE_SIZES.A4.width;   // ~793.7px
export const A4_HEIGHT = PAGE_SIZES.A4.height; // ~1122.5px

export function getPageDimensions(settings = {}) {
  const sizeKey = settings.pageSize || 'A4';
  const base = PAGE_SIZES[sizeKey] || PAGE_SIZES.A4;
  if (settings.orientation === 'landscape') {
    return { PW: base.height, PH: base.width };
  }
  return { PW: base.width, PH: base.height };
}

/**
 * Paginates an array of items (full-page items or flow items) into pages.
 * Flow items are measured in the DOM at the exact column width with active theme variables.
 *
 * @param {Array} items - Array of { html, full?, keep?, isQuestion? }
 * @param {Object} settings - Paper settings (margins, cols, gap, theme, etc.)
 * @param {string} paperVarsStyle - Computed CSS custom properties string
 * @returns {Object} { pages, PW, PH, mt, mb, ml, mr, availH, colW }
 */
export function paginate(items, settings, paperVarsStyle) {
  const { PW, PH } = getPageDimensions(settings);

  const mtRaw = (settings.marginTop !== undefined ? settings.marginTop : (settings.margin || 16));
  const mbRaw = (settings.marginBottom !== undefined ? settings.marginBottom : (settings.margin || 16));
  const minRaw = (settings.marginInside !== undefined ? settings.marginInside : (settings.margin || 16));
  const moutRaw = (settings.marginOutside !== undefined ? settings.marginOutside : (settings.margin || 16));

  const mt = mtRaw * MM + 7 * MM; // Account for header space
  const mb = mbRaw * MM + 4 * MM; // Account for footer space
  const ml = minRaw * MM;
  const mr = moutRaw * MM;

  const gap = +(settings.colGap || settings.gap || 10);
  const C = Math.max(1, +(settings.cols || 1));
  const themeClass = `t-${settings.theme || 'soft'}`;

  const availH = PH - mt - mb;
  const colW = (PW - ml - mr - gap * (C - 1)) / C;

  // Hidden DOM measuring element - carries exact theme and variable styling
  const ms = document.createElement('div');
  ms.className = `paper measure ${themeClass}`;
  ms.style.cssText = `${paperVarsStyle};width:${colW}px;position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;`;
  document.body.append(ms);

  const flow = items.filter(x => !x.full);
  flow.forEach(x => {
    ms.innerHTML = x.html;
    x.h = ms.getBoundingClientRect().height;
  });
  ms.remove();

  const pages = [];
  let cur = null;
  let ci = 0;
  let used = 0;
  let pageQs = 0;
  const qsLimit = +(settings.qsPerPage || 0);

  const newPage = () => {
    cur = { cols: Array.from({ length: C }, () => []) };
    pages.push(cur);
    ci = 0;
    used = 0;
    pageQs = 0;
  };

  items.forEach((it, k) => {
    if (it.full) {
      pages.push({ full: it });
      cur = null;
      return;
    }

    if (!cur) newPage();

    let need = it.h;

    // Keep subject heading with its first question (never orphan a heading at bottom of page)
    if (it.keep || settings.keepHeadWithFirst) {
      const nextItem = items[k + 1];
      if (nextItem && !nextItem.full && nextItem.h) {
        need += nextItem.h;
      }
    }

    // Check if item exceeds column capacity or exceeds optional questions-per-page limit
    const exceedsCapacity = (used > 0 && used + need > availH + 0.5);
    const exceedsQsLimit = (qsLimit > 0 && it.isQuestion && pageQs >= qsLimit);

    if (exceedsCapacity || exceedsQsLimit) {
      ci++;
      used = 0;
      if (ci >= C) {
        newPage();
      }
    }

    cur.cols[ci].push(it.html);
    used += it.h;
    if (it.isQuestion) pageQs++;
  });

  return {
    pages,
    PW,
    PH,
    mt,
    mb,
    ml,
    mr,
    m: (settings.margin || 16) * MM,
    availH,
    colW
  };
}
