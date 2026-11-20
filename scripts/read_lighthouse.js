import fs from 'fs';
const data = JSON.parse(fs.readFileSync('test-artifacts/lighthouse-report.json', 'utf-8'));
const categories = data.categories;
console.log('=== Lighthouse Mobile Scores on Production Build ===');
for (const [key, cat] of Object.entries(categories)) {
  console.log(cat.title + ': ' + Math.round(cat.score * 100));
}
