// src/pdfExporter.js - Fast, 100% Client-Side Direct PDF Download Engine
import { state, getViewData } from './state.js';
import { renderPagesHTML } from './paper.js';
import { showToast } from './export.js';

let progressModal = null;

async function loadPdfLibs() {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([
    import('jspdf'),
    import('html2canvas')
  ]);
  const html2canvas = html2canvasMod.default || html2canvasMod;
  return { jsPDF, html2canvas };
}

function ensureProgressModal() {
  if (progressModal) return progressModal;
  progressModal = document.createElement('div');
  progressModal.className = 'pdf-progress-overlay';
  progressModal.id = 'pdfProgressOverlay';
  progressModal.hidden = true;
  progressModal.innerHTML = `
    <div class="pdf-progress-box">
      <div class="pdf-spinner"></div>
      <h3 id="pdfProgressTitle" class="pdf-progress-title">جارِ تجهيز ملف الـ PDF...</h3>
      <p id="pdfProgressDesc" class="pdf-progress-desc">يتم تجهيز الصفحات بجودة طباعة فائقة</p>
      <div class="pdf-bar-wrap">
        <div id="pdfProgressBar" class="pdf-bar-fill" style="width: 0%"></div>
      </div>
      <span id="pdfProgressPercent" class="pdf-percent-text">0%</span>
    </div>
  `;
  document.body.appendChild(progressModal);
  return progressModal;
}

function updateProgress(current, total, message) {
  const modal = ensureProgressModal();
  modal.hidden = false;
  const percent = Math.min(100, Math.round((current / total) * 100));
  const title = modal.querySelector('#pdfProgressTitle');
  const desc = modal.querySelector('#pdfProgressDesc');
  const bar = modal.querySelector('#pdfProgressBar');
  const percentText = modal.querySelector('#pdfProgressPercent');

  if (title && message) title.textContent = message;
  if (desc) desc.textContent = `صفحة ${current} من ${total}`;
  if (bar) bar.style.width = `${percent}%`;
  if (percentText) percentText.textContent = `${percent}%`;
}

function hideProgress() {
  if (progressModal) {
    progressModal.hidden = true;
  }
}

/**
 * Renders an array of HTML pages in an off-screen container at exact 1x A4 dimensions (no CSS zoom),
 * captures them with html2canvas, and returns an array of canvas images.
 */
async function capturePagesToCanvases(isAns, onPageProgress, startIndex = 0, totalPagesOverall = 1, html2canvas) {
  const htmlContent = renderPagesHTML(isAns);

  // Create isolated off-screen sandbox to avoid CSS zoom or sidebar layout effects
  const sandbox = document.createElement('div');
  sandbox.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;z-index:-100;opacity:0;pointer-events:none;background:#ffffff;';
  sandbox.innerHTML = htmlContent;
  document.body.appendChild(sandbox);

  // Force fonts to be ready
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Small delay for DOM layout and images
  await new Promise(r => setTimeout(r, 60));

  const pageEls = sandbox.querySelectorAll('.page');
  const canvases = [];

  for (let i = 0; i < pageEls.length; i++) {
    const pageEl = pageEls[i];
    const overallIndex = startIndex + i + 1;
    onPageProgress && onPageProgress(overallIndex, totalPagesOverall, isAns ? 'جارِ تجهيز ورقة الإجابات...' : 'جارِ تجهيز ورقة الأسئلة...');

    const canvas = await html2canvas(pageEl, {
      scale: 2, // 2x DPI gives crisp ~200-300 DPI text while maintaining small file size
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    canvases.push(canvas);
  }

  sandbox.remove();
  return canvases;
}

/**
 * Downloads a PDF directly in the browser without opening print dialogs
 * @param {'qs'|'as'|'both'} mode - 'qs' for questions, 'as' for answers, 'both' for questions + answers
 */
export async function downloadDirectPDF(mode = 'qs') {
  const sections = getViewData();
  if (!sections.length) {
    showToast('لا توجد أسئلة لتحميلها!');
    return;
  }

  const S = state.settings;
  const baseTitle = (S.title || 'Medscope').replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
  let filename = `${baseTitle}-questions.pdf`;
  if (mode === 'as') filename = `${baseTitle}-answers.pdf`;
  if (mode === 'both') filename = `${baseTitle}-complete-exam-and-answers.pdf`;

  ensureProgressModal();
  updateProgress(0, 1, 'جارِ تحميل محرك الـ PDF...');

  try {
    const { jsPDF, html2canvas } = await loadPdfLibs();

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    if (mode === 'qs') {
      updateProgress(0, 1, 'جارِ تجهيز ورقة الأسئلة...');
      const canvases = await capturePagesToCanvases(false, updateProgress, 0, 1, html2canvas);
      canvases.forEach((canvas, idx) => {
        if (idx > 0) doc.addPage('a4', 'portrait');
        const imgData = canvas.toDataURL('image/jpeg', 0.94);
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      });
    } else if (mode === 'as') {
      updateProgress(0, 1, 'جارِ تجهيز ورقة الإجابات...');
      const canvases = await capturePagesToCanvases(true, updateProgress, 0, 1, html2canvas);
      canvases.forEach((canvas, idx) => {
        if (idx > 0) doc.addPage('a4', 'portrait');
        const imgData = canvas.toDataURL('image/jpeg', 0.94);
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      });
    } else if (mode === 'both') {
      updateProgress(0, 2, 'جارِ تجهيز ورقة الأسئلة والإجابات...');
      const qCanvases = await capturePagesToCanvases(false, (curr, tot, msg) => {
        updateProgress(curr, tot + 2, 'تجهيز ورقة الأسئلة...');
      }, 0, 2, html2canvas);
      const aCanvases = await capturePagesToCanvases(true, (curr, tot, msg) => {
        updateProgress(qCanvases.length + curr, qCanvases.length + tot, 'تجهيز ورقة الإجابات...');
      }, qCanvases.length, qCanvases.length + 2, html2canvas);

      const allCanvases = [...qCanvases, ...aCanvases];
      allCanvases.forEach((canvas, idx) => {
        if (idx > 0) doc.addPage('a4', 'portrait');
        const imgData = canvas.toDataURL('image/jpeg', 0.94);
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      });
    }

    doc.save(filename);
    hideProgress();
    showToast('تم تحميل ملف الـ PDF بنجاح ✓');
  } catch (err) {
    console.error('Direct PDF download error:', err);
    hideProgress();
    showToast('حدث خطأ أثناء إنشاء ملف الـ PDF، جاري التحويل للطباعة العادية...');
    // Fallback to native print dialog
    setTimeout(() => {
      window.print();
    }, 400);
  }
}
