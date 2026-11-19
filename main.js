// main.js - Application Coordinator & 3-Step Flow Engine

import { parse, richLines } from './src/parser.js';
import { state, store, SAMPLE_TEXT, syncLogoFromIDB } from './src/state.js';
import { renderPagesHTML, fitZoom } from './src/paper.js';
import { renderStats } from './src/stats.js';
import { buildSettingsUI } from './src/settings.js';
import { renderEditorHTML, bindEditorEvents } from './src/editor.js';
import { renderExportHTML, bindExportEvents, showToast } from './src/export.js';
import { processMultipleFiles } from './src/import/fileProcessor.js';
import { renderReportCardHTML, renderProblemsPanelHTML, bindProblemEvents } from './src/problems.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let renderTimer = null;
let parseTimer = null;
let currentFiles = [];
let lastMergeMessage = '';
let activeStep = 1;
let undoTimer = null;
let lastDeletedData = null;

/**
 * 3-Step Navigation Controller (Prompt 2 Part B1)
 */
export function setStep(stepNum) {
  activeStep = stepNum;

  // Update Stepper buttons
  $$('.step-btn').forEach(btn => {
    const s = +btn.dataset.step;
    btn.classList.toggle('active', s === stepNum);
  });

  // Toggle Step panels
  const s1 = $('#step1');
  const s2 = $('#step2');
  const s3 = $('#step3');

  if (s1) s1.hidden = (stepNum !== 1);
  if (s2) s2.hidden = (stepNum !== 2);
  if (s3) s3.hidden = (stepNum !== 3);

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (stepNum === 2) {
    renderStep2();
  } else if (stepNum === 3) {
    renderStep3();
  }
}

/**
 * Renders Step 2 (Review, Report Card, Problems Panel, Editor)
 */
export function renderStep2() {
  const reportContainer = $('#reportCardContainer');
  const probContainer = $('#problemsPanelContainer');
  const editorHost = $('#editorHost');

  if (reportContainer) {
    reportContainer.innerHTML = renderReportCardHTML(
      currentFiles.length ? currentFiles.length : null,
      lastMergeMessage
    );
  }

  if (probContainer) {
    probContainer.innerHTML = renderProblemsPanelHTML();
    bindProblemEvents(() => {
      // Inline fix occurred -> re-serialize or re-parse
      syncFromState();
      renderStep2();
      renderStats();
    });

    // Zero questions buttons
    $('#btnZeroSample', probContainer)?.addEventListener('click', () => {
      loadSample();
      setStep(2);
    });

    $('#btnZeroManual', probContainer)?.addEventListener('click', () => {
      const emptyRaw = '# مادة جديدة\n1- اكتب رأس السؤال هنا\na) خيار 1 ✓\nb) خيار 2\nc) خيار 3\nd) خيار 4\n';
      const rawEl = $('#raw');
      if (rawEl) rawEl.value = emptyRaw;
      reparse();
      renderStep2();
    });
  }

  if (editorHost) {
    editorHost.innerHTML = renderEditorHTML();
    bindEditorEvents(
      (serializedText) => {
        const rawEl = $('#raw');
        const keyEl = $('#keyraw');
        if (rawEl) rawEl.value = serializedText;
        if (keyEl) keyEl.value = '';
        reparse();
        renderStep2();
        showToast('تم حفظ التعديلات بنجاح ✓');
      },
      () => {
        renderStep2();
      }
    );
  }
}

/**
 * Renders Step 3 (Download Decision & Live Sheet Preview)
 */
export function renderStep3() {
  renderStats();
  renderView();

  const advSettingsHost = $('#advSettingsHost');
  if (advSettingsHost && !advSettingsHost.hasChildNodes()) {
    buildSettingsUI(() => {
      renderAll();
    });
  }

  const exportHost = $('#exportHost');
  if (exportHost) {
    exportHost.innerHTML = renderExportHTML();
    bindExportEvents();
  }
}

/**
 * Re-parses question and answer inputs and refreshes view and stats.
 */
export function reparse() {
  const rawInput = $('#raw');
  const keyInput = $('#keyraw');
  if (!rawInput || !keyInput) return;

  const rawVal = rawInput.value;
  const keyVal = keyInput.value;

  try {
    state.data = parse(rawVal, keyVal);
    store.set('mq.raw', rawVal);
    store.set('mq.key', keyVal);
    store.set('mq.savedAt', new Date().toISOString());
  } catch (err) {
    console.error('Parsing error:', err);
    showToast('حدث خطأ أثناء معالجة النص');
  }

  renderStats();
  renderView();
}

