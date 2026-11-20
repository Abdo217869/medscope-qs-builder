import { describe, it, expect, beforeEach } from 'vitest';
import { parsePageRange, togglePageExclusion, isPageExcluded, restoreAllPages, setExcludedPages, state } from '../src/state.js';

describe('Custom Page Range and Page Exclusion (Prompt 9)', () => {
  beforeEach(() => {
    restoreAllPages();
  });

  describe('parsePageRange', () => {
    it('parses single page number correctly', () => {
      expect(parsePageRange('3', 10)).toEqual([3]);
    });

    it('parses comma-separated pages correctly', () => {
      expect(parsePageRange('1, 3, 7', 10)).toEqual([1, 3, 7]);
    });

    it('parses hyphenated ranges correctly', () => {
      expect(parsePageRange('2-5', 10)).toEqual([2, 3, 4, 5]);
    });

    it('parses mixed complex ranges with deduplication and sorting', () => {
      expect(parsePageRange('1, 3-5, 8, 4, 2', 10)).toEqual([1, 2, 3, 4, 5, 8]);
    });

    it('clamps ranges to 1 and maxPages', () => {
      expect(parsePageRange('0, 8-15', 10)).toEqual([8, 9, 10]);
    });

    it('returns all pages when empty or "all"', () => {
      expect(parsePageRange('', 5)).toEqual([1, 2, 3, 4, 5]);
      expect(parsePageRange('all', 4)).toEqual([1, 2, 3, 4]);
    });
  });

  describe('togglePageExclusion and restoreAllPages', () => {
    it('toggles exclusion on and off', () => {
      expect(isPageExcluded(2)).toBe(false);
      togglePageExclusion(2);
      expect(isPageExcluded(2)).toBe(true);
      togglePageExclusion(2);
      expect(isPageExcluded(2)).toBe(false);
    });

    it('restores all pages', () => {
      togglePageExclusion(1);
      togglePageExclusion(3);
      expect(state.excludedPages.size).toBe(2);
      restoreAllPages();
      expect(state.excludedPages.size).toBe(0);
      expect(isPageExcluded(1)).toBe(false);
      expect(isPageExcluded(3)).toBe(false);
    });

    it('sets excluded pages from array', () => {
      setExcludedPages([2, 5, 7]);
      expect(isPageExcluded(2)).toBe(true);
      expect(isPageExcluded(5)).toBe(true);
      expect(isPageExcluded(7)).toBe(true);
      expect(isPageExcluded(3)).toBe(false);
    });
  });
});
