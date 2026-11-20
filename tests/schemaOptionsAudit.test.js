import { describe, it, expect } from 'vitest';
import { SETTINGS_SCHEMA, PRESETS, PALETTES } from '../src/settings.schema.js';
import { state, DEF_SETTINGS } from '../src/state.js';
import { parse } from '../src/parser.js';
import { renderPagesHTML, paperVars, buildItems } from '../src/paper.js';
import { SAMPLE_TEXT } from '../src/state.js';

describe('Comprehensive Schema Options Audit & Black Screen Check', () => {
  it('Tests every preset to ensure valid HTML and no thrown errors', () => {
    state.data = parse(SAMPLE_TEXT);
    for (const preset of Object.values(PRESETS)) {
      state.settings = { ...DEF_SETTINGS, ...preset.settings };
      const html = renderPagesHTML(false);
      expect(html).toContain('class="page paper');
      const htmlAns = renderPagesHTML(true);
      expect(htmlAns).toContain('class="page paper');
    }
  });

  it('Tests every palette to ensure valid colors and no pure black paper backgrounds', () => {
    state.data = parse(SAMPLE_TEXT);
    for (const pal of PALETTES) {
      state.settings = {
        ...DEF_SETTINGS,
        accent: pal.accent,
        qColor: pal.qColor,
        ansColor: pal.ansColor,
        stemColor: pal.stemColor,
        optColor: pal.optColor,
        headColor: pal.qColor,
        bgColor: pal.bg
      };
      const vars = paperVars(state.settings);
      expect(vars).toContain('--pb:');
      // Verify paper background is not pitch black (#000000 or #000)
      expect(state.settings.bgColor.toLowerCase()).not.toBe('#000000');
      expect(state.settings.bgColor.toLowerCase()).not.toBe('#000');

      const html = renderPagesHTML(false);
      expect(html).toContain('class="page paper');
    }
  });

  it('Iterates through every single field and option in SETTINGS_SCHEMA', () => {
    state.data = parse(SAMPLE_TEXT);

    SETTINGS_SCHEMA.forEach(group => {
      group.fields.forEach(field => {
        if (field.options && Array.isArray(field.options)) {
          field.options.forEach(opt => {
            const val = opt.val !== undefined ? opt.val : (opt.id || opt);
            state.settings = { ...DEF_SETTINGS, [field.key]: val };

            expect(() => {
              const html = renderPagesHTML(false);
              expect(html.length).toBeGreaterThan(100);
            }).not.toThrow();

            expect(() => {
              const htmlAns = renderPagesHTML(true);
              expect(htmlAns.length).toBeGreaterThan(100);
            }).not.toThrow();
          });
        } else if (field.type === 'check') {
          [true, false].forEach(boolVal => {
            state.settings = { ...DEF_SETTINGS, [field.key]: boolVal };
            expect(() => {
              const html = renderPagesHTML(false);
              expect(html.length).toBeGreaterThan(100);
            }).not.toThrow();
          });
        } else if (field.type === 'range' || field.type === 'number') {
          [field.min, field.max, field.default].forEach(numVal => {
            if (numVal !== undefined) {
              state.settings = { ...DEF_SETTINGS, [field.key]: numVal };
              expect(() => {
                const html = renderPagesHTML(false);
                expect(html.length).toBeGreaterThan(100);
              }).not.toThrow();
            }
          });
        }
      });
    });
  });
});
