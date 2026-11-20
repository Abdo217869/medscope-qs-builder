// src/settings.js - Deep Customization UI Engine with Presets, Palettes, Undo/Redo, and Logo Manager

import { SETTINGS_SCHEMA, PRESETS, PALETTES } from './settings.schema.js';
import {
  state,
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

  // =========================================================================
  // 1. Top Bento Quick Toolbar (History, Sheet Mode, Font Scaling, Styles)
  // =========================================================================
  const topToolbar = document.createElement('div');
  topToolbar.className = 'settings-top-toolbar';
  topToolbar.innerHTML = `
    <!-- Row 1: Fast Sheet View & Font Quick Scale -->
    <div class="settings-quick-bar">
      <div class="quick-view-pills" title="تبديل معاينة الورقة المباشرة فورًا بدون صعود أو نزول">
        <span class="quick-bar-label">👁️ المعاينة:</span>
        <button type="button" class="btn-quick-pill ${state.view === 'qs' ? 'active' : ''}" data-setview="qs">📄 أسئلة</button>
        <button type="button" class="btn-quick-pill ${state.view === 'as' ? 'active' : ''}" data-setview="as">🔴 إجابات</button>
        <button type="button" class="btn-quick-pill ${state.view === 'spaces' ? 'active' : ''}" data-setview="spaces">📝 مساحات حل</button>
      </div>

      <div class="quick-font-scaler" title="تكبير أو تصغير حجم خطوط الامتحان بسرعة">
        <span class="quick-bar-label">🔤 الخط:</span>
        <button type="button" class="btn-font-step" id="btnFontDec" title="تصغير الخط 1pt">A−</button>
        <span class="font-current-val" id="lblCurrentFs">${S.fsStem || 15} pt</span>
        <button type="button" class="btn-font-step" id="btnFontInc" title="تكبير الخط 1pt">A+</button>
      </div>
    </div>

    <!-- Row 2: Undo / Redo / Reset / Custom Styles -->
    <div class="settings-actions-bar">
      <div class="style-history-actions">
        <button type="button" class="btn-toolbar-action" id="btnStyleUndo" title="تراجع عن آخر تعديل">↶ تراجع</button>
        <button type="button" class="btn-toolbar-action" id="btnStyleRedo" title="إعادة التعديل">↷ إعادة</button>
        <button type="button" class="btn-toolbar-action danger" id="btnStyleResetAll" title="استرجاع كل الإعدادات الافتراضية">↺ استرجاع الافتراضي</button>
      </div>
      <div class="custom-style-actions">
        <button type="button" class="btn-toolbar-action primary" id="btnSaveCustomStyle">💾 احفظ شكلي</button>
        <button type="button" class="btn-toolbar-action" id="btnExportStyles" title="تصدير إعداداتك لملف JSON">تصدير</button>
        <label class="btn-toolbar-action" style="cursor:pointer;" title="استيراد إعدادات من ملف JSON">
          استيراد
          <input type="file" id="btnImportStylesFile" accept=".json" style="display:none">
        </label>
      </div>
    </div>
  `;
  host.appendChild(topToolbar);

  // Wire Quick View Pills
  topToolbar.querySelectorAll('[data-setview]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.setview;
      state.view = v;
      topToolbar.querySelectorAll('[data-setview]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mainViews = document.querySelectorAll('#views button, #paperViewToggle button');
      mainViews.forEach(b => {
        if (b.dataset.v === v || b.dataset.view === v) b.classList.add('active');
        else b.classList.remove('active');
      });
      if (onUpdate) onUpdate();
      showToast(`تم التبديل إلى: ${v === 'qs' ? 'ورقة الأسئلة' : (v === 'as' ? 'ورقة الإجابات' : 'ورقة بمساحات حل')} ✓`);
    });
  });

  // Wire Font Scalers
  topToolbar.querySelector('#btnFontDec')?.addEventListener('click', () => {
    pushStyleState();
    const curStem = S.fsStem || 15;
    const curOpt = S.fsOpt || 14.5;
    if (curStem > 10) {
      S.fsStem = Math.max(10, curStem - 1);
      S.fsOpt = Math.max(9.5, curOpt - 1);
      saveSettings();
      buildSettingsUI(onUpdate);
      onUpdate && onUpdate();
      showToast(`تم تصغير الخط إلى ${S.fsStem} pt`);
    }
  });

  topToolbar.querySelector('#btnFontInc')?.addEventListener('click', () => {
    pushStyleState();
    const curStem = S.fsStem || 15;
    const curOpt = S.fsOpt || 14.5;
    if (curStem < 24) {
      S.fsStem = Math.min(24, curStem + 1);
      S.fsOpt = Math.min(23, curOpt + 1);
      saveSettings();
      buildSettingsUI(onUpdate);
      onUpdate && onUpdate();
      showToast(`تم تكبير الخط إلى ${S.fsStem} pt`);
    }
  });

  // Wire History Actions
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
    if (confirm('هل أنت متأكد من استرجاع كافة الإعدادات إلى الوضع الافتراضي؟')) {
      pushStyleState();
      resetSettings();
      buildSettingsUI(onUpdate);
      onUpdate && onUpdate();
      showToast('تم استرجاع الإعدادات الافتراضية بالكامل ✓');
    }
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

  // =========================================================================
  // 2. Saved Custom Presets List
  // =========================================================================
  const savedStyles = getSavedCustomStyles();
  if (savedStyles.length > 0) {
    const customSection = document.createElement('div');
    customSection.className = 'custom-presets-bar';
    customSection.innerHTML = `
      <span class="custom-presets-title">🌟 التنسيقات المحفوظة:</span>
      <div class="custom-presets-chips">
        ${savedStyles.map(st => `
          <div class="custom-preset-chip">
            <button type="button" class="chip-apply-btn" data-apply-id="${st.id}">★ ${escapeHTML(st.name)}</button>
            <button type="button" class="chip-del-btn" data-del-id="${st.id}" title="حذف هذا التنسيق">✕</button>
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

  // =========================================================================
  // 3. Category Navigation Tabs + Live Search Filter
  // =========================================================================
  const navFilterWrap = document.createElement('div');
  navFilterWrap.className = 'settings-nav-filter-wrap';
  navFilterWrap.innerHTML = `
    <div class="settings-search-box">
      <span class="search-icon">🔍</span>
      <input type="text" id="settingsSearchInput" class="settings-search-input" placeholder="ابحث عن أي خيار (لوجو، غلاف، خط، لون، هامش، مقالي...)" value="${escapeHTML(currentSettingsSearch)}" autocomplete="off">
      <button type="button" id="btnClearSettingsSearch" class="btn-clear-search" ${currentSettingsSearch ? '' : 'hidden'} title="مسح البحث">✕</button>
    </div>
    <div class="settings-nav-tabs" role="tablist">
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'all' ? 'active' : ''}" data-tab="all">✨ الكل</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'presets' ? 'active' : ''}" data-tab="presets">🌟 القوالب</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'palette' ? 'active' : ''}" data-tab="palette">🎨 الألوان</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'page' ? 'active' : ''}" data-tab="page">📐 الصفحة والهوامش</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'typography' ? 'active' : ''}" data-tab="typography">✍️ الخطوط والأسئلة</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'essay' ? 'active' : ''}" data-tab="essay">📝 المقالي والحالات</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'watermark' ? 'active' : ''}" data-tab="watermark">🦅 العلامة واللوجو</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'cover' ? 'active' : ''}" data-tab="cover">📖 صفحة الغلاف</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'dividers' ? 'active' : ''}" data-tab="dividers">📑 الصفحات الفاصلة</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'headerFooter' ? 'active' : ''}" data-tab="headerFooter">📑 الهيدر والفوتر</button>
      <button type="button" class="settings-tab-btn ${currentSettingsTab === 'answers' ? 'active' : ''}" data-tab="answers">🎯 نموذج الإجابات</button>
    </div>
  `;
  host.appendChild(navFilterWrap);

  // =========================================================================
  // 4. Iterate Schema Groups and Build Enhanced Controls
  // =========================================================================
  SETTINGS_SCHEMA.forEach((groupObj, groupIdx) => {
    const details = document.createElement('details');
    details.className = 'settings-group-accordion';
    details.dataset.group = groupObj.group;
    details.open = (groupIdx === 0 || groupIdx === 1 || groupObj.group === 'watermark');

    const summary = document.createElement('summary');
    summary.className = 'group-summary';
    summary.innerHTML = `
      <div class="group-summary-left">
        <span class="group-chevron">▾</span>
        <span class="group-title">
          <span class="group-icon-pill">${groupObj.icon}</span>
          <span class="group-title-text">${groupObj.title}</span>
        </span>
      </div>
      <button type="button" class="btn-group-reset" data-group="${groupObj.group}" title="استرجاع افتراضيات هذه المجموعة فقط">↺ رجّع الافتراضي</button>
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
      // ---------------------------------------------------------------------
      // 1. Preset Cards (Upgraded with Radio Circles, Badges, and Hover Glow)
      // ---------------------------------------------------------------------
      if (field.type === 'preset-cards') {
        const cardsWrap = document.createElement('div');
        cardsWrap.className = 'preset-cards-grid';

        const presetIcons = {
          soft: '🌿',
          classic: '🏛️',
          minimal: '⚡',
          modern: '💎',
          large: '📱'
        };

        cardsWrap.innerHTML = field.options.map(p => {
          const isActive = (S.theme === p.id || (p.id === 'large' && S.fsStem >= 18));
          const icon = presetIcons[p.id] || '🎨';
          return `
            <div class="preset-card ${isActive ? 'active' : ''}" data-preset="${p.id}" role="radio" aria-checked="${isActive}">
              <div class="preset-card-header">
                <div class="card-radio-box ${isActive ? 'checked' : ''}">
                  ${isActive ? '<span class="radio-check-icon">✓</span>' : ''}
                </div>
                <div class="preset-name">${icon} ${p.name}</div>
                ${isActive ? '<span class="preset-active-badge">مُفعّل الآن</span>' : ''}
              </div>
              <div class="preset-desc">${p.desc}</div>
              <div class="preset-mini-features">
                <span class="preset-feature-tag">${p.settings?.fontStem ? p.settings.fontStem.split(',')[0].replace(/['"]/g, '') : 'Calibri'}</span>
                <span class="preset-feature-swatch" style="background:${p.settings?.bgColor || '#ffffff'}"></span>
              </div>
            </div>
          `;
        }).join('');

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

      // ---------------------------------------------------------------------
      // 2. Palette Grid (Upgraded with Active Badges, Swatches, and Radios)
      // ---------------------------------------------------------------------
      if (field.type === 'palette-grid') {
        const palWrap = document.createElement('div');
        palWrap.className = 'palettes-grid';

        palWrap.innerHTML = field.options.map(pal => {
          const isPalActive = (S.accent === pal.accent && S.qColor === pal.qColor);
          return `
            <div class="palette-card ${isPalActive ? 'active' : ''}" data-pal="${pal.id}" title="${pal.name}" role="radio" aria-checked="${isPalActive}">
              <div class="palette-card-top">
                <div class="card-radio-box ${isPalActive ? 'checked' : ''}">
                  ${isPalActive ? '<span class="radio-check-icon">✓</span>' : ''}
                </div>
                ${isPalActive ? '<span class="pal-active-badge">نشط</span>' : ''}
              </div>
              <div class="pal-colors">
                <span style="background:${pal.qColor}" title="لون الأسئلة"></span>
                <span style="background:${pal.accent}" title="اللون المميز"></span>
                <span style="background:${pal.ansColor}" title="لون الإجابات"></span>
                <span style="background:${pal.bg}" title="لون الصفحة"></span>
              </div>
              <div class="pal-name">${pal.name}</div>
            </div>
          `;
        }).join('');

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

      // ---------------------------------------------------------------------
      // 3. Logo Uploader (Strict Containment Box, Clean Buttons, Preview)
      // ---------------------------------------------------------------------
      if (field.type === 'logo-uploader') {
        const uploaderWrap = document.createElement('div');
        uploaderWrap.className = 'logo-uploader-card';
        const currentLogo = S.wmImg || DEFAULT_MEDSCOPE_LOGO;

        uploaderWrap.innerHTML = `
          <div class="logo-preview-row">
            <div class="logo-thumb-box" title="معاينة اللوجو أو العلامة المائية">
              <img src="${currentLogo}" loading="eager" class="logo-thumb-img" alt="Logo preview" id="logoThumbImg">
            </div>
            <div class="logo-actions-col">
              <label class="btn-logo-upload" id="lblLogoFile" title="اختيار صورة أو لوجو مخصص من جهازك">
                <span>📁 رفع لوجو جديد</span>
                <input type="file" id="logoFileInput" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none">
              </label>
              <div class="logo-secondary-actions">
                <button type="button" class="btn-logo-secondary reset" id="btnResetDefaultLogo" title="استرجاع لوجو ميدسكوب الرسمي">↺ لوجو ميدسكوب الافتراضي</button>
                <button type="button" class="btn-logo-secondary danger" id="btnRemoveLogo" title="إزالة اللوجو المخصص">✕ إزالة اللوجو</button>
              </div>
            </div>
          </div>
          <div class="logo-help-hint">
            💡 يدعم PNG الشفاف، JPG، WebP، و SVG. يتم ضغط ومعالجة الصور المرفوعة تلقائيًا بدقة عالية.
          </div>
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

      // ---------------------------------------------------------------------
      // 4. Standard Form Controls (Selects, Modern Toggles, Color, Range)
      // ---------------------------------------------------------------------
      const row = document.createElement('div');
      row.className = `settings-field f-${field.type}`;

      const labelEl = document.createElement('label');
      labelEl.className = 'field-label';
      labelEl.textContent = field.label;

      let controlEl;

      // Select Dropdown
      if (field.type === 'select') {
        const selectWrap = document.createElement('div');
        selectWrap.className = 'modern-select-wrap';

        controlEl = document.createElement('select');
        controlEl.className = 'modern-field-select';
        controlEl.dataset.key = field.key;
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

        selectWrap.appendChild(controlEl);
        row.appendChild(labelEl);
        row.appendChild(selectWrap);
        groupBody.appendChild(row);
        return;
      }

      // Checkbox -> Modern Toggle Switch
      if (field.type === 'check') {
        const isChecked = !!(S[field.key] !== undefined ? S[field.key] : field.default);

        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'modern-toggle-switch';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'modern-toggle-input';
        chk.dataset.key = field.key;
        chk.checked = isChecked;

        const sliderSpan = document.createElement('span');
        sliderSpan.className = 'modern-toggle-slider';

        const statusSpan = document.createElement('span');
        statusSpan.className = 'modern-toggle-status';
        statusSpan.textContent = isChecked ? 'مُفعّل' : 'معطّل';

        chk.addEventListener('change', () => {
          pushStyleState();
          S[field.key] = chk.checked;
          statusSpan.textContent = chk.checked ? 'مُفعّل' : 'معطّل';
          saveSettings();
          debouncedUpdate(onUpdate);
        });

        toggleLabel.appendChild(chk);
        toggleLabel.appendChild(sliderSpan);
        toggleLabel.appendChild(statusSpan);

        row.appendChild(labelEl);
        row.appendChild(toggleLabel);
        groupBody.appendChild(row);
        return;
      }

      // Color Picker
      if (field.type === 'color') {
        controlEl = document.createElement('div');
        controlEl.className = 'modern-color-picker-wrap';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'modern-field-color';
        colorInput.dataset.key = field.key;
        colorInput.value = S[field.key] || field.default || '#000000';

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'modern-field-color-text';
        textInput.dataset.key = field.key;
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
        controlEl.className = 'modern-field-text';
        controlEl.dataset.key = field.key;
        controlEl.value = S[field.key] !== undefined ? S[field.key] : (field.default ?? '');
        controlEl.addEventListener('input', () => {
          S[field.key] = controlEl.value;
          saveSettings();
          debouncedUpdate(onUpdate);
        });
      } else if (field.type === 'range') {
        controlEl = document.createElement('div');
        controlEl.className = 'modern-range-with-number-wrap';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'modern-field-range';
        slider.dataset.key = field.key;
        slider.min = field.min;
        slider.max = field.max;
        slider.step = field.step || 1;
        slider.value = S[field.key] !== undefined ? S[field.key] : field.default;

        const numBoxWrap = document.createElement('div');
        numBoxWrap.className = 'range-number-box-wrap';

        const numBox = document.createElement('input');
        numBox.type = 'number';
        numBox.className = 'modern-field-number-box';
        numBox.dataset.key = field.key;
        numBox.min = field.min;
        numBox.max = field.max;
        numBox.step = field.step || 1;
        numBox.value = slider.value;

        const unitSpan = document.createElement('span');
        unitSpan.className = 'range-unit-tag';
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

        numBoxWrap.appendChild(numBox);
        if (field.unit) numBoxWrap.appendChild(unitSpan);

        controlEl.appendChild(slider);
        controlEl.appendChild(numBoxWrap);
      } else if (field.type === 'number') {
        controlEl = document.createElement('input');
        controlEl.type = 'number';
        controlEl.className = 'modern-field-number';
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

  // =========================================================================
  // 5. Category & Live Search Filtering Engine (All Schema Groups Mapped!)
  // =========================================================================
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
      } else if (currentSettingsTab === 'palette' && (g === 'colors' || g === 'presets')) {
        matchesTab = true;
      } else if (currentSettingsTab === 'page' && g === 'page') {
        matchesTab = true;
      } else if (currentSettingsTab === 'typography' && (g === 'typography' || g === 'questions')) {
        matchesTab = true;
      } else if (currentSettingsTab === 'essay' && g === 'essay') {
        matchesTab = true;
      } else if (currentSettingsTab === 'watermark' && g === 'watermark') {
        matchesTab = true;
      } else if (currentSettingsTab === 'cover' && (g === 'cover' || g === 'dividers')) {
        matchesTab = true;
      } else if (currentSettingsTab === 'dividers' && g === 'dividers') {
        matchesTab = true;
      } else if (currentSettingsTab === 'headerFooter' && g === 'headerFooter') {
        matchesTab = true;
      } else if (currentSettingsTab === 'answers' && g === 'answers') {
        matchesTab = true;
      }

      if (!matchesTab) {
        acc.style.display = 'none';
        return;
      }

      if (!searchVal) {
        acc.style.display = 'block';
        if (currentSettingsTab !== 'all') {
          acc.open = true;
        }
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
