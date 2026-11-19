import { describe, it, expect } from 'vitest';
import { paginate, A4_WIDTH, A4_HEIGHT } from '../src/paginate.js';
import { numLabel, letLabel, buildItems, paperVars, qHTML } from '../src/paper.js';
import { serializeQuestions } from '../src/editor.js';
import { state, getViewData, mulberry, shuffle } from '../src/state.js';

describe('App Modules Test Suite', () => {
  it('formats question numbers and option letters correctly', () => {
    expect(numLabel(1, '1-')).toBe('1-');
    expect(numLabel(2, '1.')).toBe('2.');
    expect(numLabel(3, '1)')).toBe('3)');
    expect(numLabel(4, 'Q1.')).toBe('Q4.');
    expect(numLabel(5, 'Q1)')).toBe('Q5)');

    expect(letLabel(0, 'a)')).toBe('a)');
    expect(letLabel(1, 'A.')).toBe('B.');
    expect(letLabel(2, '(a)')).toBe('(c)');
    expect(letLabel(3, 'A)')).toBe('D)');
  });

  it('renders question HTML differently for soft vs classic styles', () => {
    const q = { stem: 'Question text', opts: ['Opt 1', 'Opt 2'], ans: 0 };

    // Soft style: round badge with bare number, circle option with bare letter
    const softHTML = qHTML(q, 1, false, { theme: 'soft', numfmt: '1-', letter: 'a)', mark: 'color' });
    expect(softHTML).toContain('<span class="qn">1</span>');
    expect(softHTML).toContain('<span class="ol">a</span>');

    // Classic style: formatted label
    const classicHTML = qHTML(q, 1, false, { theme: 'classic', numfmt: '1-', letter: 'a)', mark: 'color' });
    expect(classicHTML).toContain('<span class="qn">1-</span>');
    expect(classicHTML).toContain('<span class="ol">a)</span>');
  });

  it('serializes questions back into text accurately', () => {
    const sampleSecs = [
      {
        name: 'Physiology',
        qs: [
          {
            stem: 'Homeostasis is regulated in?',
            opts: ['Extracellular fluid', 'Intracellular fluid'],
            ans: 0,
            expl: 'Extracellular fluid is correct'
          }
        ]
      }
    ];

    const serialized = serializeQuestions(sampleSecs);
    expect(serialized).toContain('# Physiology');
    expect(serialized).toContain('1- Homeostasis is regulated in?');
    expect(serialized).toContain('a) Extracellular fluid ✓');
    expect(serialized).toContain('b) Intracellular fluid');
    expect(serialized).toContain('Explanation: Extracellular fluid is correct');
  });

  it('mulberry RNG produces reproducible pseudo-random sequences for seed', () => {
    const rnd1 = mulberry(42);
    const rnd2 = mulberry(42);
    const seq1 = [rnd1(), rnd1(), rnd1()];
    const seq2 = [rnd2(), rnd2(), rnd2()];
    expect(seq1).toEqual(seq2);
  });

  it('skips shuffling options for questions with "all of the above" or "both"', () => {
    state.settings.shuffleO = true;
    state.settings.seed = 99;
    state.data.sections = [
      {
        name: 'Test',
        qs: [
          {
            stem: 'Which are correct?',
            opts: ['Option A', 'Option B', 'All of the above'],
            ans: 2
          }
        ]
      }
    ];

    const viewData = getViewData();
    expect(viewData[0].qs[0].opts).toEqual(['Option A', 'Option B', 'All of the above']);
    expect(viewData[0].qs[0].ans).toBe(2);
  });

  it('builds items for soft, classic, and minimal themes', () => {
    const sampleSecs = [
      {
        name: 'Pathology',
        qs: [
          {
            stem: 'Question stem',
            opts: ['A', 'B'],
            ans: 1
          }
        ]
      }
    ];

    ['soft', 'classic', 'minimal'].forEach(th => {
      const settings = {
        cover: true,
        title: 'Title',
        subtitle: 'Sub',
        by: 'By Me',
        joinText: 'Join',
        secPages: true,
        keyPage: true,
        theme: th,
        tint: true
      };

      const items = buildItems(sampleSecs, true, settings);
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].full).toBe(true); // Cover page
      if (th === 'soft') {
        expect(items[0].html).toContain('orn'); // Diamonds ornament ◆ ◆ ◆
      }
      expect(items.some(it => it.full && it.html.includes('Qs'))).toBe(true); // Section title page
      expect(items.some(it => it.full && it.html.includes('Answer Key'))).toBe(true); // Answer Key page
    });
  });

  it('paperVars generates proper CSS variables for warm tint and themes', () => {
    const softWarmVars = paperVars({ theme: 'soft', tint: true, qColor: '#1f4e79', ansColor: '#c00000', fs: 15 });
    expect(softWarmVars).toContain('--pb:#fffcf3');
    expect(softWarmVars).toContain('--qc:#1f4e79');
    expect(softWarmVars).toContain('--ac:#c00000');

    const classicVars = paperVars({ theme: 'classic', tint: false, fs: 15 });
    expect(classicVars).toContain('--pb:#fff');

    const minimalVars = paperVars({ theme: 'minimal', tint: false, fs: 14 });
    expect(minimalVars).toContain('--qc:#111111');
  });

  it('paginates full page items and flows content with theme measure class', () => {
    const items = [
      { full: true, html: '<h1>Cover</h1>' },
      { full: true, html: '<h1>Section Title</h1>' },
      { full: false, html: '<div style="height: 50px;">Question 1</div>' }
    ];

    const settings = { margin: 16, cols: 1, gap: 10, theme: 'soft' };
    const res = paginate(items, settings, '--fs:15');

    expect(res.pages.length).toBeGreaterThanOrEqual(3);
    expect(res.pages[0].full).toBeDefined();
    expect(res.pages[1].full).toBeDefined();
    expect(res.pages[2].cols).toBeDefined();
  });
});
