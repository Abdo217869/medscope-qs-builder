import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { init, setView, reparse } from '../main.js';
import { state } from '../src/state.js';

describe('End-to-End DOM Integration Test', () => {
  beforeEach(() => {
    // Read index.html and set up DOM
    const htmlPath = path.resolve(__dirname, '../index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    document.documentElement.innerHTML = html;

    // Mock localStorage
    const storage = {};
    global.localStorage = {
      getItem: (k) => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
    };

    // Mock window.print
    window.print = vi.fn();

    // Initialize application
    init();
  });

  it('renders application with all UI components initialized', () => {
    // 1. Verify Top Header
    const brandTitle = document.querySelector('.brand-title');
    expect(brandTitle).not.toBeNull();
    expect(brandTitle.textContent).toBe('MEDSCOPE');

    const brandLogo = document.querySelector('.brand-logo-img');
    expect(brandLogo).not.toBeNull();
    expect(brandLogo.getAttribute('src')).toBe('/medscope-eagle.svg');

    // 2. Verify Sidebar Tabs
    const tabs = document.querySelectorAll('.tabs-nav button');
    expect(tabs.length).toBe(3);

    // 3. Verify Default Sample Text in #raw
    const rawTextarea = document.querySelector('#raw');
    expect(rawTextarea).not.toBeNull();
    expect(rawTextarea.value).toContain('Physiology');
    expect(rawTextarea.value).toContain('Homeostasis');

    // 4. Verify Status Chips
    const chips = document.querySelector('#chips');
    expect(chips.innerHTML).toContain('سؤال');
    expect(chips.innerHTML).toContain('مادة');

    // 5. Verify Toolbar and Views (Exactly 4 views: qs, as, edit, exp - no quiz)
    const viewButtons = document.querySelectorAll('#views button');
    expect(viewButtons.length).toBe(4);
    const viewIds = Array.from(viewButtons).map(b => b.dataset.v);
    expect(viewIds).toEqual(['qs', 'as', 'edit', 'exp']);

    // 6. Verify Paper Rendered on Stage with Soft theme default
    const pagesWrap = document.querySelector('#pagesWrap');
    expect(pagesWrap).not.toBeNull();
    const pages = pagesWrap.querySelectorAll('.page');
    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0].classList.contains('t-soft')).toBe(true);

    // Verify paper headers and footers
    const header = pagesWrap.querySelector('.hdr');
    expect(header).not.toBeNull();
    expect(header.textContent).toContain('Dr Omar Medhat - Medscope Meetings');

    const watermark = pagesWrap.querySelector('.wm');
    expect(watermark).not.toBeNull();
    expect(watermark.textContent).toContain('MEDSCOPE');
  });

  it('switches views correctly between questions, answers, editor, and export', () => {
    const viewContainer = document.querySelector('#view');

    // 1. Switch to Answers view
    setView('as');
    const btnAs = document.querySelector('button[data-v="as"]');
    expect(btnAs.getAttribute('aria-pressed')).toBe('true');
    expect(viewContainer.querySelector('.pages-wrap')).not.toBeNull();
    // In answers sheet, correct options have .ok class
    expect(viewContainer.querySelector('.o.ok')).not.toBeNull();

    // 2. Switch to Editor view
    setView('edit');
    const btnEdit = document.querySelector('button[data-v="edit"]');
    expect(btnEdit.getAttribute('aria-pressed')).toBe('true');
    expect(viewContainer.querySelectorAll('.ecard').length).toBeGreaterThan(0);
    expect(viewContainer.querySelector('#btnSync')).not.toBeNull();

    // 3. Switch to Export view
    setView('exp');
    const btnExp = document.querySelector('button[data-v="exp"]');
    expect(btnExp.getAttribute('aria-pressed')).toBe('true');
    expect(viewContainer.querySelectorAll('.xcard').length).toBe(8); // 8 export formats (including Markdown)
  });

  it('supports editing and reverse-syncing to textarea in editor mode', () => {
    setView('edit');
    const viewContainer = document.querySelector('#view');

    const stemInput = viewContainer.querySelector('.ecard-stem');
    expect(stemInput).not.toBeNull();
    stemInput.value = 'Updated Question Stem by User';
    stemInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Click Sync button
    const btnSync = viewContainer.querySelector('#btnSync');
    btnSync.click();

    const rawTextarea = document.querySelector('#raw');
    expect(rawTextarea.value).toContain('Updated Question Stem by User');
  });

  it('triggers browser print dialog when clicking print buttons', async () => {
    const btnPrintQ = document.querySelector('#btnPrintQ');
    const btnPrintA = document.querySelector('#btnPrintA');

    expect(btnPrintQ).not.toBeNull();
    expect(btnPrintA).not.toBeNull();
    btnPrintQ.click();
    await new Promise(r => setTimeout(r, 250));
    expect(window.print).toHaveBeenCalledTimes(1);

    btnPrintA.click();
    await new Promise(r => setTimeout(r, 250));
    expect(window.print).toHaveBeenCalledTimes(2);
  });

  it('toggles light/dark theme', () => {
    const themeBtn = document.querySelector('#btnTheme');
    expect(themeBtn).not.toBeNull();

    themeBtn.click();
    const theme = document.documentElement.dataset.theme;
    expect(theme === 'light' || theme === 'dark').toBe(true);
  });
});