/**
 * Syncs raw textarea from current parsed sections in state
 */
function syncFromState() {
  const sections = state.data?.sections || [];
  const lines = [];

  sections.forEach(s => {
    if (s.name) lines.push(`# ${s.name}`);
    s.qs.forEach((q, idx) => {
      lines.push(`${idx + 1}- ${q.stem}`);
      q.opts.forEach((opt, oIdx) => {
        const letter = 'abcdefgh'[oIdx];
        const isAns = (q.ans === oIdx);
        lines.push(`${letter}) ${opt}${isAns ? ' ✓' : ''}`);
      });
      if (q.expl) lines.push(`Explanation: ${q.expl}`);
      lines.push('');
    });
    lines.push('');
  });

  const fullText = lines.join('\n').trim();
  const rawEl = $('#raw');
  if (rawEl) rawEl.value = fullText;
  reparse();
}

/**
 * Debounced render coordinator
 */
export function renderAll() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderView();
  }, 40);
}

/**
 * Renders the active view in the main stage container
 */
export function renderView() {
  const viewContainer = $('#view');
  if (!viewContainer) return;

  viewContainer.onclick = null;
  viewContainer.oninput = null;
  viewContainer.onchange = null;

  const currentView = state.view;

  if (currentView === 'qs' || currentView === 'as') {
    viewContainer.innerHTML = renderPagesHTML(currentView === 'as');
    fitZoom();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!viewContainer.dataset.fontLoaded) {
          viewContainer.dataset.fontLoaded = 'true';
          viewContainer.innerHTML = renderPagesHTML(currentView === 'as');
          fitZoom();
        }
      });
    }
  } else if (currentView === 'edit') {
    viewContainer.innerHTML = renderEditorHTML();
    bindEditorEvents(
      (serializedText) => {
        const rawEl = $('#raw');
        const keyEl = $('#keyraw');
        if (rawEl) rawEl.value = serializedText;
        if (keyEl) keyEl.value = '';
        reparse();
        showToast('تم تحديث نص الأسئلة بنجاح ✓');
      },
      () => {
        renderView();
      }
    );
  } else if (currentView === 'exp') {
    viewContainer.innerHTML = renderExportHTML();
    bindExportEvents();
  }

  // Update view toggle buttons in toolbar
  $$('#views button').forEach(btn => {
    const isCurrent = btn.dataset.v === currentView;
    btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
  });
}

export function setView(v) {
  state.view = v;
  renderView();
}

/**
 * Prepares the sheet for print and triggers browser print dialog
 */
export function printMode(sheetView) {
  setView(sheetView);
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        showToast('الطباعة غير مدعومة مباشرة، يرجى فتح الصفحة في متصفح حديث');
      }
    }, 200);
  });
}

/**
 * In-Page Confirmation Modal (Prompt 2 Part B5b - No native confirm())
 */
