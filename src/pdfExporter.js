// src/pdfExporter.js - Fast, 100% Client-Side Direct PDF Download Engine
import { state, getViewData } from './state.js';
import { renderPagesHTML } from './paper.js';
import { showToast } from './export.js';
import { ProgressTask } from './progressTask.js';

async function loadPdfLibs() {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([
    import('jspdf'),
    import('html2canvas')
  ]);
  const html2canvas = html2canvasMod.default || html2canvasMod;
  return { jsPDF, html2canvas };
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

  let isCancelled = false;
  const progress = new ProgressTask({
    title: 'جارِ تجهيز محرك الـ PDF...',
    total: 1,
    onCancel: () => {
      isCancelled = true;
      showToast('تم إلغاء تصدير ملف الـ PDF');
    }
  });

  try {
    const { jsPDF, html2canvas } = await loadPdfLibs();
    if (isCancelled) return;

    const isMobile = (typeof window !== 'undefined' && window.innerWidth <= 768) ||
      (typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
    // 1.5x scale on mobile yields ~180 DPI with 56% less canvas memory and 2x faster render
    const scale = isMobile ? 1.5 : 2.0;

    // Gather pages to render
    const pageHtmlGroups = [];
    if (mode === 'qs') {
      pageHtmlGroups.push({ html: renderPagesHTML(false), label: 'ورقة الأسئلة' });
    } else if (mode === 'as') {
      pageHtmlGroups.push({ html: renderPagesHTML(true), label: 'ورقة الإجابات' });
    } else if (mode === 'both') {
      pageHtmlGroups.push({ html: renderPagesHTML(false), label: 'ورقة الأسئلة' });
      pageHtmlGroups.push({ html: renderPagesHTML(true), label: 'ورقة الإجابات' });
    }

    // Build off-screen sandbox
    const sandbox = document.createElement('div');
    sandbox.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;z-index:-100;opacity:0;pointer-events:none;background:#ffffff;';
    sandbox.innerHTML = pageHtmlGroups.map(g => g.html).join('');
    document.body.appendChild(sandbox);

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise(r => setTimeout(r, 60));

    const pageEls = sandbox.querySelectorAll('.page');
    const totalPages = pageEls.length;
    progress.update(0, totalPages, `بنجهّز ${totalPages} صفحة...`);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    let renderedCount = 0;
    for (let i = 0; i < totalPages; i++) {
      if (isCancelled) {
        sandbox.remove();
        return;
      }

      progress.update(i + 1, totalPages, `بنرسم صفحة ${i + 1} من ${totalPages}...`);
      // Yield to UI to keep frame rate high and avoid long tasks (> 50ms)
      await new Promise(r => setTimeout(r, 0));

      const pageEl = pageEls[i];
      const canvas = await html2canvas(pageEl, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      if (renderedCount > 0) {
        doc.addPage('a4', 'portrait');
      }
      renderedCount++;

      // JPEG quality 0.85 provides excellent readability with much smaller size
      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

      // Free canvas memory immediately
      canvas.width = 0;
      canvas.height = 0;
    }

    sandbox.remove();
    if (isCancelled) return;

    progress.update(totalPages, totalPages, 'بنجهّز ملف الـ PDF النهائي...');
    await new Promise(r => setTimeout(r, 20));

    const pdfBlob = doc.output('blob');
    const pdfSizeMB = (pdfBlob.size / 1024 / 1024).toFixed(1);
    const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

    // Mobile Web Share API support (Section 4)
    if (isMobile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: baseTitle,
          text: `ورقة امتحانات Medscope: ${filename}`
        });
        progress.done(`تمت المشاركة بنجاح ✓ (${pdfSizeMB} MB)`);
        showToast(`تمت المشاركة بنجاح ✓ (${pdfSizeMB} MB)`);
        return;
      } catch (shareErr) {
        if (shareErr.name === 'AbortError') {
          progress.destroy();
          return;
        }
      }
    }

    // Direct Blob download fallback
    const blobUrl = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

    progress.done(`تم التحميل بنجاح ✓ (${pdfSizeMB} MB)`);
    showToast(`تم تحميل ${filename} بنجاح ✓ (${pdfSizeMB} MB)`);
  } catch (err) {
    console.error('Direct PDF download error:', err);
    progress.cancel();
    showToast('حدث خطأ أثناء إنشاء ملف الـ PDF، جاري التحويل للطباعة العادية...');
    setTimeout(() => {
      window.print();
    }, 400);
  }
}
