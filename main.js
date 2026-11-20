// main.js - Application Coordinator & 3-Step Flow Engine

import { parse, richLines, LET } from './src/parser.js';
import { parseDocument } from './src/essay/parseEssay.js';
import { state, store, SAMPLE_TEXT, syncLogoFromIDB } from './src/state.js';
import { renderPagesHTML, fitZoom } from './src/paper.js';
import { renderStats } from './src/stats.js';
import { buildSettingsUI } from './src/settings.js';
import { renderEditorHTML, bindEditorEvents } from './src/editor.js';
import { renderExportHTML, bindExportEvents, showToast } from './src/export.js';
import { downloadDirectPDF } from './src/pdfExporter.js';
import { processMultipleFiles } from './src/import/fileProcessor.js';
import { renderReportCardHTML, renderProblemsPanelHTML, bindProblemEvents, getProblemsData } from './src/problems.js';
import { SOCIAL_LINKS } from './src/config/links.js';

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
 * Updates the System Status Tag (Obsidian & Lime Spec Section 1 & 3)
 */
export function updateSystemStatusTag(statusOverride = null, dotClass = null) {
  const dot = $('#statusDot');
  const text = $('#statusText');
  if (!dot || !text) return;

  if (statusOverride) {
    text.textContent = statusOverride;
    dot.className = 'status-dot pulse ' + (dotClass || 'warn');
    return;
  }

  const sections = state.data?.sections || [];
  const allQs = sections.flatMap(s => s.qs);
  const totalQs = allQs.length;

  if (totalQs === 0) {
    text.textContent = 'IDLE';
    dot.className = 'status-dot idle';
  } else {
    const prob = getProblemsData();
    if (prob.totalProblemsCount > 0) {
      text.textContent = `REVIEW · ${prob.totalProblemsCount} ISSUES`;
      dot.className = 'status-dot pulse warn';
    } else {
      text.textContent = `READY · ${totalQs} Q`;
      dot.className = 'status-dot pulse ok';
    }
  }

  updateHeroFloatingStats(totalQs, sections.length, allQs);
}

/**
 * Updates drifting floating stats cards and cursor badge in Step 1 Hero
 */
function updateHeroFloatingStats(totalQs, subCount, allQs) {
  const floatQ = $('#heroFloatQ');
  const floatSub = $('#heroFloatSub');
  const floatAns = $('#heroFloatAns');
  const cursorText = $('#heroCursorText');

  if (floatQ) floatQ.textContent = totalQs > 0 ? String(totalQs) : '60';
  if (floatSub) floatSub.textContent = subCount > 0 ? String(subCount) : '5';

  if (floatAns) {
    const answered = allQs.filter(q => q.ans !== null).length;
    const pct = totalQs > 0 ? Math.round((answered / totalQs) * 100) : 100;
    floatAns.textContent = `${pct}%`;
  }

  if (cursorText && allQs && allQs.length > 0) {
    const sampleIdx = Math.min(13, allQs.length - 1);
    const q = allQs[sampleIdx];
    const letter = (q && q.ans !== null && LET[q.ans]) ? LET[q.ans] : 'a';
    const num = (q && q.num) ? q.num : (sampleIdx + 1);
    cursorText.textContent = `Q${num} · ${letter} ✓`;
  }
}

/**
 * Renders Social Links in Obsidian Footer
 */
function renderFooterSocialLinks() {
  const container = $('#socialLinksContainer');
  if (!container) return;

  const ICONS = {
    telegram: '✈️',
    facebook: '📘',
    instagram: '📷',
    youtube: '▶️'
  };

  const NAMES = {
    telegram: 'Telegram',
    facebook: 'Facebook',
    instagram: 'Instagram',
    youtube: 'YouTube'
  };

  const items = Object.entries(SOCIAL_LINKS)
    .filter(([_, url]) => url && url.trim().length > 0)
    .map(([key, url]) => `
      <a href="${url}" target="_blank" rel="noopener noreferrer" class="social-icon-circle" title="${NAMES[key] || key}">
        <span>${ICONS[key] || '🔗'}</span>
      </a>
    `)
    .join('');

  container.innerHTML = items || '<span style="font-size:12px;color:var(--text-muted)">قنوات التواصل قريبًا</span>';
}

