// src/settings.js - Deep Customization UI Engine with Presets, Palettes, Undo/Redo, and Logo Manager

import { SETTINGS_SCHEMA, PRESETS, PALETTES } from './settings.schema.js';
import {
  state,
  DEF_SETTINGS,
  saveSettings,
  resetSettings,
  pushStyleState,
  undoStyle,
  redoStyle,
  getSavedCustomStyles,
  saveCustomStyle,
  deleteCustomStyle,
  exportStylesJSON,
  importStylesJSON
} from './state.js';
import { processLogoFile, removeCustomLogo, DEFAULT_MEDSCOPE_LOGO } from './imageHelper.js';
import { showToast } from './export.js';

let updateDebounceTimer = null;
let currentSettingsTab = 'all';
let currentSettingsSearch = '';

function debouncedUpdate(onUpdate) {
  clearTimeout(updateDebounceTimer);
  updateDebounceTimer = setTimeout(() => {
    if (onUpdate) onUpdate();
  }, 40);
}

export function buildSettingsUI(onUpdate) {
  const host = document.getElementById('advSettingsHost') || document.getElementById('settings');
  if (!host) return;

  // Preserve scroll position
  const prevScroll = host.scrollTop;
  host.innerHTML = '';

  const S = state.settings;

  // Top Style Toolbar: Undo / Redo + Reset All + Custom Styles
  const topToolbar = document.createElement('div');
  topToolbar.className = 'settings-top-toolbar';
  topToolbar.innerHTML = `
    <div class="style-history-actions">
      <button class="btn sm" id="btnStyleUndo" title="تراجع عن آخر تعديل">↶ تراجع</button>
      <button class="btn sm" id="btnStyleRedo" title="إعادة التعديل">↷ إعادة</button>
      <button class="btn sm danger" id="btnStyleResetAll" title="استرجاع كل الإعدادات الافتراضية">استرجاع الافتراضي</button>
    </div>
    <div class="custom-style-actions">
      <button class="btn sm gold" id="btnSaveCustomStyle">💾 احفظ شكلي</button>
      <button class="btn sm" id="btnExportStyles">تصدير JSON</button>
      <label class="btn sm" style="cursor:pointer;">
        استيراد JSON
        <input type="file" id="btnImportStylesFile" accept=".json" style="display:none">
      </label>
    </div>
  `;
  host.appendChild(topToolbar);

  // Wire Top Style Toolbar Events
  topToolbar.querySelector('#btnStyleUndo')?.addEventListener('click', () => {
    if (undoStyle()) {
      buildSettingsUI(onUpdate);
      onUpdate && onUpdate();
      showToast('تم التراجع عن التعديل ↶');
    }
  });

  topToolbar.querySelector('#btnStyleRedo')?.addEventListener('click', () => {
    if (redoStyle()) {
      buildSettingsUI(onUpdate);
      onUpdate && onUpdate();
      showToast('تمت إعادة التعديل ↷');
    }
  });

  topToolbar.querySelector('#btnStyleResetAll')?.addEventListener('click', () => {
    pushStyleState();
    resetSettings();
    buildSettingsUI(onUpdate);
    onUpdate && onUpdate();
    showToast('تم استرجاع الإعدادات الافتراضية ✓');
  });

  topToolbar.querySelector('#btnSaveCustomStyle')?.addEventListener('click', () => {
    const name = prompt('اكتب اسمًا لهذا التنسيق:');
    if (name && saveCustomStyle(name)) {
      buildSettingsUI(onUpdate);
      showToast(`تم حفظ التنسيق "${name}" بنجاح ✓`);
    }
  });

  topToolbar.querySelector('#btnExportStyles')?.addEventListener('click', () => {
    const jsonStr = exportStylesJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medscope-sheet-styles-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('تم تصدير ملف الإعدادات بنجاح ✓');
  });

  const importInput = topToolbar.querySelector('#btnImportStylesFile');
  importInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      pushStyleState();
      importStylesJSON(text);
      buildSettingsUI(onUpdate);
      onUpdate && onUpdate();
      showToast('تم استيراد الإعدادات وتطبيقها بنجاح ✓');
    } catch (err) {
      showToast(err.message || 'فشل استيراد الملف');
    }
  });

  // Saved Custom Presets List
  const savedStyles = getSavedCustomStyles();
  if (savedStyles.length > 0) {
    const customSection = document.createElement('div');
    customSection.className = 'custom-presets-bar';
    customSection.innerHTML = `
      <span class="custom-presets-title">🌟 التنسيقات المحفوظة:</span>
      <div class="custom-presets-chips">
        ${savedStyles.map(st => `
          <div class="custom-preset-chip">
            <button class="chip-apply-btn" data-apply-id="${st.id}">${escapeHTML(st.name)}</button>
            <button class="chip-del-btn" data-del-id="${st.id}" title="حذف">✕</button>
          </div>
        `).join('')}
      </div>
    `;

    customSection.addEventListener('click', (e) => {
      const applyBtn = e.target.closest('[data-apply-id]');
      if (applyBtn) {
        const id = applyBtn.dataset.applyId;
        const target = savedStyles.find(s => s.id === id);
        if (target) {
          pushStyleState();
          Object.assign(state.settings, target.settings);
          saveSettings();
          buildSettingsUI(onUpdate);
          onUpdate && onUpdate();
          showToast(`تم تطبيق التنسيق "${target.name}" ✓`);
        }
        return;
      }

      const delBtn = e.target.closest('[data-del-id]');
      if (delBtn) {
        const id = delBtn.dataset.delId;
        deleteCustomStyle(id);
        buildSettingsUI(onUpdate);
        showToast('تم حذف التنسيق المحفوظ');
      }
    });

    host.appendChild(customSection);
  }

  // Category Navigation Tabs + Live Search Filter
  const navFilterWrap = document.createElement('div');
  navFilterWrap.className = 'settings-nav-filter-wrap';
  navFilterWrap.innerHTML = `
    <div class="settings-search-box">
      <span class="search-icon">🔍</span>
      <input type="text" id="settingsSearchInput" class="settings-search-input" placeholder="ابحث عن أي خيار (لوجو، غلاف، خط، لون، هامش، QR...)" value="${escapeHTML(currentSettingsSearch)}" autocomplete="off">
      <button type="button" id="btnClearSettingsSearch" class="btn-clear-search" ${currentSettingsSearch ? '' : 'hidden'} title="مسح">✕</button>
    </div>
    <div class="settings-nav-tabs" role="tablist">
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'all' ? 'active' : ''}" data-tab="all">✨ الكل</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'presets' ? 'active' : ''}" data-tab="presets">🌟 القوالب</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'palette' ? 'active' : ''}" data-tab="palette">🎨 الألوان</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'cover' ? 'active' : ''}" data-tab="cover">📖 الغلاف والـ QR</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'watermark' ? 'active' : ''}" data-tab="watermark">🦅 العلامة واللوجو</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'typography' ? 'active' : ''}" data-tab="typography">✍️ الخطوط والأسئلة</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'layout' ? 'active' : ''}" data-tab="layout">📐 التخطيط والهوامش</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'headerFooter' ? 'active' : ''}" data-tab="headerFooter">📑 الهيدر والفوتر</button>
    </div>
  `;
  host.appendChild(navFilterWrap);

  // Iterate Schema Groups
  SETTINGS_SCHEMA.forEach((groupObj, groupIdx) => {
    const details = document.createElement('details');
    details.className = 'settings-group-accordion';
    details.dataset.group = groupObj.group;
    details.open = (groupIdx === 0 || groupIdx === 1 || groupObj.group === 'watermark');

    const summary = document.createElement('summary');
    summary.innerHTML = `
      <span class="group-title">${groupObj.icon} ${groupObj.title}</span>
      <button type="button" class="btn-group-reset" data-group="${groupObj.group}" title="استرجاع افتراضيات هذه المجموعة">رجّع الافتراضي</button>
    `;

    summary.querySelector('.btn-group-reset')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      pushStyleState();
      groupObj.fields.forEach(f => {
        if (f.default !== undefined) {
          S[f.key] = f.default;
        }
      });
      saveSettings();
      buildSettingsUI(onUpdate);
      onUpdate && onUpdate();
      showToast(`تم استرجاع افتراضيات ${groupObj.title} ✓`);
    });

    details.appendChild(summary);

    const groupBody = document.createElement('div');
    groupBody.className = 'settings-group-body';

    groupObj.fields.forEach(field => {
      // 1. Preset Cards
      if (field.type === 'preset-cards') {
        const cardsWrap = document.createElement('div');
        cardsWrap.className = 'preset-cards-grid';
        cardsWrap.innerHTML = field.options.map(p => `
          <div class="preset-card ${S.theme === p.id || (p.id === 'large' && S.fsStem >= 18) ? 'active' : ''}" data-preset="${p.id}">
            <div class="preset-name">${p.name}</div>
            <div class="preset-desc">${p.desc}</div>
          </div>
        `).join('');

        cardsWrap.addEventListener('click', (e) => {
          const card = e.target.closest('[data-preset]');
          if (!card) return;
          const pId = card.dataset.preset;
          const pObj = PRESETS[pId];
          if (pObj) {
            pushStyleState();
            Object.assign(S, pObj.settings);
            saveSettings();
            buildSettingsUI(onUpdate);
            onUpdate && onUpdate();
            showToast(`تم تطبيق ستايل "${pObj.name}" بنجاح ✓`);
          }
        });

        groupBody.appendChild(cardsWrap);
        return;
      }

      // 2. Palette Grid
      if (field.type === 'palette-grid') {
        const palWrap = document.createElement('div');
        palWrap.className = 'palettes-grid';
        palWrap.innerHTML = field.options.map(pal => `
          <div class="palette-card" data-pal="${pal.id}" title="${pal.name}">
            <div class="pal-colors">
              <span style="background:${pal.qColor}"></span>
              <span style="background:${pal.accent}"></span>
              <span style="background:${pal.ansColor}"></span>
              <span style="background:${pal.bg}"></span>
            </div>
            <div class="pal-name">${pal.name}</div>
          </div>
        `).join('');

        palWrap.addEventListener('click', (e) => {
          const card = e.target.closest('[data-pal]');
          if (!card) return;
          const palId = card.dataset.pal;
          const palObj = PALETTES.find(p => p.id === palId);
          if (palObj) {
            pushStyleState();
            S.accent = palObj.accent;
            S.qColor = palObj.qColor;
            S.ansColor = palObj.ansColor;
            S.stemColor = palObj.stemColor;
            S.optColor = palObj.optColor;
            S.headColor = palObj.qColor;
            S.bgColor = palObj.bg;
            saveSettings();
            buildSettingsUI(onUpdate);
            onUpdate && onUpdate();
            showToast(`تم تطبيق بالتة "${palObj.name}" ✓`);
          }
        });

        groupBody.appendChild(palWrap);
        return;
      }

      // 3. Logo Uploader with Thumbnail & Fail-Safe Controls
      if (field.type === 'logo-uploader') {
        const uploaderWrap = document.createElement('div');
        uploaderWrap.className = 'logo-uploader-card';
        const currentLogo = S.wmImg || DEFAULT_MEDSCOPE_LOGO;

        uploaderWrap.innerHTML = `
          <div class="logo-preview-row">
            <div class="logo-thumb-box">
              <img src="${currentLogo}" class="logo-thumb-img" alt="Logo preview" id="logoThumbImg">
            </div>
            <div class="logo-actions-col">
              <label class="btn sm gold" id="lblLogoFile" title="اختيار صورة أو لوجو مخصص">
                غيّر
                <input type="file" id="logoFileInput" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none">
              </label>
              <button type="button" class="btn sm danger" id="btnRemoveLogo" title="إزالة اللوجو المخصص والرجوع للافتراضي">شيل الصورة</button>
              <button type="button" class="btn sm" id="btnResetDefaultLogo" title="استرجاع لوجو ميدسكوب الرسمي">رجّع لوجو ميدسكوب</button>
            </div>
          </div>
          <small class="hint">يدعم PNG (بشفافية تامة), JPG, WebP, و SVG. يتم ضغط وتخزين الصور الكبيرة تلقائيًا.</small>
        `;

        const fileInput = uploaderWrap.querySelector('#logoFileInput');
        fileInput?.addEventListener('change', async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          try {
            pushStyleState();
            const result = await processLogoFile(file);
            S.wmImg = result.dataUrl;
            S.wmType = 'image';
            saveSettings();
            buildSettingsUI(onUpdate);
            onUpdate && onUpdate();
            showToast('تم تحميل وحفظ اللوجو بنجاح ✓');
          } catch (err) {
            console.error('Logo upload error:', err);
            showToast(err.message || 'الصورة كبيرة أو تالفة');
          }
        });

        uploaderWrap.querySelector('#btnRemoveLogo')?.addEventListener('click', async () => {
          pushStyleState();
          await removeCustomLogo();
          S.wmImg = DEFAULT_MEDSCOPE_LOGO;
          S.wmType = 'image';
          saveSettings();
          buildSettingsUI(onUpdate);
          onUpdate && onUpdate();
          showToast('تمت إزالة الصورة والرجوع للافتراضي ✓');
        });

        uploaderWrap.querySelector('#btnResetDefaultLogo')?.addEventListener('click', async () => {
          pushStyleState();
          await removeCustomLogo();
          S.wmImg = DEFAULT_MEDSCOPE_LOGO;
          S.wmType = 'image';
          saveSettings();
          buildSettingsUI(onUpdate);
          onUpdate && onUpdate();
          showToast('تم استرجاع لوجو ميدسكوب الافتراضي ✓');
        });

        groupBody.appendChild(uploaderWrap);
        return;
      }

      // 4. Standard Form Controls (Select, Check, Color, Text, Range + Typed Number Box)
      const row = document.createElement('div');
      row.className = `settings-field f-${field.type}`;

      const labelEl = document.createElement('label');
      labelEl.className = 'field-label';
      labelEl.textContent = field.label;

      let controlEl;

      if (field.type === 'select') {
        controlEl = document.createElement('select');
        controlEl.className = 'field-select';
        field.options.forEach(opt => {
          const optEl = document.createElement('option');
          optEl.value = opt.val;
          optEl.textContent = opt.text;
          controlEl.appendChild(optEl);
        });
        controlEl.value = S[field.key] !== undefined ? S[field.key] : (field.default ?? '');
        controlEl.addEventListener('change', () => {
          pushStyleState();
          let val = controlEl.value;
          if (field.key === 'cols' || typeof field.default === 'number') val = +val;
          S[field.key] = val;
          saveSettings();
          debouncedUpdate(onUpdate);
        });
      } else if (field.type === 'check') {
        controlEl = document.createElement('input');
        controlEl.type = 'checkbox';
        controlEl.className = 'field-checkbox';
        controlEl.checked = !!(S[field.key] !== undefined ? S[field.key] : field.default);
        controlEl.addEventListener('change', () => {
          pushStyleState();
          S[field.key] = controlEl.checked;
          saveSettings();
          debouncedUpdate(onUpdate);
        });
      } else if (field.type === 'color') {
        controlEl = document.createElement('div');
        controlEl.className = 'color-picker-wrap';
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'field-color';
        colorInput.value = S[field.key] || field.default || '#000000';

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'field-color-text';
        textInput.value = colorInput.value;

        colorInput.addEventListener('input', () => {
          textInput.value = colorInput.value;
          S[field.key] = colorInput.value;
          saveSettings();
          debouncedUpdate(onUpdate);
        });

        textInput.addEventListener('change', () => {
          if (/^#[0-9a-f]{6}$/i.test(textInput.value)) {
            pushStyleState();
            colorInput.value = textInput.value;
            S[field.key] = textInput.value;
            saveSettings();
            debouncedUpdate(onUpdate);
          }
        });

        controlEl.appendChild(colorInput);
        controlEl.appendChild(textInput);
      } else if (field.type === 'text') {
        controlEl = document.createElement('input');
        controlEl.type = 'text';
        controlEl.className = 'field-text';
        controlEl.value = S[field.key] !== undefined ? S[field.key] : (field.default ?? '');
        controlEl.addEventListener('input', () => {
          S[field.key] = controlEl.value;
          saveSettings();
          debouncedUpdate(onUpdate);
        });
      } else if (field.type === 'range') {
        controlEl = document.createElement('div');
        controlEl.className = 'range-with-number-wrap';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'field-range';
        slider.min = field.min;
        slider.max = field.max;
        slider.step = field.step || 1;
        slider.value = S[field.key] !== undefined ? S[field.key] : field.default;

        const numBox = document.createElement('input');
        numBox.type = 'number';
        numBox.className = 'field-number-box';
        numBox.min = field.min;
        numBox.max = field.max;
        numBox.step = field.step || 1;
        numBox.value = slider.value;

        const unitSpan = document.createElement('span');
        unitSpan.className = 'field-unit';
        unitSpan.textContent = field.unit || '';

        slider.addEventListener('input', () => {
          numBox.value = slider.value;
          S[field.key] = +slider.value;
          saveSettings();
          debouncedUpdate(onUpdate);
        });

        numBox.addEventListener('change', () => {
          pushStyleState();
          slider.value = numBox.value;
          S[field.key] = +numBox.value;
          saveSettings();
          debouncedUpdate(onUpdate);
        });

        controlEl.appendChild(slider);
        controlEl.appendChild(numBox);
        if (field.unit) controlEl.appendChild(unitSpan);
      } else if (field.type === 'number') {
        controlEl = document.createElement('input');
        controlEl.type = 'number';
        controlEl.className = 'field-number';
        controlEl.min = field.min || 0;
        controlEl.max = field.max || 100;
        controlEl.value = S[field.key] !== undefined ? S[field.key] : field.default;
        controlEl.addEventListener('change', () => {
          pushStyleState();
          S[field.key] = +controlEl.value;
          saveSettings();
          debouncedUpdate(onUpdate);
        });
      }

      row.appendChild(labelEl);
      if (controlEl) row.appendChild(controlEl);
      groupBody.appendChild(row);
    });

    details.appendChild(groupBody);
    host.appendChild(details);
  });

  // Category & Search Filtering Engine
  const applySettingsFilter = () => {
    const accordions = host.querySelectorAll('.settings-group-accordion');
    const searchVal = currentSettingsSearch.trim().toLowerCase();

    accordions.forEach(acc => {
      const g = acc.dataset.group;
      let matchesTab = false;

      if (currentSettingsTab === 'all') {
        matchesTab = true;
      } else if (currentSettingsTab === 'presets' && g === 'presets') {
        matchesTab = true;
      } else if (currentSettingsTab === 'palette' && g === 'palette') {
        matchesTab = true;
      } else if (currentSettingsTab === 'cover' && g === 'cover') {
        matchesTab = true;
      } else if (currentSettingsTab === 'watermark' && g === 'watermark') {
        matchesTab = true;
      } else if (currentSettingsTab === 'typography' && (g === 'typography' || g === 'questions')) {
        matchesTab = true;
      } else if (currentSettingsTab === 'layout' && (g === 'layout' || g === 'randomize')) {
        matchesTab = true;
      } else if (currentSettingsTab === 'headerFooter' && (g === 'headerFooter' || g === 'keyPage')) {
        matchesTab = true;
      }

      if (!matchesTab) {
        acc.style.display = 'none';
        return;
      }

      if (!searchVal) {
        acc.style.display = 'block';
        return;
      }

      const text = acc.textContent.toLowerCase();
      if (text.includes(searchVal)) {
        acc.style.display = 'block';
        acc.open = true;
      } else {
        acc.style.display = 'none';
      }
    });
  };

  // Wire Tab Buttons
  navFilterWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.settings-tab-btn');
    if (!btn) return;
    navFilterWrap.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSettingsTab = btn.dataset.tab;
    applySettingsFilter();
    const sidebar = document.getElementById('studioSidebar');
    if (sidebar) sidebar.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Wire Search Events
  const searchInput = navFilterWrap.querySelector('#settingsSearchInput');
  const btnClearSearch = navFilterWrap.querySelector('#btnClearSettingsSearch');

  searchInput?.addEventListener('input', (e) => {
    currentSettingsSearch = e.target.value;
    if (btnClearSearch) btnClearSearch.hidden = !currentSettingsSearch;
    applySettingsFilter();
  });

  btnClearSearch?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    currentSettingsSearch = '';
    btnClearSearch.hidden = true;
    applySettingsFilter();
  });

  applySettingsFilter();

  if (prevScroll) {
    host.scrollTop = prevScroll;
  }
}

function escapeHTML(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
