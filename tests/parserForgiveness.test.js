import { describe, it, expect } from 'vitest';
import { parse, parseKey, normalizeDigits } from '../src/parser.js';

describe('Parser Forgiveness & Human Messy Input Tests (Part B3)', () => {
  it('converts Arabic-Indic digits to ASCII digits', () => {
    expect(normalizeDigits('١٢٣')).toBe('123');
    expect(normalizeDigits('سؤال ١٥: الإجابة ٤')).toBe('سؤال 15: الإجابة 4');
  });

  it('parses Arabic digits in question numbers and option keys', () => {
    const text = `
# الفسيولوجي
١- ما هو معدل ضربات القلب الطبيعي؟
أ) 60-100
ب) 120-150
ج) 40-50
د) 160-200
الإجابة: أ

٢- ما هو هرمون الغدة الدرقية؟
أ) الأنسولين
ب) الثيروكسين ✓
ج) الجلوكاجون
د) الأدرينالين
`;
    const res = parse(text);
    expect(res.sections.length).toBe(1);
    expect(res.sections[0].name).toBe('الفسيولوجي');
    expect(res.sections[0].qs.length).toBe(2);

    const q1 = res.sections[0].qs[0];
    expect(q1.num).toBe(1);
    expect(q1.opts.length).toBe(4);
    expect(q1.ans).toBe(0); // أ -> a -> 0

    const q2 = res.sections[0].qs[1];
    expect(q2.num).toBe(2);
    expect(q2.opts.length).toBe(4);
    expect(q2.ans).toBe(1); // ب -> b -> 1
  });

  it('parses Arabic letters as option labels (أ، ب، ج، د)', () => {
    const text = `
1. Primary pacemaker of the heart is:
أ) SA node ✓
ب) AV node
ج) Bundle of His
د) Purkinje fibers
`;
    const res = parse(text);
    expect(res.sections[0].qs.length).toBe(1);
    const q = res.sections[0].qs[0];
    expect(q.opts.length).toBe(4);
    expect(q.opts[0]).toBe('SA node');
    expect(q.ans).toBe(0);
  });

  it('handles glued options without spaces (a)text, a.text, a/text, [a]text)', () => {
    const text = `
1. Glued options test:
a)First option without space
b.Second option with dot and no space
c/Third option with slash
[d]Fourth option in brackets ✓
`;
    const res = parse(text);
    expect(res.sections[0].qs.length).toBe(1);
    const q = res.sections[0].qs[0];
    expect(q.opts.length).toBe(4);
    expect(q.opts[0]).toBe('First option without space');
    expect(q.opts[1]).toBe('Second option with dot and no space');
    expect(q.opts[2]).toBe('Third option with slash');
    expect(q.opts[3]).toBe('Fourth option in brackets');
    expect(q.ans).toBe(3);
  });

  it('handles Arabic question markers and prefixes (س1, س 1:, Question No. 1, 1/, 1 ))', () => {
    const text = `
س1: ما هو العضو المسؤول عن تصفية الدم؟
a) القلب
b) الكلى ✓
c) الرئة
d) الكبد

س 2- سؤال آخر:
a) خيار 1
b) خيار 2
c) خيار 3 ✓
d) خيار 4

Question No. 3: Another prefix test
a) Opt 1
b) Opt 2
c) Opt 3
d) Opt 4
Answer: d

4/ Question with slash
a) Opt A
b) Opt B ✓

5 ) Question with paren and space
a) Opt A ✓
b) Opt B
`;
    const res = parse(text);
    const qs = res.sections.flatMap(s => s.qs);
    expect(qs.length).toBe(5);
    expect(qs[0].num).toBe(1);
    expect(qs[0].ans).toBe(1);
    expect(qs[1].num).toBe(2);
    expect(qs[1].ans).toBe(2);
    expect(qs[2].num).toBe(3);
    expect(qs[2].ans).toBe(3);
    expect(qs[3].num).toBe(4);
    expect(qs[3].ans).toBe(1);
    expect(qs[4].num).toBe(5);
    expect(qs[4].ans).toBe(0);
  });

  it('detects multiple marked answers on a single question', () => {
    const text = `
1. Question with two marked answers:
a) First correct option ✓
b) Second option
c) Third correct option ✓
d) Fourth option
`;
    const res = parse(text);
    const q = res.sections[0].qs[0];
    expect(q.hasMultipleAnswers).toBe(true);
    expect(q.markedAnswers).toEqual([0, 2]);
  });

  it('collects unplaced lines', () => {
    const text = `
Random intro note before any question starts
Another unplaced line

1- What is hypertension?
a) High blood pressure ✓
b) Low blood pressure
`;
    const res = parse(text);
    expect(res.unplacedLines.length).toBeGreaterThanOrEqual(1);
    expect(res.unplacedLines).toContain('Random intro note before any question starts');
  });
});
