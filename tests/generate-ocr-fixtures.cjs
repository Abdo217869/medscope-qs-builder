const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 750 } });

  // 1. essay-part1-q1-1-q1-2-dark.jpg
  const html1 = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <style>
        body {
          margin: 0;
          padding: 24px 20px;
          background-color: #1e1e1e;
          color: #e6e6e6;
          font-family: Calibri, 'Segoe UI', Arial, sans-serif;
          font-size: 15px;
          line-height: 1.5;
        }
        h2 {
          font-size: 18px;
          color: #ffffff;
          margin-top: 0;
          margin-bottom: 16px;
          font-weight: 700;
        }
        .q-stem {
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 8px;
        }
        ul {
          margin: 0 0 16px 0;
          padding-left: 20px;
        }
        li {
          margin-bottom: 6px;
        }
      </style>
    </head>
    <body>
      <h2>Part 1: Prevention and Screening</h2>
      <div class="q-stem"><b>Q1.1</b> Match each action to its level of prevention (primordial / health promotion / specific protection / secondary / tertiary-rehabilitation):</div>
      <ul>
        <li>a) Periodic deworming of school children in an endemic area</li>
        <li>b) Fortifying salt with iodine</li>
        <li>c) Vocational training for a worker who lost a limb</li>
        <li>d) School programs that stop unhealthy lifestyle risk factors from emerging in the first place</li>
        <li>e) Promoting exclusive breastfeeding</li>
        <li>f) Providing helmets to construction workers</li>
      </ul>
      <div class="q-stem"><b>Q1.2</b> Name the activity (screening / case finding / periodic examination / diagnosis) in each situation:</div>
      <ul>
        <li>a) Every pregnant woman attending the antenatal clinic is tested for HIV.</li>
        <li>b) An apparently healthy employee attends a yearly check-up with several system examinations and investigations.</li>
        <li>c) A teenager with sudden polyuria and weight loss has a fasting glucose test to confirm diabetes.</li>
        <li>d) A team visits a village and tests all adults for hepatitis C although nobody asked for care.</li>
      </ul>
    </body>
    </html>
  `;
  await page.setContent(html1);
  await page.screenshot({ path: path.join(__dirname, 'fixtures/ocr/essay-part1-q1-1-q1-2-dark.jpg'), type: 'jpeg', quality: 90 });
  console.log('Generated essay-part1-q1-1-q1-2-dark.jpg');

  // 2. essay-q1-3-dark.jpg (with floating UI widget on right edge)
  const html2 = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <style>
        body {
          margin: 0;
          padding: 24px 20px;
          background-color: #1e1e1e;
          color: #e6e6e6;
          font-family: Calibri, 'Segoe UI', Arial, sans-serif;
          font-size: 15px;
          line-height: 1.5;
          position: relative;
        }
        .q-stem {
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 12px;
        }
        ul {
          margin: 0 0 16px 0;
          padding-left: 20px;
        }
        li {
          margin-bottom: 8px;
        }
        .floating-widget {
          position: fixed;
          right: 4px;
          top: 45%;
          width: 32px;
          height: 70px;
          background: rgba(80, 80, 80, 0.7);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
      </style>
    </head>
    <body>
      <div class="q-stem"><b>Q1.3</b> A new rapid test for hepatitis C was evaluated against the gold standard in 2,000 adults. 200 had the disease. The test was positive in 170 of them. Among those without the disease 90 tested positive.</div>
      <ul>
        <li>a) Construct the 2x2 table.</li>
        <li>b) Calculate the sensitivity and specificity.</li>
        <li>c) Calculate the predictive value positive and predictive value negative.</li>
        <li>d) Calculate the false negative rate, false positive rate and accuracy.</li>
        <li>e) The same test is used in a community of 10,000 people with a disease prevalence of 1%. Complete the new table and calculate the predictive value positive.</li>
        <li>f) What does the difference between (c) and (e) show? What does it imply for the choice of screening program?</li>
      </ul>
      <div class="floating-widget">⋮</div>
    </body>
    </html>
  `;
  await page.setContent(html2);
  await page.screenshot({ path: path.join(__dirname, 'fixtures/ocr/essay-q1-3-dark.jpg'), type: 'jpeg', quality: 90 });
  console.log('Generated essay-q1-3-dark.jpg');

  // 3. essay-part7-answer-key-dark.jpg (with 2x2 table)
  const html3 = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <style>
        body {
          margin: 0;
          padding: 24px 20px;
          background-color: #1e1e1e;
          color: #e6e6e6;
          font-family: Calibri, 'Segoe UI', Arial, sans-serif;
          font-size: 14.5px;
          line-height: 1.5;
        }
        h2 {
          font-size: 17px;
          color: #ffffff;
          margin-top: 0;
          margin-bottom: 8px;
        }
        h3 {
          font-size: 15px;
          color: #cccccc;
          margin-top: 0;
          margin-bottom: 14px;
        }
        p {
          margin: 0 0 12px 0;
        }
        table {
          border-collapse: collapse;
          margin: 12px 0 16px 0;
          width: 90%;
          font-size: 13.5px;
        }
        th, td {
          border: 1px solid #555555;
          padding: 6px 10px;
          text-align: center;
        }
        th {
          background-color: #2a2a2a;
          color: #ffffff;
        }
        ul {
          margin: 0 0 16px 0;
          padding-left: 18px;
        }
        li {
          margin-bottom: 6px;
        }
      </style>
    </head>
    <body>
      <h2>Part 7: Answer Key</h2>
      <h3>Answers to Part 1: Prevention and Screening</h3>
      <p><b>Q1.1</b> a) Secondary prevention (mass treatment of the susceptible population against an endemic disease). b) Primary: specific protection (food fortification). c) Tertiary: rehabilitation (vocational). d) Primordial (prevents risk factors from emerging). e) Primary: health promotion (non-specific). f) Primary: specific protection.</p>
      <p><b>Q1.2</b> a) Case finding (testing people who attend care for another reason). b) Periodic examination (seeking care at intervals with no specific complaint). c) Diagnosis (symptomatic person, confirms or excludes disease). d) Screening (asymptomatic people, not requesting care).</p>
      <p><b>Q1.3</b></p>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Disease +</th>
            <th>Disease -</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Test +</th>
            <td>170</td>
            <td>90</td>
            <td>260</td>
          </tr>
          <tr>
            <th>Test -</th>
            <td>30</td>
            <td>1,710</td>
            <td>1,740</td>
          </tr>
          <tr>
            <th>Total</th>
            <td>200</td>
            <td>1,800</td>
            <td>2,000</td>
          </tr>
        </tbody>
      </table>
      <ul>
        <li>Sensitivity = 170/200 = 85%. Specificity = 1,710/1,800 = 95%.</li>
        <li>Predictive value positive = 170/260 = 65.4%. Predictive value negative = 1,710/1,740 = 98.3%.</li>
        <li>False negative rate = 30/200 = 15%. False positive rate = 90/1,800 = 5%. Accuracy = (170 + 1,710)/2,000 = 94%.</li>
      </ul>
    </body>
    </html>
  `;
  await page.setContent(html3);
  await page.screenshot({ path: path.join(__dirname, 'fixtures/ocr/essay-part7-answer-key-dark.jpg'), type: 'jpeg', quality: 90 });
  console.log('Generated essay-part7-answer-key-dark.jpg');

  await browser.close();
})();
