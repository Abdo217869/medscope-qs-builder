import fs from 'node:fs';
import path from 'node:path';

const publicDir = path.resolve('public');
const tessDir = path.join(publicDir, 'tesseract');
const pdfDir = path.join(publicDir, 'pdfjs');

if (!fs.existsSync(tessDir)) fs.mkdirSync(tessDir, { recursive: true });
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

async function bundleAssets() {
  console.log('Copying Tesseract worker and WASM core...');
  const tesseractJsDist = path.resolve('node_modules/tesseract.js/dist');
  const tesseractCore = path.resolve('node_modules/tesseract.js-core');
  const pdfjsDist = path.resolve('node_modules/pdfjs-dist/legacy/build');

  // Copy tesseract worker
  fs.copyFileSync(
    path.join(tesseractJsDist, 'worker.min.js'),
    path.join(tessDir, 'worker.min.js')
  );

  // Copy tesseract core files
  const coreFiles = [
    'tesseract-core.wasm.js',
    'tesseract-core.wasm',
    'tesseract-core-simd.wasm',
    'tesseract-core-lstm.wasm'
  ];

  for (const cf of coreFiles) {
    const src = path.join(tesseractCore, cf);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(tessDir, cf));
      console.log(`Copied ${cf}`);
    }
  }

  // Copy pdf.js worker
  if (fs.existsSync(path.join(pdfjsDist, 'pdf.worker.mjs'))) {
    fs.copyFileSync(
      path.join(pdfjsDist, 'pdf.worker.mjs'),
      path.join(pdfDir, 'pdf.worker.mjs')
    );
    console.log('Copied pdf.worker.mjs');
  }

  // Download English traineddata if not already present
  const langPath = path.join(tessDir, 'eng.traineddata.gz');
  if (!fs.existsSync(langPath)) {
    console.log('Downloading eng.traineddata.gz...');
    const langUrl = 'https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz';
    const res = await fetch(langUrl);
    if (!res.ok) throw new Error(`Failed to download traineddata: ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(langPath, buf);
    console.log(`Downloaded eng.traineddata.gz (${buf.length} bytes)`);
  }

  console.log('All offline assets bundled successfully into public/');
}

bundleAssets().catch(err => {
  console.error('Error bundling offline assets:', err);
  process.exit(1);
});
