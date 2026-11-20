const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Testing multi-lesson section divider pages...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('mq.tourSeen', 'true');
    localStorage.setItem('mq.tourSeen', '1');
  });

  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });

  // Dismiss help modal
  await page.evaluate(() => {
    const m = document.getElementById('helpModal');
    if (m) { m.hidden = true; m.style.display = 'none'; }
  });

  // Load sample -> Step 2
  await page.click('#btnSample');
  await page.waitForTimeout(500);

  // Set multi-lesson exam text in #raw
  const multiLessonText = `
الدرس الأول: الجهاز الهضمي
1. ما هو الإنزيم المسئول عن هضم النشويات في الفم؟
أ) الأميليز
ب) الببسين
ج) التربسين
د) الليبيز
Answer: A

2. أين يتم امتصاص معظم العناصر الغذائية؟
أ) الأمعاء الدقيقة
ب) المعدة
ج) الأمعاء الغليظة
د) المريء
Answer: A

الدرس الثاني: الجهاز التنفسي
1. ما هو العضو الأساسي في تبادل الغازات؟
أ) الرئتين
ب) الكبد
ج) الكلى
د) القلب
Answer: A

الدرس الثالث: الجهاز الدوري
1. كم عدد حجرات القلب في الإنسان؟
أ) 4 حجرات
ب) 2 حجرتان
ج) 3 حجرات
د) 5 حجرات
Answer: A
`;

  await page.evaluate((text) => {
    const r = document.getElementById('raw');
    if (r) {
      r.value = text;
      r.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, multiLessonText);
  await page.waitForTimeout(600);

  // Advance to Step 3
  await page.click('#btnStep2NextTop');
  await page.waitForTimeout(1000);

  // Ensure secPages is true
  await page.evaluate(() => {
    const chk = document.querySelector('input[type="checkbox"][data-key="secPages"]');
    if (chk && !chk.checked) {
      chk.checked = true;
      chk.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.waitForTimeout(800);

  // Inspect the section divider pages generated
  const secTitles = await page.$$eval('.section-cover-page h1', els => els.map(el => el.textContent.trim()));
  console.log('Generated Section Cover Pages (' + secTitles.length + '):', secTitles);

  const questionStems = await page.$$eval('.q-stem', els => els.map(el => el.textContent.trim()));
  console.log('Rendered Questions (' + questionStems.length + '):');
  questionStems.forEach((q, idx) => console.log('  Q' + (idx + 1) + ':', q));

  // Check if any lesson title was mistakenly treated as a question stem
  const isLessonInQuestions = questionStems.some(q => q.includes('الدرس الأول') || q.includes('الدرس الثاني') || q.includes('الدرس الثالث'));
  console.log('Was any lesson title treated as a question?', isLessonInQuestions ? 'YES (BUG!)' : 'NO (CORRECT!)');

  const artifactPath = path.resolve('C:/Users/dell/.gemini/antigravity/brain/77b868b9-918e-4f51-8b04-78d4a107ed98/verified-lessons-sections.png');
  await page.screenshot({ path: artifactPath, fullPage: false });
  console.log('Saved screenshot to:', artifactPath);

  await browser.close();
  console.log('Multi-lesson verification complete!');
})();
