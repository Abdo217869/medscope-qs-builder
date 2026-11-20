import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parseDocument } from '../src/essay/parseEssay.js';
import { getStemText, getPartText, getAnswerText } from '../src/essay/model.js';

describe('Prompt 5 Essay Parser & Classification Tests (Section 12 Fixture)', () => {
  const fixtureText = fs.readFileSync('tests/fixtures/essay-sample.txt', 'utf-8');
  const result = parseDocument(fixtureText);

  it('parses sections correctly without creating a question section for Answer Key', () => {
    expect(result.sections.length).toBe(2);
    expect(result.sections[0].name).toContain('Part 1: Prevention and Screening');
    expect(result.sections[1].name).toContain('Part 2: Surveillance');
  });

  it('parses exactly 8 total questions with correct counts per section', () => {
    const s1 = result.sections[0];
    const s2 = result.sections[1];
    expect(s1.qs.length).toBe(3); // Q1.1, Q1.2, Q1.3
    expect(s2.qs.length).toBe(5); // Q2.1, Q2.2, Q2.3, Q2.4, Q2.5
    const totalQs = s1.qs.length + s2.qs.length;
    expect(totalQs).toBe(8);
  });

  it('recognizes total marks = 13 (Q2.1 5 + Q2.3 2 + Q2.5 6)', () => {
    const s2 = result.sections[1];
    const q21 = s2.qs[0];
    const q23 = s2.qs[2];
    const q25 = s2.qs[4];

    expect(q21.marks).toBe(5);
    expect(q23.marks).toBe(2);
    expect(q25.marks).toBe(6);
    expect(result.totalMarks).toBe(13);
  });

  it('parses Q1.1 as match type with 6 sub-parts and run-in answers mapped to a-f', () => {
    const q = result.sections[0].qs[0];
    expect(q.label).toBe('Q1.1');
    expect(q.type).toBe('match');
    expect(q.parts.length).toBe(6);
    expect(q.parts[0].label).toBe('a');
    expect(q.parts[5].label).toBe('f');

    // Verify per-part answers split from single paragraph
    expect(q.parts[0].answer).toContain('Secondary prevention');
    expect(q.parts[1].answer).toContain('Primary: specific protection');
    expect(q.parts[2].answer).toContain('Tertiary: rehabilitation');
    expect(q.parts[3].answer).toContain('Primordial');
    expect(q.parts[4].answer).toContain('Primary: health promotion');
    expect(q.parts[5].answer).toContain('Primary: specific protection');
  });

  it('parses Q1.2 as short/classification type with 4 parts and run-in answers mapped', () => {
    const q = result.sections[0].qs[1];
    expect(q.label).toBe('Q1.2');
    expect(['short', 'essay', 'case']).toContain(q.type);
    expect(q.parts.length).toBe(4);
    expect(q.parts[0].answer).toContain('Case finding');
    expect(q.parts[1].answer).toContain('Periodic examination');
    expect(q.parts[2].answer).toContain('Diagnosis');
    expect(q.parts[3].answer).toContain('Screening');
  });

  it('parses Q1.3 as case type with 6 parts, table for part a, and 5 bullets for b-f', () => {
    const q = result.sections[0].qs[2];
    expect(q.label).toBe('Q1.3');
    expect(q.type).toBe('case');
    expect(q.parts.length).toBe(6);

    // Guard check: (c) and (e) inside part f must NOT be split into a new sub-part!
    const partF = q.parts[5];
    expect(partF.label).toBe('f');
    expect(partF.text).toContain('(c) and (e)');

    // Part a answer should be the 4x4 table
    expect(Array.isArray(q.parts[0].answer)).toBe(true);
    const tableBlock = q.parts[0].answer[0];
    expect(tableBlock.type).toBe('table');
    expect(tableBlock.rows.length).toBe(4);
    expect(tableBlock.rows[0]).toContain('Disease +');
    expect(tableBlock.rows[1]).toContain('170');

    // Parts b to f should have the 5 bullets in order
    expect(q.parts[1].answer).toContain('Sensitivity = 170/200 = 85%');
    expect(q.parts[2].answer).toContain('Predictive value positive = 170/260 = 65.4%');
    expect(q.parts[3].answer).toContain('False negative rate = 30/200 = 15%');
    expect(q.parts[4].answer).toContain('Community of 10,000 at 1% prevalence');
    expect(q.parts[5].answer).toContain('Interpretation: with identical sensitivity and specificity');
  });

  it('parses Q2.1 as essay/short with 5 marks and model answer', () => {
    const q = result.sections[1].qs[0];
    expect(q.label).toBe('Q2.1');
    expect(q.marks).toBe(5);
    expect(q.stem).not.toContain('(5 marks)'); // Marks cleaned from stem
    expect(q.stem).toContain('Define public health surveillance');
    expect(q.answer).toContain('Continuous, systematic collection');
  });

  it('parses Q2.2 as fill type with blanks and model answer', () => {
    const q = result.sections[1].qs[1];
    expect(q.label).toBe('Q2.2');
    expect(q.type).toBe('fill');
    expect(q.stem).toContain('______');
    expect(q.answer).toContain('Active: actively searches; passive: routine reporting.');
  });

  it('parses Q2.3 as tf type with 2 marks and False model answer', () => {
    const q = result.sections[1].qs[2];
    expect(q.label).toBe('Q2.3');
    expect(q.type).toBe('tf');
    expect(q.marks).toBe(2);
    expect(q.answer).toContain('False');
  });

  it('parses Q2.4 as MCQ with 4 options and correct option b (Measles, ans=1)', () => {
    const q = result.sections[1].qs[3];
    expect(q.label).toBe('Q2.4');
    expect(q.type).toBe('mcq');
    expect(q.opts.length).toBe(4);
    expect(q.opts[1]).toContain('Measles');
    expect(q.ans).toBe(1); // Option B is index 1
  });

  it('parses Q2.5 as compare type with 6 marks and table comparison model answer', () => {
    const q = result.sections[1].qs[4];
    expect(q.label).toBe('Q2.5');
    expect(q.type).toBe('compare');
    expect(q.marks).toBe(6);
    expect(q.answer).toContain('Primary: aims to prevent disease onset');
  });

  describe('Prompt 5 Acceptance 2 & 3: essay-sample.docx parsed via readDocx', () => {
    it('parses essay-sample.docx into identical sections, 8 questions, and mapped answers', async () => {
      const { readDocx } = await import('../src/import/readDocx.js');
      const docxBuf = fs.readFileSync('tests/fixtures/essay-sample.docx');
      const { text } = readDocx(docxBuf);
      const docxResult = parseDocument(text);

      expect(docxResult.sections.length).toBe(2);
      expect(docxResult.sections.reduce((sum, s) => sum + s.qs.length, 0)).toBe(8);
      expect(docxResult.totalMarks).toBe(13);

      const q13 = docxResult.sections[0].qs[2];
      expect(q13.label).toBe('Q1.3');
      expect(q13.type).toBe('case');
      expect(q13.parts.length).toBe(6);
      expect(q13.parts[0].answer[0].type).toBe('table');
      expect(q13.parts[1].answer).toContain('Sensitivity = 170/200');
      expect(q13.parts[5].answer).toContain('Interpretation:');
    });
  });
});
