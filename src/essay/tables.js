// src/essay/tables.js - Table block parsing, conversion, and rendering

/**
 * Checks if a line looks like part of a markdown pipe table or structured table
 */
export function isTableLine(line) {
  if (!line) return false;
  const trimmed = line.trim();
  if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
    return true;
  }
  // Check tab-separated columns (at least 2 tabs)
  if (trimmed.split('\t').length >= 3) {
    return true;
  }
  return false;
}

/**
 * Checks if a line is a markdown separator line like |---|---|
 */
export function isTableSeparatorLine(line) {
  const trimmed = line.trim();
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(trimmed);
}

/**
 * Parses an array of table lines into a structured table block
 * { type: 'table', rows: string[][], header: boolean }
 */
export function parseTableBlock(lines) {
  if (!Array.isArray(lines) || !lines.length) return null;

  const rawRows = [];
  let hasPipe = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isTableSeparatorLine(trimmed)) {
      continue; // Skip markdown separator row like |--|--|
    }

    if (trimmed.includes('|')) {
      hasPipe = true;
      // Split by pipe
      let parts = trimmed.split('|').map(c => c.trim());
      // If starts with pipe, first element is empty
      if (trimmed.startsWith('|')) parts = parts.slice(1);
      // If ends with pipe, last element is empty
      if (trimmed.endsWith('|')) parts = parts.slice(0, parts.length - 1);
      rawRows.push(parts);
    } else if (trimmed.includes('\t')) {
      rawRows.push(trimmed.split('\t').map(c => c.trim()));
    } else {
      // 2 or more spaces separated
      const parts = trimmed.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
      if (parts.length >= 2) {
        rawRows.push(parts);
      }
    }
  }

  if (!rawRows.length) return null;

  // Normalize column count across all rows
  const maxCols = Math.max(...rawRows.map(r => r.length), 1);
  const normalizedRows = rawRows.map(r => {
    const row = [...r];
    while (row.length < maxCols) {
      row.push('');
    }
    return row;
  });

  return {
    type: 'table',
    rows: normalizedRows,
    header: true
  };
}

/**
 * Renders a structured table block to HTML
 */
export function renderTableHTML(tableBlock, isAnswer = false) {
  if (!tableBlock || !Array.isArray(tableBlock.rows) || !tableBlock.rows.length) {
    return '';
  }

  const rows = tableBlock.rows;
  const hasHeader = tableBlock.header !== false && rows.length > 1;
  const headerRow = hasHeader ? rows[0] : null;
  const bodyRows = hasHeader ? rows.slice(1) : rows;

  let html = `<div class="essay-table-wrap ${isAnswer ? 'is-answer-table' : ''}"><table class="essay-table">`;

  if (headerRow) {
    html += '<thead><tr>';
    headerRow.forEach((cell, ci) => {
      html += `<th scope="col" class="${ci === 0 ? 'th-corner' : ''}">${escapeHTML(cell)}</th>`;
    });
    html += '</tr></thead>';
  }

  html += '<tbody>';
  bodyRows.forEach(row => {
    html += '<tr>';
    row.forEach((cell, ci) => {
      if (ci === 0 && hasHeader) {
        html += `<th scope="row" class="th-row-header">${escapeHTML(cell)}</th>`;
      } else {
        html += `<td>${escapeHTML(cell)}</td>`;
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  return html;
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