/**
 * 3-Step Navigation Controller (Prompt 2 Part B1)
 */
export function setStep(stepNum) {
  activeStep = stepNum;

  // Update Stepper buttons
  $$('.step-btn').forEach(btn => {
    const s = +btn.dataset.step;
    btn.classList.toggle('active', s === stepNum);
    btn.classList.toggle('completed', s < stepNum);
    const check = btn.querySelector('.step-check');
    if (check) check.hidden = (s >= stepNum);
  });

  // Toggle Step panels
  const s1 = $('#step1');
  const s2 = $('#step2');
  const s3 = $('#step3');

  if (s1) s1.hidden = (stepNum !== 1);
  if (s2) s2.hidden = (stepNum !== 2);
  if (s3) s3.hidden = (stepNum !== 3);

  // Sync Mobile Sticky Bottom Thumb Action Bar (Prompt 6 Section 4)
  const mobileBar = $('#mobileBottomBar');
  const mobileBtn = $('#mobileMainActionBtn');
  const mobileActionText = $('#mobileActionText');
  const btnMobileSheet = $('#btnMobileToggleSheet');
  const mobileZoom = $('#mobileZoomBar');

  if (mobileBar && mobileBtn && mobileActionText) {
    if (stepNum === 1) {
      mobileActionText.textContent = 'كمّل: راجع الأسئلة';
      if (btnMobileSheet) btnMobileSheet.style.display = 'none';
      if (mobileZoom) mobileZoom.style.display = 'none';
      mobileBtn.onclick = () => setStep(2);
    } else if (stepNum === 2) {
      mobileActionText.textContent = 'كمّل: للشكل والتحميل';
      if (btnMobileSheet) btnMobileSheet.style.display = 'none';
      if (mobileZoom) mobileZoom.style.display = 'none';
      mobileBtn.onclick = () => setStep(3);
    } else if (stepNum === 3) {
      mobileActionText.textContent = 'تحميل ورقة الأسئلة مباشر';
      if (btnMobileSheet) btnMobileSheet.style.display = 'flex';
      if (mobileZoom) mobileZoom.style.display = 'flex';
      mobileBtn.onclick = () => downloadDirectPDF('qs');
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (stepNum === 2) {
    renderStep2();
  } else if (stepNum === 3) {
    renderStep3();
  }
}

/**
 * Renders Step 2 (Review, Bento Grid, Problems Panel, Editor)
 */
export function renderStep2() {
  const reportContainer = $('#reportCardContainer');
  const probContainer = $('#problemsPanelContainer');
  const editorHost = $('#editorHost');

  if (reportContainer) {
    reportContainer.innerHTML = renderReportCardHTML(
      currentFiles.length ? currentFiles.length : null,
      lastMergeMessage,
      currentFiles
    );
  }

  if (probContainer) {
    probContainer.innerHTML = renderProblemsPanelHTML();
    bindProblemEvents(() => {
      // Inline fix occurred -> re-serialize or re-parse
      syncFromState();
      renderStep2();
      renderStats();
      updateSystemStatusTag();
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
      },
      editorHost
    );
  }

  updateSystemStatusTag();
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

  updateSystemStatusTag();
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
    const qTypeMode = state.questionTypeMode || 'auto';
    state.data = parseDocument(rawVal, keyVal, { questionTypeMode: qTypeMode });
    store.set('mq.raw', rawVal);
    store.set('mq.key', keyVal);
    store.set('mq.savedAt', new Date().toISOString());
  } catch (err) {
    console.error('Parsing error:', err);
    showToast('حدث خطأ أثناء معالجة النص');
  }

  renderStats();
  renderView();
  updateSystemStatusTag();
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

  if (currentView === 'qs' || currentView === 'as' || currentView === 'spaces') {
    const isAnswers = (currentView === 'as');
    const originalSpace = state.settings.essayAnswerSpace;
    if (currentView === 'spaces' && state.settings.essayAnswerSpace === 'none') {
      state.settings.essayAnswerSpace = 'auto';
    }
    viewContainer.innerHTML = renderPagesHTML(isAnswers);
    state.settings.essayAnswerSpace = originalSpace;
    fitZoom();
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
      },
      viewContainer
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

/**
 * Switches the active view
 */
export function setView(viewName) {
  state.view = viewName;
  renderView();
}

/**
 * Switches to print mode for browser printing
 */
export function printMode(type) {
  const isAnswers = (type === 'as');
  state.view = type;
  renderView();

  setTimeout(() => {
    window.print();
  }, 100);
}

/**
 * Shows in-page confirmation modal (Prompt 2 Part B5b)
 */
export function confirmInPage(title, message) {
  return new Promise((resolve) => {
    const modal = $('#confirmModal');
    const titleEl = $('#confirmTitle');
    const msgEl = $('#confirmMessage');
    const btnOk = $('#btnConfirmOk');
    const btnCancel = $('#btnConfirmCancel');

    if (!modal || !titleEl || !msgEl || !btnOk || !btnCancel) {
      return resolve(window.confirm(`${title}\n\n${message}`));
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    modal.hidden = false;

    const cleanup = (result) => {
      modal.hidden = true;
      btnOk.onclick = null;
      btnCancel.onclick = null;
      resolve(result);
    };

    btnOk.onclick = () => cleanup(true);
    btnCancel.onclick = () => cleanup(false);
  });
}

/**
 * Shows an undo toast banner for destructive operations
 */
export function showUndoToast(msg, onUndo) {
  clearTimeout(undoTimer);
  const host = $('#toastHost');
  if (!host) return;

  const toast = document.createElement('div');
  toast.className = 'toast undo-toast';
  toast.innerHTML = `
    <span>${msg}</span>
    <button class="btn sm gold" id="btnUndoAction" style="margin-inline-start: 12px;">تراجع ↩</button>
  `;
  host.appendChild(toast);

  const btn = toast.querySelector('#btnUndoAction');
  if (btn) {
    btn.onclick = () => {
      clearTimeout(undoTimer);
      toast.remove();
      if (onUndo) onUndo();
      showToast('تم التراجع بنجاح ✓');
    };
  }

  undoTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 10000);
}

/**
 * Renders the File Cards list in Step 1 (Part A1)
 */
function renderFileCards() {
  const list = $('#fileCardsList');
  if (!list) return;

  if (currentFiles.length === 0) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = currentFiles.map((file, idx) => {
    const isFirst = (idx === 0);
    const isLast = (idx === currentFiles.length - 1);
    const sizeKB = (file.size / 1024).toFixed(1);

    let statusBadge = '';
    if (file.status === 'reading') {
      statusBadge = `<span class="file-status reading">جاري القراءة...</span>`;
    } else if (file.status === 'done') {
      statusBadge = `<span class="file-status done">جاهز ✓</span>`;
    } else if (file.status === 'failed') {
      statusBadge = `<span class="file-status failed" title="${file.errorMessage || ''}">فشل ✕</span>`;
    }

    const progressPercent = file.progress || (file.status === 'done' ? 100 : 0);

    return `
      <div class="file-card" data-idx="${idx}">
        <div class="file-card-drag">⋮⋮</div>
        <div class="file-card-icon">📄</div>
        <div class="file-card-info">
          <div class="file-card-name" title="${file.name}">${file.name}</div>
          <div class="file-card-meta">
            <span>${sizeKB} KB</span> • 
            <span>${file.extension.toUpperCase()}</span> • 
            ${statusBadge}
            ${file.statusMessage ? `<span class="file-status-msg">(${file.statusMessage})</span>` : ''}
          </div>
          ${file.status === 'reading' ? `
            <div class="file-progress-bar">
              <div class="file-progress-fill" style="width: ${progressPercent}%"></div>
            </div>
          ` : ''}
        </div>
        <div class="file-card-actions">
          <button class="btn-file-move" data-action="up" data-idx="${idx}" ${isFirst ? 'disabled' : ''} title="تحريك لأعلى">▲</button>
          <button class="btn-file-move" data-action="down" data-idx="${idx}" ${isLast ? 'disabled' : ''} title="تحريك لأسفل">▼</button>
          <button class="btn-file-remove" data-action="remove" data-idx="${idx}" title="حذف الملف">✕</button>
        </div>
      </div>
    `;
  }).join('');

  // Attach button events
  $$('.btn-file-move, .btn-file-remove', list).forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const idx = +btn.dataset.idx;

      if (action === 'up' && idx > 0) {
        const temp = currentFiles[idx];
        currentFiles[idx] = currentFiles[idx - 1];
        currentFiles[idx - 1] = temp;
        await reprocessAllFiles();
      } else if (action === 'down' && idx < currentFiles.length - 1) {
        const temp = currentFiles[idx];
        currentFiles[idx] = currentFiles[idx + 1];
        currentFiles[idx + 1] = temp;
        await reprocessAllFiles();
      } else if (action === 'remove') {
        currentFiles.splice(idx, 1);
        renderFileCards();
        if (currentFiles.length === 0) {
          const rawEl = $('#raw');
          if (rawEl) rawEl.value = '';
          reparse();
        } else {
          await reprocessAllFiles();
        }
      }
    };
  });
}

