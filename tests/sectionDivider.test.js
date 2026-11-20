import { describe, it, expect } from 'vitest';
import { buildItems } from '../src/paper.js';

describe('Section Divider Page English Auto-Detection', () => {
  it('automatically displays "Part 1" instead of "القسم الأول" for English exams', () => {
    const secs = [{
      name: 'القسم الأول',
      qs: [{ stem: 'What is the primary function of insulin?', opts: ['A', 'B'] }]
    }];
    const items = buildItems(secs, false, { secPages: true });
    const secCover = items.find(it => it.isSecCover);
    expect(secCover).toBeDefined();
    expect(secCover.html).toContain('<h1>Part 1</h1>');
    expect(secCover.html).not.toContain('القسم الأول');
  });

  it('keeps Arabic "القسم الأول" when exam questions are Arabic', () => {
    const secs = [{
      name: 'القسم الأول',
      qs: [{ stem: 'ما هي الوظيفة الأساسية للأنسولين؟', opts: ['أ', 'ب'] }]
    }];
    const items = buildItems(secs, false, { secPages: true });
    const secCover = items.find(it => it.isSecCover);
    expect(secCover).toBeDefined();
    expect(secCover.html).toContain('<h1>القسم الأول</h1>');
  });

  it('honors secPageTitleOverride setting', () => {
    const secs = [{
      name: 'القسم الأول',
      qs: [{ stem: 'What is the primary function of insulin?', opts: ['A', 'B'] }]
    }];
    const items = buildItems(secs, false, { secPages: true, secPageTitleOverride: 'Physiology Module' });
    const secCover = items.find(it => it.isSecCover);
    expect(secCover).toBeDefined();
    expect(secCover.html).toContain('<h1>Physiology Module</h1>');
  });

  it('omits <div class="qs"> when secPageSub is "none"', () => {
    const secs = [{
      name: 'Part 1',
      qs: [{ stem: 'What is the primary function of insulin?', opts: ['A', 'B'] }]
    }];
    const items = buildItems(secs, false, { secPages: true, secPageSub: 'none' });
    const secCover = items.find(it => it.isSecCover);
    expect(secCover).toBeDefined();
    expect(secCover.html).not.toContain('<div class="qs">');
  });
});