export function confirmInPage(title, message) {
  return new Promise((resolve) => {
    const modal = $('#confirmModal');
    const titleEl = $('#confirmTitle');
    const msgEl = $('#confirmMessage');
    const btnOk = $('#btnConfirmOk');
    const btnCancel = $('#btnConfirmCancel');

    if (!modal) {
      resolve(true);
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    modal.hidden = false;

    const cleanup = () => {
      modal.hidden = true;
      btnOk.onclick = null;
      btnCancel.onclick = null;
    };

    btnOk.onclick = () => {
      cleanup();
      resolve(true);
    };

    btnCancel.onclick = () => {
      cleanup();
      resolve(false);
    };
  });
}

/**
 * 10-Second Undo Toast (Prompt 2 Part B5b)
 */
export function showUndoToast(message, onUndo) {
  clearTimeout(undoTimer);
  const host = $('#toastHost');
  if (!host) return;

  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.innerHTML = `
    <span>${message}</span>
    <button id="btnUndoAction">تراجع (Undo)</button>
  `;
  host.innerHTML = '';
  host.appendChild(toast);

  const btnUndo = toast.querySelector('#btnUndoAction');
  btnUndo.onclick = () => {
    clearTimeout(undoTimer);
    toast.remove();
    if (onUndo) onUndo();
    showToast('تم التراجع بنجاح ✓');
  };

  undoTimer = setTimeout(() => {
    toast.remove();
  }, 10000);
}

/**
 * Renders File Cards List
 */
function renderFileCards() {
  const container = $('#fileCardsList');
  if (!container) return;

  if (currentFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = currentFiles.map((fileObj, idx) => {
    const statusClass = fileObj.status === 'reading' ? 'reading' : (fileObj.status === 'failed' ? 'failed' : 'done');
    const statusText = fileObj.statusMessage || (fileObj.status === 'reading' ? 'جاري القراءة...' : 'جاهز ✓');
    const sizeKB = Math.round((fileObj.file?.size || 0) / 1024);

    return `
      <div class="file-card" data-idx="${idx}">
        <div class="file-card-icon">📄</div>
        <div class="file-card-info">
          <div class="file-card-name" title="${fileObj.name}">${fileObj.name}</div>
          <div class="file-card-meta">${sizeKB ? sizeKB + ' KB • ' : ''}${fileObj.ext || ''}</div>
        </div>
        <div class="file-card-status ${statusClass}">
          ${statusText}
        </div>
        <div class="file-card-actions">
          ${idx > 0 ? `<button class="btn sm" data-action="up" title="تحريك لأعلى">↑</button>` : ''}
          ${idx < currentFiles.length - 1 ? `<button class="btn sm" data-action="down" title="تحريك لأسفل">↓</button>` : ''}
          <button class="btn sm danger" data-action="remove" title="حذف الملف">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Handles processing of dropped or selected files
 */
async function handleFilesSelected(files) {
  if (!files || !files.length) return;

  for (const f of files) {
    currentFiles.push({
      name: f.name,
      file: f,
      status: 'reading',
      statusMessage: 'جاري القراءة...'
    });
  }
  renderFileCards();

  try {
    const rawFiles = currentFiles.map(cf => cf.file);
    const result = await processMultipleFiles(rawFiles, (fileName, progress) => {
      const match = currentFiles.find(cf => cf.name === fileName);
      if (match) {
        match.status = progress.status;
        match.statusMessage = progress.message;
        renderFileCards();
      }
    });

    lastMergeMessage = result.mergeMessage || '';

    const rawEl = $('#raw');
    if (rawEl) {
      rawEl.value = result.mergedText;
    }

    reparse();
    renderFileCards();

    const totalQs = state.data?.sections?.reduce((sum, s) => sum + s.qs.length, 0) || 0;
    showToast(`تم استخراج ${totalQs} سؤال بنجاح ✓`);

    // Advance to Step 2
    setStep(2);
  } catch (err) {
    console.error('File import error:', err);
    showToast(err.message || 'حدث خطأ أثناء قراءة الملفات');
  }
}

/**
 * Loads sample question bank
 */
function loadSample() {
  const rawTextarea = $('#raw');
  const keyTextarea = $('#keyraw');
  if (rawTextarea) rawTextarea.value = SAMPLE_TEXT;
  if (keyTextarea) keyTextarea.value = '';
  currentFiles = [];
  renderFileCards();
  reparse();
  setView('qs');
  showToast('تم تحميل أسئلة تجريبية جاهزة ✓');
}

/**
 * Initializes the entire application
 */
export function init() {
  const rawTextarea = $('#raw');
  const keyTextarea = $('#keyraw');

  // Build settings form
  buildSettingsUI(() => {
    renderAll();
  });

  // Sync custom logo from IndexedDB if previously uploaded
  syncLogoFromIDB((customLogo) => {
    buildSettingsUI(() => {
      renderAll();
    });
    renderAll();
  });

  // Restore saved input or default sample
  const savedRaw = store.get('mq.raw');
  const savedKey = store.get('mq.key');

  if (rawTextarea) {
    rawTextarea.value = (savedRaw !== null) ? savedRaw : SAMPLE_TEXT;
  }
  if (keyTextarea) {
    keyTextarea.value = (savedKey !== null) ? savedKey : '';
  }

  // Initial parse
  reparse();

  // Recovery banner check (Prompt 2 Part B5b)
  if (savedRaw && savedRaw.length > 50 && savedRaw !== SAMPLE_TEXT) {
    const banner = $('#recoveryBanner');
    const recText = $('#recoveryText');
    const totalQs = state.data?.sections?.reduce((sum, s) => sum + s.qs.length, 0) || 0;
    if (banner && recText) {
      recText.textContent = `وجدنا عملاً سابقًا محفوظًا (${totalQs} سؤال). تحب تكمّل عليه؟`;
      banner.hidden = false;

      $('#btnRecover')?.addEventListener('click', () => {
        banner.hidden = true;
        setStep(2);
        showToast('تم استرجاع شغلك السابق بنجاح ✓');
      });

      $('#btnDismissRecover')?.addEventListener('click', () => {
        banner.hidden = true;
      });
    }
  }

  // Stepper Nav Click Events
  $$('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setStep(+btn.dataset.step);
    });
  });

  // Next / Back Buttons
  $('#btnStep1Next')?.addEventListener('click', () => setStep(2));
  $('#btnStep2Back')?.addEventListener('click', () => setStep(1));
  $('#btnStep2Next')?.addEventListener('click', () => setStep(3));
  $('#btnStep3Back')?.addEventListener('click', () => setStep(2));

  // Big Download Hero Buttons (Prompt 2 Part B2)
  $('#btnPrintQBig')?.addEventListener('click', () => printMode('qs'));
  $('#btnPrintABig')?.addEventListener('click', () => printMode('as'));
  $('#btnPrintBoth')?.addEventListener('click', () => {
    printMode('qs');
    showToast('بعد حفظ ورقة الأسئلة، اضغط على زر ورقة الإجابات لحفظها أيضًا ✓');
  });

  // Drop Zone & File Input Events
  const dropZone = $('#dropZone');
  const fileInput = $('#fileInput');
  const btnBrowse = $('#btnBrowseFiles');

  if (btnBrowse && fileInput) {
    btnBrowse.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files.length) {
        handleFilesSelected(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length) {
        handleFilesSelected(e.target.files);
        fileInput.value = '';
      }
    });
  }

  // Whole Window Drop Support
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    if (e.target.closest('#dropZone')) return;
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) {
      handleFilesSelected(e.dataTransfer.files);
    }
  });

  // File Cards Reorder and Remove
  $('#fileCardsList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const card = btn.closest('.file-card');
    if (!card) return;
    const idx = +card.dataset.idx;
    const action = btn.dataset.action;

    if (action === 'remove') {
      currentFiles.splice(idx, 1);
      if (currentFiles.length === 0) {
        lastMergeMessage = '';
      }
      renderFileCards();
    } else if (action === 'up' && idx > 0) {
      const temp = currentFiles[idx];
      currentFiles[idx] = currentFiles[idx - 1];
      currentFiles[idx - 1] = temp;
      renderFileCards();
    } else if (action === 'down' && idx < currentFiles.length - 1) {
      const temp = currentFiles[idx];
      currentFiles[idx] = currentFiles[idx + 1];
      currentFiles[idx + 1] = temp;
      renderFileCards();
    }
  });

  // Debounced live inputs (250 ms)
  if (rawTextarea) {
    rawTextarea.addEventListener('input', () => {
      clearTimeout(parseTimer);
      parseTimer = setTimeout(reparse, 250);
    });

    rawTextarea.addEventListener('paste', (e) => {
      const html = e.clipboardData && e.clipboardData.getData('text/html');
      if (!html || !/color|bold|font-weight|<b[ >]|<strong/i.test(html)) return;

      try {
        const result = richLines(html, false);
        if (result.anyRed) {
          e.preventDefault();
          rawTextarea.setRangeText(result.text, rawTextarea.selectionStart, rawTextarea.selectionEnd, 'end');
          reparse();
          showToast('اتعرفت الإجابات الحمرا تلقائيًا ✓');
        }
      } catch (err) {
        console.warn('Rich paste detection error:', err);
      }
    });
  }

  if (keyTextarea) {
    keyTextarea.addEventListener('input', () => {
      clearTimeout(parseTimer);
      parseTimer = setTimeout(reparse, 250);
    });
  }

  // Sidebar Tab Switching (Kept for backwards compatibility)
  $$('.tabs-nav button').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      const targetTab = tabBtn.dataset.tab;
      state.tab = targetTab;

      $$('.tabs-nav button').forEach(b => {
        b.setAttribute('aria-selected', b === tabBtn ? 'true' : 'false');
      });

      $$('.pane').forEach(pane => {
        pane.hidden = pane.dataset.pane !== targetTab;
      });
    });
  });

  // View Switching (Toolbar buttons)
  $$('#views button').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.v));
  });

  // Studio View Mode Toggle (Side-by-Side vs Stacked)
  const btnSideBySide = $('#btnStudioSideBySide');
  const btnStacked = $('#btnStudioStacked');
  const studioWrap = $('#step3Studio');

  const setStudioMode = (mode) => {
    if (!studioWrap) return;
    if (mode === 'stacked') {
      studioWrap.classList.remove('mode-split');
      studioWrap.classList.add('mode-stacked');
      btnSideBySide?.classList.remove('active');
      btnStacked?.classList.add('active');
    } else {
      studioWrap.classList.add('mode-split');
      studioWrap.classList.remove('mode-stacked');
      btnSideBySide?.classList.add('active');
      btnStacked?.classList.remove('active');
    }
    store.set('mq.studioMode', mode);
    setTimeout(() => fitZoom(), 50);
  };

  btnSideBySide?.addEventListener('click', () => setStudioMode('split'));
  btnStacked?.addEventListener('click', () => setStudioMode('stacked'));

  const savedStudioMode = store.get('mq.studioMode') || 'split';
  setStudioMode(savedStudioMode);

  // Print Buttons
  $('#btnPrintQ')?.addEventListener('click', () => printMode('qs'));
  $('#btnPrintA')?.addEventListener('click', () => printMode('as'));

  // Header Actions
  $('#btnSample')?.addEventListener('click', () => {
    loadSample();
    setStep(2);
  });

  $('#btnClear')?.addEventListener('click', async () => {
    const ok = await confirmInPage(
      'مسح جميع الأسئلة والمفاتيح',
      'هل أنت متأكد من مسح جميع النصوص؟ يمكنك التراجع خلال 10 ثوانٍ.'
    );
    if (ok) {
      const prevRaw = rawTextarea ? rawTextarea.value : '';
      const prevKey = keyTextarea ? keyTextarea.value : '';
      lastDeletedData = { raw: prevRaw, key: prevKey };

      if (rawTextarea) rawTextarea.value = '';
      if (keyTextarea) keyTextarea.value = '';
      currentFiles = [];
      renderFileCards();
      reparse();

      showUndoToast('تم مسح الكل بنجاح', () => {
        if (lastDeletedData) {
          if (rawTextarea) rawTextarea.value = lastDeletedData.raw;
          if (keyTextarea) keyTextarea.value = lastDeletedData.key;
          reparse();
        }
      });
    }
  });

  // Help Modal & First-Visit Tour (Prompt 3 Bug A Fix)
  const helpModal = $('#helpModal');
  const hideHelpModal = () => {
    if (!helpModal) return;
    try {
      helpModal.hidden = true;
      helpModal.style.display = 'none';
      store.set('mq.tourSeen', 'true');
    } catch (e) {
      console.warn('Error closing help modal:', e);
      helpModal.style.display = 'none';
    }
  };

  const showHelpModal = () => {
    if (!helpModal) return;
    helpModal.hidden = false;
    helpModal.style.display = 'flex';
  };

  // Show intro modal on first visit (never seen before)
  let tourSeen = false;
  try {
    tourSeen = (store.get('mq.tourSeen') === 'true');
  } catch (e) {
    console.warn('Storage disabled:', e);
  }

  if (!tourSeen && helpModal) {
    showHelpModal();
  }

  $('#btnHelp')?.addEventListener('click', showHelpModal);
  $('#btnCloseHelp')?.addEventListener('click', hideHelpModal);
  $('#btnCloseHelpX')?.addEventListener('click', hideHelpModal);

  // Close on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal && !helpModal.hidden && helpModal.style.display !== 'none') {
      hideHelpModal();
    }
  });

  // Close when clicking outside modal box
  helpModal?.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      hideHelpModal();
    }
  });

  // Theme Toggle Button
  $('#btnTheme')?.addEventListener('click', () => {
    const root = document.documentElement;
    const isDark = (root.dataset.theme === 'dark') || (!root.dataset.theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const newTheme = isDark ? 'light' : 'dark';
    root.dataset.theme = newTheme;
    store.set('mq.theme', newTheme);
  });

  const savedTheme = store.get('mq.theme');
  if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
  }

  // Window Resize & Print Events
  window.addEventListener('resize', fitZoom);

  window.addEventListener('beforeprint', () => {
    const wrap = $('#pagesWrap');
    if (wrap) wrap.style.setProperty('--z', '1');
  });

  window.addEventListener('afterprint', () => {
    fitZoom();
  });
}

// Start app on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