/**
 * Reprocesses loaded files after order change or deletion
 */
async function reprocessAllFiles() {
  if (currentFiles.length === 0) return;
  updateSystemStatusTag('READING...', 'warn');

  try {
    const rawFiles = currentFiles.map(cf => cf._rawFile).filter(Boolean);
    const result = await processMultipleFiles(rawFiles);
    lastMergeMessage = result.mergeMessage || '';
    const rawEl = $('#raw');
    if (rawEl) rawEl.value = result.mergedText;
    reparse();
    renderFileCards();
  } catch (err) {
    console.error('Reprocess error:', err);
    showToast('حدث خطأ أثناء إعادة ترتيب الملفات');
  }
}

/**
 * Handles newly dropped or selected files
 */
async function handleFilesUpload(filesList) {
  if (!filesList || filesList.length === 0) return;

  const validExts = ['.pdf', '.docx', '.txt', '.md', '.csv', '.png', '.jpg', '.jpeg'];
  const newFiles = Array.from(filesList).filter(f => {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    return validExts.includes(ext);
  });

  if (newFiles.length === 0) {
    showToast('الصيغة غير مدعومة. يدعم: PDF, DOCX, TXT, MD, CSV, صور');
    return;
  }

  const fileObjects = newFiles.map(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    return {
      name: f.name,
      size: f.size,
      extension: ext,
      status: 'reading',
      statusMessage: '',
      progress: 0,
      _rawFile: f
    };
  });

  currentFiles.push(...fileObjects);
  renderFileCards();
  updateSystemStatusTag(`READING 1/${fileObjects.length}`, 'warn');

  try {
    const rawFiles = currentFiles.map(cf => cf._rawFile).filter(Boolean);
    const result = await processMultipleFiles(rawFiles, (progress) => {
      const match = currentFiles.find(cf => cf.name === progress.fileName);
      if (match) {
        match.progress = progress.progress;
        match.status = progress.status;
        match.statusMessage = progress.message;
        renderFileCards();
      }
      updateSystemStatusTag(`READING ${progress.fileIndex + 1}/${progress.totalFiles}`, 'warn');
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
    updateSystemStatusTag('ERROR', 'warn');
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

  // Render footer social links from links.js
  renderFooterSocialLinks();

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

  // Next / Back Flow Buttons
  $('#btnStep1Next')?.addEventListener('click', () => setStep(2));
  $('#btnStep2Back')?.addEventListener('click', () => setStep(1));
  $('#btnStep2BackTop')?.addEventListener('click', () => setStep(1));
  $('#btnStep2Next')?.addEventListener('click', () => setStep(3));
  $('#btnStep2NextTop')?.addEventListener('click', () => setStep(3));
  $('#btnStep3Back')?.addEventListener('click', () => setStep(2));

  // Big Download Buttons in Step 3
  $('#btnPrintQBig')?.addEventListener('click', () => {
    downloadDirectPDF('qs');
  });

  $('#btnPrintABig')?.addEventListener('click', () => {
    downloadDirectPDF('as');
  });

  $('#btnPrintBoth')?.addEventListener('click', () => {
    downloadDirectPDF('both');
  });

  // Fallback to classic browser print dialog
  $('#btnBrowserPrintFallback')?.addEventListener('click', () => {
    printMode('qs');
  });

  // Drop Zone Drag & Drop and File Selection
  const dropZone = $('#dropZone');
  const fileInput = $('#fileInput');
  const btnBrowse = $('#btnBrowseFiles');

  if (dropZone && fileInput) {
    btnBrowse?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      handleFilesUpload(e.target.files);
      fileInput.value = '';
    });

    // Mobile Camera Capture Support (Prompt 6 Section 4)
    const cameraInput = $('#cameraInput');
    const btnCaptureCamera = $('#btnCaptureCamera');
    btnCaptureCamera?.addEventListener('click', (e) => {
      e.stopPropagation();
      cameraInput?.click();
    });
    cameraInput?.addEventListener('change', (e) => {
      handleFilesUpload(e.target.files);
      cameraInput.value = '';
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        handleFilesUpload(dt.files);
      }
    });

    // Support dropping files anywhere on window
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.target.closest('#dropZone')) return;
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesUpload(e.dataTransfer.files);
      }
    });
  }

  // Textarea input debouncing (250ms)
  const onInputDebounced = () => {
    clearTimeout(parseTimer);
    parseTimer = setTimeout(reparse, 250);
  };

  rawTextarea?.addEventListener('input', onInputDebounced);
  keyTextarea?.addEventListener('input', onInputDebounced);

  // Rich paste detection for red colored text
  rawTextarea?.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const html = cd.getData('text/html');
    if (!html) return;

    const red = richLines(html);
    if (red.length > 0) {
      e.preventDefault();
      const plain = cd.getData('text/plain') || '';
      const textLines = plain.split('\n');

      red.forEach(target => {
        const targetClean = target.replace(/[^a-z0-9]/gi, '').toLowerCase();
        for (let i = 0; i < textLines.length; i++) {
          const lineClean = textLines[i].replace(/[^a-z0-9]/gi, '').toLowerCase();
          if (lineClean.length > 3 && lineClean.includes(targetClean)) {
            if (!textLines[i].includes('✓') && !textLines[i].includes('*')) {
              textLines[i] = textLines[i].trimEnd() + ' ✓';
            }
          }
        }
      });

      const updatedText = textLines.join('\n');
      document.execCommand('insertText', false, updatedText);
      showToast(`تم اكتشاف ${red.length} إجابة صحيحة باللون الأحمر تلقائيًا ✓`);
    }
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

  // Question Type Mode Radio Buttons (Auto / All MCQ / All Essay)
  $$('input[name="qTypeMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.questionTypeMode = radio.value;
      reparse();
      showToast(`تم تغيير وضع الأسئلة إلى: ${radio.value === 'auto' ? 'تلقائي' : (radio.value === 'mcq' ? 'كله اختيار من متعدد' : 'كله مقالي')}`);
    });
  });

  // Paper View 3-Way Toggle (Questions / Answers / Spaces)
  $$('#paperViewToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#paperViewToggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const viewMode = btn.dataset.view;
      state.view = viewMode;
      renderView();
    });
  });

  // Print Buttons
  $('#btnPrintQ')?.addEventListener('click', () => printMode('qs'));
  $('#btnPrintA')?.addEventListener('click', () => printMode('as'));

  // Header Actions
  $('#btnSample')?.addEventListener('click', () => {
    loadSample();
    setStep(2);
  });

  // Clear Action Handler (Used by both Header and Footer CTA)
  const handleClearAll = async () => {
    const ok = await confirmInPage(
      'مسح جميع الأسئلة والمفاتيح',
      'هل أنت متأكد من مسح جميع النصوص والبدء من جديد؟ يمكنك التراجع خلال 10 ثوانٍ.'
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
      setStep(1);

      showUndoToast('تم مسح الكل بنجاح', () => {
        if (lastDeletedData) {
          if (rawTextarea) rawTextarea.value = lastDeletedData.raw;
          if (keyTextarea) keyTextarea.value = lastDeletedData.key;
          reparse();
        }
      });
    }
  };

  $('#btnClear')?.addEventListener('click', handleClearAll);
  $('#btnFooterNewSheet')?.addEventListener('click', handleClearAll);

  // Footer Links
  $('#footerHelpLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    showHelpModal();
  });

  $('#footerSampleLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    loadSample();
    setStep(2);
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

  // Mobile Bottom Sheet Toggle (Prompt 6 Section 4)
  const btnMobileSheet = $('#btnMobileToggleSheet');
  const studioSidebar = $('#studioSidebar');
  btnMobileSheet?.addEventListener('click', () => {
    if (studioSidebar) {
      studioSidebar.classList.toggle('sheet-open');
    }
  });

  // Mobile Floating Zoom Controls (Prompt 6 Section 4)
  const updateMobileZoomDisplay = () => {
    const lbl = $('#mobileZoomLevel');
    if (lbl) {
      const z = Math.round((state.settings?.zoom || 1) * 100);
      lbl.textContent = `${z}%`;
    }
  };

  $('#btnMobileZoomIn')?.addEventListener('click', () => {
    const cur = state.settings.zoom || 1;
    const next = Math.min(2.5, +(cur + 0.15).toFixed(2));
    state.settings.zoom = next;
    const wrap = $('#pagesWrap');
    if (wrap) wrap.style.setProperty('--z', next.toString());
    updateMobileZoomDisplay();
  });

  $('#btnMobileZoomOut')?.addEventListener('click', () => {
    const cur = state.settings.zoom || 1;
    const next = Math.max(0.3, +(cur - 0.15).toFixed(2));
    state.settings.zoom = next;
    const wrap = $('#pagesWrap');
    if (wrap) wrap.style.setProperty('--z', next.toString());
    updateMobileZoomDisplay();
  });

  $('#btnMobileZoomFit')?.addEventListener('click', () => {
    fitZoom();
    updateMobileZoomDisplay();
  });

  // In-App Browser Detection (Telegram, Instagram, Facebook) (Prompt 6 Section 4)
  const ua = navigator.userAgent || '';
  const isInApp = /FBAN|FBAV|Instagram|Telegram|Line|WhatsApp/i.test(ua);
  if (isInApp) {
    const inAppBanner = $('#inAppBanner');
    if (inAppBanner) inAppBanner.hidden = false;
    $('#btnCopyInAppLink')?.addEventListener('click', () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
      }
      showToast('تم نسخ الرابط! افتحه في متصفح خارجي (Chrome أو Safari) ✓');
    });
  }

  // Register Service Worker with Idle Background Caching (Prompt 6 Section 1)
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.update();

      const offlineTag = $('#offlineCacheTag');
      const offlineText = $('#offlineCacheText');
      const showOfflineStatus = (text) => {
        if (offlineTag && offlineText) {
          offlineTag.style.display = 'inline-flex';
          offlineText.textContent = text;
        }
      };

      if (store.get('mq.offlineCached') === 'true') {
        showOfflineStatus('جاهز للعمل بدون نت ✓');
      }

      // Schedule background caching only during idle periods, unless on saveData
      const triggerBackgroundCache = () => {
        const conn = navigator.connection;
        if (conn && (conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) {
          return;
        }
        if (store.get('mq.offlineCached') === 'true') return;
        if (reg.active) {
          reg.active.postMessage({ type: 'START_BACKGROUND_PRECACHE' });
        }
      };

      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(triggerBackgroundCache, { timeout: 4000 });
      } else {
        setTimeout(triggerBackgroundCache, 2500);
      }
    }).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (!event.data) return;
      const offlineTag = $('#offlineCacheTag');
      const offlineText = $('#offlineCacheText');
      if (event.data.type === 'OFFLINE_CACHE_PROGRESS') {
        if (offlineTag && offlineText) {
          offlineTag.style.display = 'inline-flex';
          offlineText.textContent = `جاري تجهيز الموقع للعمل بدون نت ${event.data.percent}%`;
        }
      } else if (event.data.type === 'OFFLINE_CACHE_COMPLETE') {
        store.set('mq.offlineCached', 'true');
        if (offlineTag && offlineText) {
          offlineTag.style.display = 'inline-flex';
          offlineText.textContent = 'جاهز للعمل بدون نت ✓';
        }
      }
    });
  }
}

// Start app on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
