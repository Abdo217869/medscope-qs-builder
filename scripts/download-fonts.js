import fs from 'node:fs';
import path from 'node:path';

const fontsDir = path.resolve('public/fonts');
if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });

async function downloadFonts() {
  const url = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;600;700;800&family=Carlito:ital,wght@0,400;0,700;1,400&display=swap';
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  console.log('Fetching Google Fonts stylesheet...');
  const res = await fetch(url, { headers: { 'User-Agent': ua } });
  let css = await res.text();

  // Find all font URLs
  const urlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g;
  const urls = [];
  let m;
  while ((m = urlRegex.exec(css)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }

  console.log(`Found ${urls.length} font files to download.`);

  for (let i = 0; i < urls.length; i++) {
    const fontUrl = urls[i];
    const filename = `font-${i + 1}.woff2`;
    const targetPath = path.join(fontsDir, filename);

    if (!fs.existsSync(targetPath)) {
      console.log(`Downloading ${filename} from ${fontUrl}...`);
      const fontRes = await fetch(fontUrl);
      const buffer = Buffer.from(await fontRes.arrayBuffer());
      fs.writeFileSync(targetPath, buffer);
    }

    css = css.replace(fontUrl, `/fonts/${filename}`);
  }

  // Write local fonts.css
  const cssPath = path.resolve('src/styles/fonts.css');
  fs.writeFileSync(cssPath, css, 'utf-8');
  console.log(`Saved fonts.css (${css.length} bytes) and font files in public/fonts/`);
}

downloadFonts().catch(err => {
  console.error('Error downloading fonts:', err);
  process.exit(1);
});
