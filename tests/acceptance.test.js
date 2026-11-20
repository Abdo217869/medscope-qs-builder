import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { readDocx } from '../src/import/readDocx.js';
import { readPdf } from '../src/import/readPdf.js';
import { mergeFiles } from '../src/import/merge.js';
import { parse } from '../src/parser.js';

describe('Part C Acceptance Tests', () => {
  const samplesDir = path.resolve(__dirname, '../samples');

  // Test 1: Drop Epidemiology .docx
  it('Acceptance 1: Epidemiology .docx -> 227 Qs, 17 subjects, 227 with answers', async () => {
    const docxPath = path.join(samplesDir, 'Epidemiology of Infectious Diseases MCQ Question Bank.docx');
    const buf = fs.readFileSync(docxPath);
    const res = await readDocx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    
    expect(res.text.length).toBeGreaterThan(10000);
    const parsed = parse(res.text);
    const totalQs = parsed.sections.reduce((a, s) => a + s.qs.length, 0);
    const withAns = parsed.sections.flatMap(s => s.qs).filter(q => q.ans !== null).length;

    expect(totalQs).toBe(227);
    expect(parsed.sections.length).toBe(17);
    expect(withAns).toBe(227);
  });

  // Test 2: Drop Epidemiology .pdf
  it('Acceptance 2: Epidemiology .pdf -> 227 Qs, 17 subjects, 227 with answers', async () => {
    const pdfPath = path.join(samplesDir, 'Epidemiology of Infectious Diseases MCQ Question Bank (1).pdf');
    const buf = fs.readFileSync(pdfPath);
    const res = await readPdf(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

    expect(res.text.length).toBeGreaterThan(10000);
    const parsed = parse(res.text);
    const totalQs = parsed.sections.reduce((a, s) => a + s.qs.length, 0);
    const withAns = parsed.sections.flatMap(s => s.qs).filter(q => q.ans !== null).length;

    expect(totalQs).toBe(227);
    expect(parsed.sections.length).toBe(17);
    expect(withAns).toBe(227);
  }, 15000);

  // Test 3: Drop Medscope End Qs 30.pdf alone
  it('Acceptance 3: Medscope End Qs 30.pdf alone -> 60 Qs, 5 subjects, 60 without answers', async () => {
    const pdfPath = path.join(samplesDir, 'Medscope End Qs 30.pdf');
    const buf = fs.readFileSync(pdfPath);
    const res = await readPdf(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

    const parsed = parse(res.text);
    const totalQs = parsed.sections.reduce((a, s) => a + s.qs.length, 0);
    const withAns = parsed.sections.flatMap(s => s.qs).filter(q => q.ans !== null).length;

    expect(totalQs).toBe(60);
    expect(parsed.sections.length).toBe(5);
    expect(withAns).toBe(0);
    expect(parsed.sections.map(s => s.name)).toEqual([
      'Physiology', 'Histology', 'Biochemistry', 'Anatomy', 'Embryology'
    ]);
  });

  // Test 4: Drop Medscope End Qs 30.pdf AND Medscope End As 30.pdf together
  it('Acceptance 4: Merged Qs + As -> 60 Qs (not 120), 60 with answers', async () => {
    const qsPath = path.join(samplesDir, 'Medscope End Qs 30.pdf');
    const asPath = path.join(samplesDir, 'Medscope End As 30.pdf');

    const bufQs = fs.readFileSync(qsPath);
    const bufAs = fs.readFileSync(asPath);

    const resQs = await readPdf(bufQs.buffer.slice(bufQs.byteOffset, bufQs.byteOffset + bufQs.byteLength));
    const resAs = await readPdf(bufAs.buffer.slice(bufAs.byteOffset, bufAs.byteOffset + bufAs.byteLength));

    const files = [
      { name: 'Medscope End Qs 30.pdf', text: resQs.text },
      { name: 'Medscope End As 30.pdf', text: resAs.text }
    ];

    const merged = mergeFiles(files);
    expect(merged.details.deduped).toBe(true);
    expect(merged.message).toContain('الملفين نفس الأسئلة');

    const parsed = parse(merged.text);
    const totalQs = parsed.sections.reduce((a, s) => a + s.qs.length, 0);
    const withAns = parsed.sections.flatMap(s => s.qs).filter(q => q.ans !== null).length;

    expect(totalQs).toBe(60);
    expect(parsed.sections.length).toBe(5);
    expect(withAns).toBe(60);
  });

  // Test 5: Drop Medscope End As 30.pdf alone
  it('Acceptance 5: Medscope End As 30.pdf alone -> 60 Qs, 5 subjects, 60 answers', async () => {
    const asPath = path.join(samplesDir, 'Medscope End As 30.pdf');
    const bufAs = fs.readFileSync(asPath);
    const resAs = await readPdf(bufAs.buffer.slice(bufAs.byteOffset, bufAs.byteOffset + bufAs.byteLength));

    const parsed = parse(resAs.text);
    const totalQs = parsed.sections.reduce((a, s) => a + s.qs.length, 0);
    const withAns = parsed.sections.flatMap(s => s.qs).filter(q => q.ans !== null).length;

    expect(totalQs).toBe(60);
    expect(parsed.sections.length).toBe(5);
    expect(withAns).toBe(60);
  });
});
