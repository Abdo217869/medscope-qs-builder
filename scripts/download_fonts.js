// scripts/download_fonts.js
import https from 'https';
import fs from 'fs';
import path from 'path';

const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fetchUrl(url, binary = false) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': ua } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location, binary));
      }
      if (binary) {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      } else {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }
    });
  });
}

async function processFontFamily(familyUrl, prefix) {
  const css = await fetchUrl(familyUrl);
  // parse @font-face blocks
  const blocks = css.split('@font-face').filter(b => b.trim().length > 0);
  const results = [];
  let index = 0;

  for (const block of blocks) {
    const familyMatch = block.match(/font-family:\s*['"]?([^'";]+)['"]?/i);
    const weightMatch = block.match(/font-weight:\s*([^;]+)/i);
    const styleMatch = block.match(/font-style:\s*([^;]+)/i);
    const urlMatch = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/i);
    const rangeMatch = block.match(/unicode-range:\s*([^;]+)/i);
    const commentMatch = block.match(/\/\*\s*([^*]+)\s*\*\//);

    if (urlMatch && familyMatch) {
      index++;
      const fontUrl = urlMatch[1];
      const weight = weightMatch ? weightMatch[1].trim() : '400';
      const style = styleMatch ? styleMatch[1].trim() : 'normal';
      const subset = commentMatch ? commentMatch[1].trim().replace(/\s+/g, '-') : 'all';
      const filename = `${prefix}-${weight}-${style}-${subset}-${index}.woff2`;
      const localPath = path.join('public', 'fonts', filename);

      console.log(`Downloading ${filename} from ${fontUrl}...`);
      const buffer = await fetchUrl(fontUrl, true);
      fs.writeFileSync(localPath, buffer);

      const localRule = `@font-face {\n  font-family: '${familyMatch[1].trim()}';\n  font-style: ${style};\n  font-weight: ${weight};\n  font-display: swap;\n  src: url(/fonts/${filename}) format('woff2');\n  ${rangeMatch ? 'unicode-range: ' + rangeMatch[1].trim() + ';' : ''}\n}`;
      results.push(localRule);
    }
  }
  return results.join('\n\n');
}

async function main() {
  console.log('Downloading Space Grotesk...');
  const sgRules = await processFontFamily(
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
    'space-grotesk'
  );

  console.log('Downloading JetBrains Mono...');
  const jbRules = await processFontFamily(
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap',
    'jetbrains-mono'
  );

  console.log('Downloading Cairo (all weights)...');
  const cairoRules = await processFontFamily(
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap',
    'cairo'
  );

  const finalCss = `/* =========================================================\n   Self-Hosted Offline Fonts for Medscope Question Sheet Builder\n   Space Grotesk + JetBrains Mono + Cairo (all weights)\n   ========================================================= */\n\n${cairoRules}\n\n${sgRules}\n\n${jbRules}\n`;

  fs.writeFileSync('src/styles/fonts.css', finalCss);
  console.log('Successfully wrote src/styles/fonts.css and saved all fonts to public/fonts/');
}

main().catch(err => {
  console.error('Font download failed:', err);
  process.exit(1);
});
