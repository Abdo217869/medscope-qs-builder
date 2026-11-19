// state.js - Centralized state and storage for Medscope Question Sheet Builder

import { buildDefaultSettings, PRESETS, PALETTES } from './settings.schema.js';
import { DEFAULT_MEDSCOPE_LOGO, loadStoredLogo } from './imageHelper.js';

export const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage get error:', e);
      return null;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      console.warn('localStorage set error:', e);
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage remove error:', e);
    }
  }
};

const schemaDefaults = buildDefaultSettings();

export const DEF_SETTINGS = {
  theme: 'soft',
  tint: true,
  bgColor: '#fffcf3',
  title: 'Foundation',
  subtitle: 'End Exam Qs 30',
  by: 'By: Medscope team',
  joinText: 'Join us',
  header: 'Dr Omar Medhat - Medscope Meetings',
  footer: 'Spread your wingS',
  cover: true,
  secPages: true,
  pageNums: true,
  keyPage: true,

  font: 'Carlito, Calibri, sans-serif',
  fontStem: 'Carlito, Calibri, sans-serif',
  fontOpt: 'Carlito, Calibri, sans-serif',
  fs: 15,
  fsStem: 15,
  fsOpt: 14.5,
  fsHead: 20,
  fsHdr: 11,
  lhStem: 1.45,
  lhOpt: 1.4,
  cols: 1,
  margin: 16,
  marginTop: 16,
  marginBottom: 16,
  marginInside: 16,
  marginOutside: 16,
  gap: 10,
  colGap: 10,
  qgap: 14,
  optGap: 6,
  bold: true,

  numfmt: '1-',
  letter: 'a)',
  renumber: true,
  qBadgeStyle: 'circle-fill',
  optBadgeStyle: 'circle',
  optLayout: 'vertical',
  separator: 'dashed',

  qColor: '#122036',
  stemColor: '#1c2430',
  optColor: '#2b3648',
  accent: '#d4a343',
  headColor: '#122036',
  hdrColor: '#64748b',
  ansColor: '#c00000',
  highlightColor: '#fef08a',
  mark: 'circle-fill',
  markStyle: 'circle-fill',
  showExpl: true,

  wmType: 'image',
  wmImg: DEFAULT_MEDSCOPE_LOGO,
  wmText: 'MEDSCOPE',
  wmSub: 'Spread your wingS',
  wmOp: 0.16,
  wmSize: 340,
  wmPos: 'center',
  wmRot: 0,
  wmCover: false,
  wmTarget: 'all',

  coverLogo: true,
  coverLogoSize: 140,
  coverLogoPos: 'top',
  coverLogoShape: 'original',
  coverLayout: 'band',
  coverBorder: 'none',
  coverAlign: 'center',
  coverTitleSize: 32,
  coverSubtitleSize: 18,
  coverDate: '',
  coverExamInfo: '',
  coverTotalQs: false,

  secPages: true,
  secPageLayout: 'band',
  secPageLogo: true,
  secPageLogoSize: 80,
  secPageSub: 'Qs',
  secTitleCount: false,

  headerLogo: false,
  headerLogoSize: 18,

  shuffleQ: false,
  shuffleO: false,
  seed: 42,
  ...schemaDefaults
};

export const SAMPLE_TEXT = `# Physiology

1- Homeostasis is mainly regulated in which compartment?
a) Extracellular fluid *
b) Intracellular fluid
c) Transcellular fluid

2-Which adrenergic receptor increases the air entering
the bronchioles?
a) Alpha 1
b) Beta 2 ✓
c) Alpha 2

3- What is the appropriate initial fluid therapy for a patient with diarrhea-induced dehydration?
a) 10% mannitol
b) 0.9% saline
c) 25% glucose
d) 10% KCl
Answer: b
Explanation: Isotonic saline restores extracellular volume.

# Anatomy

1-What is the classification of the patella according to its shape?
a) Sesamoid ✓
b) Flat
c) Irregular
d) Short tubular

2- Which plane divides the body into anterior and posterior parts?
a) Coronal ✓
b) Sagittal
c) Transverse
d) Oblique`;

export const state = {
  settings: { ...DEF_SETTINGS },
  data: {
    sections: [],
    skipped: 0,
    skippedList: [],
    unplacedLines: [],
    keyPairs: 0,
    keyUsed: 0
  },
  view: 'qs', // 'qs' | 'as' | 'edit' | 'exp'
  tab: 'q',   // 'q' | 'k' | 's'
  zoomManual: null
};

// Undo / Redo stacks for Style Customization
export const styleHistory = {
  undoStack: [],
  redoStack: [],
  max: 30
};

export function pushStyleState() {
  const snapshot = { ...state.settings };
  // Don't duplicate if identical to top
  if (styleHistory.undoStack.length > 0) {
    const top = styleHistory.undoStack[styleHistory.undoStack.length - 1];
    if (JSON.stringify(top) === JSON.stringify(snapshot)) return;
  }
  styleHistory.undoStack.push(snapshot);
  if (styleHistory.undoStack.length > styleHistory.max) {
    styleHistory.undoStack.shift();
  }
  styleHistory.redoStack = [];
}

export function undoStyle() {
  if (styleHistory.undoStack.length === 0) return false;
  styleHistory.redoStack.push({ ...state.settings });
  const prev = styleHistory.undoStack.pop();
  Object.assign(state.settings, prev);
  saveSettings();
  return true;
}

