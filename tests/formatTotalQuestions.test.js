import { describe, it, expect } from 'vitest';
import { formatTotalQuestions } from '../src/paper.js';

describe('formatTotalQuestions Grammar and Type Verification', () => {
  it('correctly formats single MCQ as "Total: 1 MCQ" without plural s', () => {
    const res = formatTotalQuestions(1, { title: 'Physiology' }, [{ qs: [{ type: 'mcq' }] }]);
    expect(res).toBe('Total: 1 MCQ');
  });

  it('correctly formats multiple MCQs as "Total: X MCQs"', () => {
    const res = formatTotalQuestions(10, { title: 'Physiology' }, [{ qs: new Array(10).fill({ type: 'mcq' }) }]);
    expect(res).toBe('Total: 10 MCQs');
  });

  it('formats single question for Practical exams as "Total: 1 Question"', () => {
    const res = formatTotalQuestions(1, { title: 'Community Practical Qs' }, [{ qs: [{ type: 'mcq' }] }]);
    expect(res).toBe('Total: 1 Question');
  });

  it('formats multiple questions for Practical exams as "Total: X Questions"', () => {
    const res = formatTotalQuestions(5, { title: 'Community Practical Qs' }, [{ qs: new Array(5).fill({ type: 'mcq' }) }]);
    expect(res).toBe('Total: 5 Questions');
  });

  it('formats Essay exams as Questions', () => {
    const single = formatTotalQuestions(1, { title: 'Epidemiology Written' }, [{ qs: [{ type: 'essay' }] }]);
    expect(single).toBe('Total: 1 Question');

    const multi = formatTotalQuestions(4, { title: 'Epidemiology Written' }, [{ qs: new Array(4).fill({ type: 'essay' }) }]);
    expect(multi).toBe('Total: 4 Questions');
  });

  it('formats questions in English even when exam title contains Arabic', () => {
    expect(formatTotalQuestions(1, { title: 'امتحان الفسيولوجي' }, [{ qs: [{ stem: 'سؤال' }] }])).toBe('Total: 1 MCQ');
    expect(formatTotalQuestions(5, { title: 'امتحان الفسيولوجي' }, [{ qs: [{ stem: 'سؤال' }] }])).toBe('Total: 5 MCQs');
  });

  it('supports user custom label override in settings', () => {
    expect(formatTotalQuestions(1, { coverTotalQsLabel: 'MCQs' })).toBe('Total: 1 MCQ');
    expect(formatTotalQuestions(5, { coverTotalQsLabel: 'MCQs' })).toBe('Total: 5 MCQs');
    expect(formatTotalQuestions(1, { coverTotalQsLabel: 'Questions' })).toBe('Total: 1 Question');
    expect(formatTotalQuestions(12, { coverTotalQsLabel: 'Questions' })).toBe('Total: 12 Questions');
    expect(formatTotalQuestions(10, { coverTotalQsLabel: 'Total: 10 Case Scenarios' })).toBe('Total: 10 Case Scenarios');
  });
});
