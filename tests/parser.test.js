import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parse, parseKey, richLines, LET } from '../src/parser.js';

describe('Medscope Parser Test Suite', () => {
  const end30Path = path.resolve(__dirname, '../samples/medscope-end30-with-answers.txt');
  const end30Raw = fs.readFileSync(end30Path, 'utf8');

  const epiPath = path.resolve(__dirname, '../samples/epidemiology_extracted.txt');
  const epiRaw = fs.readFileSync(epiPath, 'utf8');

  it('medscope-end30-with-answers.txt -> 60 questions, 5 subjects, all 60 answered', () => {
    const res = parse(end30Raw);
    expect(res.sections.length).toBe(5);

    const subjectCounts = res.sections.map(s => ({ name: s.name, count: s.qs.length }));
    expect(subjectCounts).toEqual([
      { name: 'Physiology', count: 10 },
      { name: 'Histology', count: 17 },
      { name: 'Biochemistry', count: 21 },
      { name: 'Anatomy', count: 4 },
      { name: 'Embryology', count: 8 },
    ]);

    const totalQs = res.sections.reduce((sum, s) => sum + s.qs.length, 0);
    expect(totalQs).toBe(60);

    const allQs = res.sections.flatMap(s => s.qs);
    const noAns = allQs.filter(q => q.ans == null);
    expect(noAns.length).toBe(0);
  });

  it('Medscope_End_Qs_30 questions text (without answers) -> 60 questions, 5 subjects', () => {
    // Strip checkmarks from end30 to simulate raw un-answered question sheet
    const cleanQsOnly = end30Raw.replace(/\s*✓/g, '');
    const res = parse(cleanQsOnly);

    expect(res.sections.length).toBe(5);
    const subjectCounts = res.sections.map(s => ({ name: s.name, count: s.qs.length }));
    expect(subjectCounts).toEqual([
      { name: 'Physiology', count: 10 },
      { name: 'Histology', count: 17 },
      { name: 'Biochemistry', count: 21 },
      { name: 'Anatomy', count: 4 },
      { name: 'Embryology', count: 8 },
    ]);

    const totalQs = res.sections.reduce((sum, s) => sum + s.qs.length, 0);
    expect(totalQs).toBe(60);

    // All should be un-answered before key
    const allQs = res.sections.flatMap(s => s.qs);
    expect(allQs.filter(q => q.ans == null).length).toBe(60);

    // Test external answer key parsing and application
    // Generate key pairs: 1-A, 2-B, ...
    const answersParsed = parse(end30Raw).sections.flatMap(s => s.qs);
    const keyString = answersParsed.map((q, i) => `${(i % 10) + 1}-${LET[q.ans].toUpperCase()}`).join(', ');

    const resWithKey = parse(cleanQsOnly, keyString);
    expect(resWithKey.keyPairs).toBeGreaterThan(0);
  });

  it('Epidemiology bank (Word text) -> 227 questions, 17 subjects, answer key auto-applied to all 227, 0 without answer', () => {
    const res = parse(epiRaw);
    expect(res.sections.length).toBe(17);

    const totalQs = res.sections.reduce((sum, s) => sum + s.qs.length, 0);
    expect(totalQs).toBe(227);

    expect(res.keyPairs).toBe(227);
    expect(res.keyUsed).toBe(227);

    const allQs = res.sections.flatMap(s => s.qs);
    const noAns = allQs.filter(q => q.ans == null);
    expect(noAns.length).toBe(0);

    expect(res.sections.map(s => s.name)).toEqual([
      'Levels of Prevention and Natural History',
      'Screening: Concepts, Uses and Types',
      'Criteria for Screening Programs and Screening Tests',
      'Sensitivity, Specificity and Predictive Values: Concepts',
      'Screening: Calculations',
      'Surveillance: Definition, Components, Case Definitions and Types',
      'Surveillance: Selection Criteria, Data Types and Uses',
      'Evaluation of Surveillance Systems',
      'Control, Elimination, Eradication and Extinction',
      'Features Favoring Eradication, Strategies and Points of Attack',
      'Poliomyelitis',
      'Measles, Neonatal Tetanus and Hepatitis C: Elimination',
      'Meningococcal Meningitis',
      'Enteric Fever (Typhoid and Paratyphoid)',
      'Hepatitis B',
      'Tetanus',
      'Integrated Questions',
    ]);
  });

  it('handles question prefixes and continuation lines like 8-year-old', () => {
    const text = `
# Pediatrics
1- A patient comes to clinic:
8-year-old child presents with severe cough and fever.
a) Pneumonia *
b) Asthma
c) Bronchitis
`;
    const res = parse(text);
    expect(res.sections.length).toBe(1);
    expect(res.sections[0].qs.length).toBe(1);
    const q = res.sections[0].qs[0];
    expect(q.stem).toContain('8-year-old child presents');
    expect(q.opts.length).toBe(3);
    expect(q.ans).toBe(0);
  });

  it('does not treat 5.5 mmol as a new question', () => {
    const text = `
1. Serum potassium measurement was:
5.5 mmol/L in an elderly patient.
a) Hyperkalemia ✓
b) Hypokalemia
c) Normal
`;
    const res = parse(text);
    expect(res.sections.length).toBe(1);
    expect(res.sections[0].qs.length).toBe(1);
    expect(res.sections[0].qs[0].stem).toContain('5.5 mmol/L');
    expect(res.sections[0].qs[0].ans).toBe(0);
  });

  it('handles various answer markers (*, ✓, answer line, explanation)', () => {
    const text = `
1- First question
a) Option 1
b) Option 2 [x]
c) Option 3

2- Second question
a) Option 1
*b) Option 2
c) Option 3

3- Third question
a) Option 1
b) Option 2
c) Option 3
Answer: c
Explanation: Detailed rationale here.

4- Fourth question
a) Option 1
b) Option 2
c) Option 3
الإجابة: أ
`;
    const res = parse(text);
    const qs = res.sections[0].qs;
    expect(qs.length).toBe(4);
    expect(qs[0].ans).toBe(1); // b)
    expect(qs[1].ans).toBe(1); // *b)
    expect(qs[2].ans).toBe(2); // Answer: c
    expect(qs[2].expl).toBe('Detailed rationale here.');
    expect(qs[3].ans).toBe(0); // الإجابة: أ
  });

  it('handles inline options: a) x b) y c) z', () => {
    const text = `
1- Which organ pumps blood?
a) Heart b) Lung c) Liver d) Kidney
Answer: a
`;
    const res = parse(text);
    expect(res.sections.length).toBe(1);
    const q = res.sections[0].qs[0];
    expect(q.opts).toEqual(['Heart', 'Lung', 'Liver', 'Kidney']);
    expect(q.ans).toBe(0);
  });

  it('removes junk headers repeated 3+ times', () => {
    const text = `
Header line - repeated 3 times
# Section 1
1- Question 1
a) A ✓
b) B
Header line - repeated 3 times
2- Question 2
a) A
b) B ✓
Header line - repeated 3 times
3- Question 3
a) A
b) B ✓
Header line - repeated 3 times
`;
    const res = parse(text);
    expect(res.sections[0].qs.length).toBe(3);
    expect(res.sections[0].qs[0].stem).toBe('Question 1');
  });

  it('skips blocks with fewer than 2 options without crashing', () => {
    const text = `
# Section 1
1- Incomplete question with only one option
a) Only one option

# Section 2
1- Valid question
a) Opt A
b) Opt B ✓
`;
    const res = parse(text);
    expect(res.skipped).toBe(1);
    expect(res.sections.length).toBe(1);
    expect(res.sections[0].qs.length).toBe(1);
    expect(res.sections[0].qs[0].stem).toBe('Valid question');
  });

  it('detects red colored text in rich paste', () => {
    const html = `
      <p>1- Which antibody crosses the placenta?</p>
      <p>a) IgM</p>
      <p><span style="color: rgb(200, 0, 0);">b) IgG</span></p>
      <p>c) IgA</p>
    `;
    const res = richLines(html);
    expect(res.anyRed).toBe(true);
    expect(res.text).toContain('b) IgG ✓');
  });
});
