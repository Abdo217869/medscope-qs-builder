import { describe, it, expect } from 'vitest';
import { parseDocument } from '../src/essay/parseEssay.js';
import { parse as parseMCQ } from '../src/parser.js';
import { buildItems } from '../src/paper.js';

describe('Lesson and Section Headings Detection', () => {
  it('correctly splits MCQs into sections when formatted by Arabic lessons (الدرس الأول / الثاني)', () => {
    const text = `
الدرس الأول: الجهاز الهضمي
1. ما هو الإنزيم المسئول عن هضم النشويات؟
أ) الأميليز
ب) الببسين
ج) التربسين
د) الليبيز
Answer: A

الدرس الثاني: الجهاز التنفسي
1. ما هو العضو الأساسي في تبادل الغازات؟
أ) الرئتين
ب) الكبد
ج) الكلى
د) القلب
Answer: A
`;

    const parsed = parseDocument(text, '', { questionTypeMode: 'auto' });
    expect(parsed.sections.length).toBe(2);
    expect(parsed.sections[0].name).toContain('الجهاز الهضمي');
    expect(parsed.sections[0].qs.length).toBe(1);
    expect(parsed.sections[1].name).toContain('الجهاز التنفسي');
    expect(parsed.sections[1].qs.length).toBe(1);

    // Verify section divider pages are built for both lessons
    const items = buildItems(parsed.sections, false, { secPages: true });
    const secCovers = items.filter(it => it.isSecCover);
    expect(secCovers.length).toBe(2);
    expect(secCovers[0].html).toContain('الجهاز الهضمي');
    expect(secCovers[1].html).toContain('الجهاز التنفسي');
  });

  it('correctly splits into sections when formatted with Arabic keywords (مادة / فصل / محاضرة / وحدة)', () => {
    const text = `
مادة: الفسيولوجي
1. What regulates homeostasis?
a) Extracellular fluid
b) Intracellular fluid
Answer: A

فصل: الهستولوجي
1. What is the tissue lining blood vessels?
a) Endothelium
b) Mesothelium
Answer: A

محاضرة: الكيمياء الحيوية
1. What is the storage form of glucose?
a) Glycogen
b) Starch
Answer: A
`;

    const parsed = parseDocument(text, '', { questionTypeMode: 'auto' });
    expect(parsed.sections.length).toBe(3);
    expect(parsed.sections.map(s => s.name)).toEqual(['الفسيولوجي', 'الهستولوجي', 'الكيمياء الحيوية']);
  });

  it('correctly handles English lessons (Lesson 1 / Topic 2 / Chapter 3 / Unit 4)', () => {
    const text = `
Lesson 1: Cardiovascular System
1. What is the normal pacemaker of the heart?
a) SA node
b) AV node
Answer: A

Lesson 2: Respiratory System
1. Where does gas exchange occur?
a) Alveoli
b) Bronchi
Answer: A
`;

    const parsed = parseDocument(text, '', { questionTypeMode: 'auto' });
    expect(parsed.sections.length).toBe(2);
    expect(parsed.sections[0].name).toContain('Cardiovascular System');
    expect(parsed.sections[1].name).toContain('Respiratory System');

    const items = buildItems(parsed.sections, false, { secPages: true });
    const secCovers = items.filter(it => it.isSecCover);
    expect(secCovers.length).toBe(2);
    expect(secCovers[0].html).toContain('Cardiovascular System');
    expect(secCovers[1].html).toContain('Respiratory System');
  });

  it('does NOT treat numbered lesson headings as questions (1. Levels of Prevention)', () => {
    const text = `
1. Levels of Prevention and Natural History
1. Which action is considered primordial prevention?
a) Taxing tobacco
b) Routine screening
Answer: A

2. Screening Concepts
1. What does sensitivity measure?
a) True positive rate
b) False positive rate
Answer: A
`;

    const parsed = parseDocument(text, '', { questionTypeMode: 'auto' });
    expect(parsed.sections.length).toBe(2);
    expect(parsed.sections[0].name).toContain('Levels of Prevention');
    expect(parsed.sections[0].qs.length).toBe(1);
    expect(parsed.sections[1].name).toContain('Screening Concepts');
    expect(parsed.sections[1].qs.length).toBe(1);
    const totalQs = parsed.sections.reduce((sum, s) => sum + s.qs.length, 0);
    expect(totalQs).toBe(2);
  });

  it('still parses essay-sample.txt correctly with both sections and 8 questions', () => {
    const fs = require('fs');
    const text = fs.readFileSync('tests/fixtures/essay-sample.txt', 'utf8');
    const parsed = parseDocument(text, '', { questionTypeMode: 'auto' });
    expect(parsed.sections.length).toBe(2);
    expect(parsed.sections[0].name).toContain('Part 1');
    expect(parsed.sections[1].name).toContain('Part 2');
    const totalQs = parsed.sections.reduce((sum, s) => sum + s.qs.length, 0);
    expect(totalQs).toBe(8);
  });
});
