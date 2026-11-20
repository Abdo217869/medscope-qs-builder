import { describe, it, expect } from 'vitest';
import { buildItems } from '../src/paper.js';

describe('Individual Section Divider Controls (Prompt 9)', () => {
  it('allows disabling divider page for a specific section while keeping others active', () => {
    const secs = [
      {
        name: 'Part 1',
        secPageEnabled: true,
        qs: [{ stem: 'Question 1', opts: ['A', 'B'] }]
      },
      {
        name: 'Part 2',
        secPageEnabled: false, // Explicitly turned off for Section 2
        qs: [{ stem: 'Question 2', opts: ['A', 'B'] }]
      },
      {
        name: 'Part 3',
        secPageEnabled: true,
        qs: [{ stem: 'Question 3', opts: ['A', 'B'] }]
      }
    ];

    const items = buildItems(secs, false, { secPages: true });
    const secCovers = items.filter(it => it.isSecCover);

    expect(secCovers.length).toBe(2);
    expect(secCovers[0].html).toContain('<h1>Part 1</h1>');
    expect(secCovers[1].html).toContain('<h1>Part 3</h1>');
    // Part 2 should NOT have a cover page
    expect(secCovers.some(c => c.html.includes('Part 2'))).toBe(false);
  });

  it('supports per-section custom title overrides', () => {
    const secs = [
      {
        name: 'Part 1',
        secPageTitle: 'Custom Physiology Module',
        qs: [{ stem: 'Q1', opts: ['A', 'B'] }]
      },
      {
        name: 'Part 2',
        secPageTitle: 'Renal Anatomy',
        qs: [{ stem: 'Q2', opts: ['A', 'B'] }]
      }
    ];

    const items = buildItems(secs, false, { secPages: true });
    const secCovers = items.filter(it => it.isSecCover);

    expect(secCovers.length).toBe(2);
    expect(secCovers[0].html).toContain('<h1>Custom Physiology Module</h1>');
    expect(secCovers[1].html).toContain('<h1>Renal Anatomy</h1>');
  });

  it('supports per-section custom subtitles and "none" to hide', () => {
    const secs = [
      {
        name: 'Part 1',
        secPageSub: 'High Yield Review',
        qs: [{ stem: 'Q1', opts: ['A', 'B'] }]
      },
      {
        name: 'Part 2',
        secPageSub: 'none',
        qs: [{ stem: 'Q2', opts: ['A', 'B'] }]
      }
    ];

    const items = buildItems(secs, false, { secPages: true });
    const secCovers = items.filter(it => it.isSecCover);

    expect(secCovers.length).toBe(2);
    expect(secCovers[0].html).toContain('<div class="qs">High Yield Review</div>');
    expect(secCovers[1].html).not.toContain('<div class="qs">');
  });
});
