import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { init, setStep, reparse } from '../main.js';
import { state } from '../src/state.js';

describe('3-Step Idiot-Proof Flow & Interactive Features (Prompt 2 Part B)', () => {
  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    document.documentElement.innerHTML = html;

    const storage = {
      'mq.tourSeen': 'true'
    };
    global.localStorage = {
      getItem: (k) => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
    };

    window.print = vi.fn();
    window.scrollTo = vi.fn();

    init();
  });

  it('initializes in Step 1 with drop zone and privacy reassurance visible', () => {
    const step1 = document.querySelector('#step1');
    const step2 = document.querySelector('#step2');
    const step3 = document.querySelector('#step3');

    expect(step1.hidden).toBe(false);
    expect(step2.hidden).toBe(true);
    expect(step3.hidden).toBe(true);

    const stepBtn1 = document.querySelector('#stepBtn1');
    expect(stepBtn1.classList.contains('active')).toBe(true);

    const dropZone = document.querySelector('#dropZone');
    expect(dropZone).not.toBeNull();
    expect(dropZone.textContent).toContain('اسحب وأفلت الملفات هنا');
    expect(dropZone.textContent).toContain('ملفاتك مابتتبعتش لأي سيرفر');
  });

  it('navigates through Step 1 -> Step 2 -> Step 3 smoothly', () => {
    // 1. Move to Step 2
    const btnStep1Next = document.querySelector('#btnStep1Next');
    btnStep1Next.click();

    const step1 = document.querySelector('#step1');
    const step2 = document.querySelector('#step2');
    const step3 = document.querySelector('#step3');

    expect(step1.hidden).toBe(true);
    expect(step2.hidden).toBe(false);
    expect(step3.hidden).toBe(true);

    const stepBtn2 = document.querySelector('#stepBtn2');
    expect(stepBtn2.classList.contains('active')).toBe(true);

    // Verify Report Card rendered
    const reportCard = document.querySelector('#reportCardContainer .report-card');
    expect(reportCard).not.toBeNull();
    expect(reportCard.textContent).toContain('تقرير المعالجة الذكية');

    // 2. Move to Step 3
    const btnStep2Next = document.querySelector('#btnStep2Next');
    btnStep2Next.click();

    expect(step2.hidden).toBe(true);
    expect(step3.hidden).toBe(false);

    const stepBtn3 = document.querySelector('#stepBtn3');
    expect(stepBtn3.classList.contains('active')).toBe(true);

    // Verify Hero download buttons
    const btnQBig = document.querySelector('#btnPrintQBig');
    const btnABig = document.querySelector('#btnPrintABig');
    const btnBoth = document.querySelector('#btnPrintBoth');
    expect(btnQBig).not.toBeNull();
    expect(btnABig).not.toBeNull();
    expect(btnBoth).not.toBeNull();

    // Verify Print instructions guide
    const guide = document.querySelector('.print-guide-card');
    expect(guide).not.toBeNull();
    expect(guide.textContent).toContain('Save as PDF');
    expect(guide.textContent).toContain('Background graphics');

    // 3. Move back to Step 2
    const btnStep3Back = document.querySelector('#btnStep3Back');
    btnStep3Back.click();
    expect(step2.hidden).toBe(false);
    expect(step3.hidden).toBe(true);

    // 4. Move back to Step 1
    const btnStep2Back = document.querySelector('#btnStep2Back');
    btnStep2Back.click();
    expect(step1.hidden).toBe(false);
    expect(step2.hidden).toBe(true);
  });

  it('opens and closes the 30-second illustrated help modal', () => {
    const helpModal = document.querySelector('#helpModal');
    expect(helpModal.hidden).toBe(true);

    const btnHelp = document.querySelector('#btnHelp');
    btnHelp.click();
    expect(helpModal.hidden).toBe(false);
    expect(helpModal.textContent).toContain('في 30 ثانية');

    const btnCloseHelp = document.querySelector('#btnCloseHelp');
    btnCloseHelp.click();
    expect(helpModal.hidden).toBe(true);
  });

  it('supports in-page confirmation and 10-second undo for clear action', async () => {
    const rawEl = document.querySelector('#raw');
    const originalText = rawEl.value;
    expect(originalText.length).toBeGreaterThan(0);

    const btnClear = document.querySelector('#btnClear');
    btnClear.click();

    // In-page modal opens
    const confirmModal = document.querySelector('#confirmModal');
    expect(confirmModal.hidden).toBe(false);

    // Cancel first
    const btnCancel = document.querySelector('#btnConfirmCancel');
    btnCancel.click();
    expect(confirmModal.hidden).toBe(true);
    expect(rawEl.value).toBe(originalText);

    // Click clear again and confirm
    btnClear.click();
    const btnOk = document.querySelector('#btnConfirmOk');
    btnOk.click();
    await new Promise(r => setTimeout(r, 10));

    // Content cleared
    expect(rawEl.value).toBe('');

    // Undo toast appears
    const toastHost = document.querySelector('#toastHost');
    const undoBtn = toastHost.querySelector('#btnUndoAction');
    expect(undoBtn).not.toBeNull();

    // Click undo
    undoBtn.click();
    expect(rawEl.value).toBe(originalText);
  });

  it('provides one-click inline answer fixes in problems panel', () => {
    // Input question with no answer
    const rawEl = document.querySelector('#raw');
    rawEl.value = `
# Pharmacology
1- Drug of choice for anaphylactic shock is:
a) Epinephrine
b) Norepinephrine
c) Dopamine
d) Atropine
`;
    reparse();
    setStep(2);

    const probPanel = document.querySelector('#problemsPanelContainer');
    expect(probPanel.innerHTML).toContain('أسئلة مفيهاش إجابة صح');

    // Click option A inline fix button
    const fixBtn = probPanel.querySelector('button[data-action="set-ans"][data-ans="0"]');
    expect(fixBtn).not.toBeNull();
    fixBtn.click();

    // Verify question is now answered as 0 (A)
    const q = state.data.sections[0].qs[0];
    expect(q.ans).toBe(0);
  });
});