export function redoStyle() {
  if (styleHistory.redoStack.length === 0) return false;
  styleHistory.undoStack.push({ ...state.settings });
  const next = styleHistory.redoStack.pop();
  Object.assign(state.settings, next);
  saveSettings();
  return true;
}

// Load saved settings
try {
  const savedSettings = JSON.parse(store.get('mq.settings') || '{}');
  Object.assign(state.settings, savedSettings);
  // Ensure watermark type is 'image' if it was empty or old prototype 'text'
  if (!state.settings.wmType || state.settings.wmType === 'text') {
    state.settings.wmType = 'image';
  }
  // Ensure default watermark points to Medscope default logo if empty or default or idb placeholder
  if (!state.settings.wmImg || state.settings.wmImg === '/medscope-watermark-default.png' || state.settings.wmImg === 'idb:custom_logo') {
    state.settings.wmImg = DEFAULT_MEDSCOPE_LOGO;
  }
  // If opacity was old 0.08 or 0.12, upgrade to 0.16 for comfortable visibility
  if (state.settings.wmOp === 0.08 || state.settings.wmOp === 0.12) {
    state.settings.wmOp = 0.16;
  }
  // Remove question count in Arabic from section headers
  state.settings.secTitleCount = false;
} catch (e) {
  console.warn('Error reading saved settings:', e);
}

export async function syncLogoFromIDB(callback) {
  if (typeof window === 'undefined') return null;
  try {
    const customLogo = await loadStoredLogo();
    if (customLogo && state.settings.wmType === 'image') {
      state.settings.wmImg = customLogo;
      callback && callback(customLogo);
      return customLogo;
    }
  } catch (err) {
    console.warn('Could not sync logo from IDB:', err);
  }
  return null;
}

// Check IndexedDB for custom logo on startup
if (typeof window !== 'undefined') {
  syncLogoFromIDB();
}

export function saveSettings() {
  // Strip large base64/blob logo from localStorage payload to keep it tiny (<5KB)
  const cleanSettings = { ...state.settings };
  if (cleanSettings.wmImg && (cleanSettings.wmImg.startsWith('data:') || cleanSettings.wmImg.startsWith('blob:'))) {
    cleanSettings.wmImg = 'idb:custom_logo';
  }
  store.set('mq.settings', JSON.stringify(cleanSettings));
}

export function resetSettings() {
  state.settings = { ...DEF_SETTINGS };
  saveSettings();
}

/**
 * Custom Preset Management (Save, list, delete, export/import JSON)
 */
export function getSavedCustomStyles() {
  try {
    return JSON.parse(store.get('mq.custom_styles') || '[]');
  } catch (e) {
    return [];
  }
}

export function saveCustomStyle(name) {
  if (!name || !name.trim()) return false;
  const list = getSavedCustomStyles();
  const id = 'custom_' + Date.now();
  list.push({
    id,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    settings: { ...state.settings }
  });
  store.set('mq.custom_styles', JSON.stringify(list));
  return true;
}

export function deleteCustomStyle(id) {
  const list = getSavedCustomStyles().filter(s => s.id !== id);
  store.set('mq.custom_styles', JSON.stringify(list));
}

export function exportStylesJSON() {
  const data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    currentSettings: state.settings,
    customStyles: getSavedCustomStyles()
  };
  return JSON.stringify(data, null, 2);
}

export function importStylesJSON(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (data.currentSettings) {
      Object.assign(state.settings, data.currentSettings);
      saveSettings();
    }
    if (Array.isArray(data.customStyles)) {
      const existing = getSavedCustomStyles();
      const merged = [...existing, ...data.customStyles];
      store.set('mq.custom_styles', JSON.stringify(merged));
    }
    return true;
  } catch (e) {
    throw new Error('الملف غير صالح أو تالف.');
  }
}

/**
 * Mulberry32 seeded pseudo-random number generator
 */
export function mulberry(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates array shuffle with given RNG
 */
export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Derives view data from state.data, applying question and option shuffling if configured.
 * Safely skips option shuffle for questions with "all/none of the above" or "both".
 */
export function getViewData() {
  const S = state.settings;
  const secs = state.data.sections.map(s => ({
    name: s.name,
    qs: s.qs.map(q => ({
      ...q,
      opts: q.opts.slice()
    }))
  }));

  if (!S.shuffleQ && !S.shuffleO) return secs;

  const rnd = mulberry(S.seed || 42);

  return secs.map(sec => {
    let qs = sec.qs.slice();

    if (S.shuffleQ) {
      qs = shuffle(qs, rnd);
    }

    if (S.shuffleO) {
      qs = qs.map(q => {
        const hasProtected = q.opts.some(o =>
          /\b(all\s+of\s+the\s+above|none\s+of\s+the\s+above|both\s+[a-d]|كل\s+ما\s+سبق|لا\s+شيء\s+مما\s+سبق)\b/i.test(o)
        );
        if (hasProtected || q.opts.length < 2) return q;

        const indexed = q.opts.map((text, idx) => ({ text, idx, isAns: idx === q.ans }));
        const shuffled = shuffle(indexed, rnd);
        const newAns = shuffled.findIndex(item => item.isAns);

        return {
          ...q,
          opts: shuffled.map(item => item.text),
          ans: newAns >= 0 ? newAns : q.ans
        };
      });
    }

    return { ...sec, qs };
  });
}
