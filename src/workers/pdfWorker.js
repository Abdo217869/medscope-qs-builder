// src/workers/pdfWorker.js
import { PDFDocument } from 'pdf-lib';

let currentDoc = null;
let pageSizePt = [595.28, 841.89]; // Default A4 portrait (points)
let taskQueue = Promise.resolve();

async function handleMessage(type, payload) {
  if (type === 'INIT') {
    currentDoc = await PDFDocument.create();
    currentDoc.setTitle(payload.title || 'Medscope Examination');
    currentDoc.setAuthor('Medscope');
    currentDoc.setProducer('Medscope Question Sheet Builder');
    if (payload.pageSizePt) {
      pageSizePt = payload.pageSizePt;
    }
    self.postMessage({ type: 'INIT_OK' });
  } else if (type === 'ADD_PAGE') {
    if (!currentDoc) {
      throw new Error('PDFDocument not initialized');
    }

    const { imageBuffer, widthPt, heightPt } = payload;
    const uint8 = new Uint8Array(imageBuffer);
    const embeddedJpg = await currentDoc.embedJpg(uint8);

    const pageW = widthPt || pageSizePt[0];
    const pageH = heightPt || pageSizePt[1];
    const page = currentDoc.addPage([pageW, pageH]);

    page.drawImage(embeddedJpg, {
      x: 0,
      y: 0,
      width: pageW,
      height: pageH
    });

    self.postMessage({ type: 'PAGE_ADDED', pageIndex: payload.pageIndex });
  } else if (type === 'FINISH') {
    if (!currentDoc) {
      throw new Error('PDFDocument not initialized');
    }

    const pdfBytes = await currentDoc.save({ useObjectStreams: true });
    currentDoc = null;

    // Transfer the Uint8Array buffer without copying
    self.postMessage(
      { type: 'DONE', pdfBuffer: pdfBytes.buffer },
      [pdfBytes.buffer]
    );
  } else if (type === 'CANCEL') {
    currentDoc = null;
    self.postMessage({ type: 'CANCELLED' });
  }
}

self.onmessage = (e) => {
  const { type, payload } = e.data;
  taskQueue = taskQueue
    .then(() => handleMessage(type, payload))
    .catch((err) => {
      self.postMessage({ type: 'ERROR', error: err.message || String(err) });
    });
};
