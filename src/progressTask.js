// src/progressTask.js - Obsidian & Lime Unified Progress Component with Moving-Average ETA & Cancel
export class ProgressTask {
  /**
   * @param {Object} options
   * @param {HTMLElement|string} [options.container] - Host element or selector
   * @param {string} [options.title] - Initial task title in Arabic
   * @param {number} [options.total] - Total steps or items
   * @param {Function} [options.onCancel] - Cancellation callback
   * @param {boolean} [options.inline] - Whether to render inline or as floating modal overlay
   */
  constructor(options = {}) {
    this.container = typeof options.container === 'string'
      ? document.querySelector(options.container)
      : (options.container || null);
    this.title = options.title || 'جارِ المعالجة...';
    this.total = options.total || 0;
    this.current = 0;
    this.onCancel = options.onCancel || null;
    this.inline = !!options.inline;

    this.startTime = Date.now();
    this.lastTimestamp = Date.now();
    this.itemDurations = [];
    this.isCancelled = false;
    this.isDone = false;
    this.lastPercent = 0;
    this.hintCustomText = null;
    this.hintActionText = null;
    this.onHintAction = null;

    this.dom = null;
    this.timerInterval = null;
    this.longTaskTimer = null;

    this.mount();
    this.startTimers();
  }

  mount() {
    this.dom = document.createElement('div');
    this.dom.className = this.inline
      ? 'progress-task-inline glass-card'
      : 'progress-task-overlay';
    this.dom.setAttribute('role', 'progressbar');
    this.dom.setAttribute('aria-valuenow', '0');
    this.dom.setAttribute('aria-valuemin', '0');
    this.dom.setAttribute('aria-valuemax', '100');
    this.dom.setAttribute('aria-live', 'polite');

    const canCancelHtml = this.onCancel
      ? `<button type="button" class="btn-progress-cancel" id="btnCancelTask" title="إلغاء العملية">إلغاء</button>`
      : '';

    const contentHtml = `
      <div class="progress-task-card">
        <div class="progress-task-header">
          <div class="progress-task-status-row">
            <span class="progress-status-dot pulse"></span>
            <span class="progress-task-title" id="ptTitle">${this.escapeHTML(this.title)}</span>
          </div>
          ${canCancelHtml}
        </div>

        <div class="progress-track">
          <div class="progress-fill" id="ptFill" style="width: 0%"></div>
        </div>

        <div class="progress-meta-row">
          <span class="progress-percent" id="ptPercent">0%</span>
          <span class="progress-eta" id="ptEta">بنحسب الوقت...</span>
          <span class="progress-elapsed" id="ptElapsed">0:00</span>
        </div>

        <div class="progress-hint" id="ptHint" hidden>
          💡 بياخد وقت أكتر من المعتاد... (الملفات الكبيرة أو الـ OCR بتحتاج معالجة إضافية)
        </div>
      </div>
    `;

    this.dom.innerHTML = contentHtml;

    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(this.dom);
    } else {
      document.body.appendChild(this.dom);
    }

    if (this.onCancel) {
      const cancelBtn = this.dom.querySelector('#btnCancelTask');
      cancelBtn?.addEventListener('click', () => {
        this.cancel();
      });
    }
  }

  startTimers() {
    // 1. Elapsed timer updater
    this.timerInterval = setInterval(() => {
      if (this.isDone || this.isCancelled) return;
      const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
      const mins = Math.floor(elapsedSec / 60);
      const secs = (elapsedSec % 60).toString().padStart(2, '0');
      const el = this.dom?.querySelector('#ptElapsed');
      if (el) el.textContent = `${mins}:${secs}`;
    }, 1000);

    // 2. 15s long task hint
    this.longTaskTimer = setTimeout(() => {
      if (this.isDone || this.isCancelled) return;
      const hintEl = this.dom?.querySelector('#ptHint');
      if (hintEl) {
        if (this.hintCustomText) {
          hintEl.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
              <span>💡 ${this.escapeHTML(this.hintCustomText)}</span>
              ${this.hintActionText ? `<button type="button" class="btn-hint-action" id="btnHintAction">${this.escapeHTML(this.hintActionText)}</button>` : ''}
            </div>
          `;
          if (this.onHintAction) {
            hintEl.querySelector('#btnHintAction')?.addEventListener('click', () => {
              const cb = this.onHintAction;
              this.cancel();
              if (cb) cb();
            });
          }
        }
        hintEl.hidden = false;
      }
    }, 15000);
  }

  /**
   * Sets custom 15-second hint text and optional one-click action
   */
  setHintAction(tipText, buttonText, onAction) {
    this.hintCustomText = tipText;
    this.hintActionText = buttonText;
    this.onHintAction = onAction;
  }

  /**
   * Sets a live thumbnail image preview of the page currently being rendered
   * @param {string} thumbSrc - Data URL or object URL
   */
  setThumbnail(thumbSrc) {
    if (!this.dom || !thumbSrc) return;
    let thumbBox = this.dom.querySelector('.progress-thumb-box');
    if (!thumbBox) {
      thumbBox = document.createElement('div');
      thumbBox.className = 'progress-thumb-box';
      thumbBox.innerHTML = `<img class="progress-thumb-img" alt="معاينة الصفحة">`;
      const card = this.dom.querySelector('.progress-task-card');
      const track = this.dom.querySelector('.progress-track');
      if (card && track) {
        card.insertBefore(thumbBox, track);
      }
    }
    const img = thumbBox.querySelector('.progress-thumb-img');
    if (img) img.src = thumbSrc;
  }

  /**
   * Updates progress state with real moving-average ETA calculation
   * @param {number} current - Current step/item
   * @param {number} [total] - Optional new total
   * @param {string} [stageLabel] - Optional text update
   */
  update(current, total, stageLabel) {
    if (this.isCancelled || this.isDone) return;

    const now = Date.now();
    const itemDuration = now - this.lastTimestamp;
    this.lastTimestamp = now;

    if (current > this.current && itemDuration > 10) {
      this.itemDurations.push(itemDuration);
      if (this.itemDurations.length > 5) this.itemDurations.shift(); // Keep last 5 samples
    }

    this.current = current;
    if (typeof total === 'number' && total > 0) this.total = total;

    // Calculate percentage (monotonic, never decreases)
    let percent = 0;
    if (this.total > 0) {
      const rawPercent = Math.min(100, Math.round((this.current / this.total) * 100));
      percent = Math.max(this.lastPercent || 0, rawPercent);
      this.lastPercent = percent;
    }

    // Moving Average ETA calculation
    let etaText = 'بنحسب الوقت...';
    if (this.total > 0 && this.current > 0 && this.itemDurations.length > 0) {
      const avgDuration = this.itemDurations.reduce((a, b) => a + b, 0) / this.itemDurations.length;
      const remainingItems = Math.max(0, this.total - this.current);
      const etaSec = Math.round((remainingItems * avgDuration) / 1000);

      if (remainingItems === 0) {
        etaText = 'لحظات...';
      } else if (etaSec <= 2) {
        etaText = 'لحظات ونخلص...';
      } else if (etaSec < 30) {
        etaText = `باقي حوالي ${etaSec} ثانية`;
      } else if (etaSec < 60) {
        // Round to 5 seconds
        const rounded = Math.round(etaSec / 5) * 5;
        etaText = `باقي حوالي ${rounded} ثانية`;
      } else {
        const mins = Math.ceil(etaSec / 60);
        etaText = `باقي حوالي ${mins} دقيقة`;
      }
    }

    // Update DOM
    if (this.dom) {
      this.dom.setAttribute('aria-valuenow', percent.toString());
      const fillEl = this.dom.querySelector('#ptFill');
      const percentEl = this.dom.querySelector('#ptPercent');
      const titleEl = this.dom.querySelector('#ptTitle');
      const etaEl = this.dom.querySelector('#ptEta');

      if (fillEl) fillEl.style.width = `${percent}%`;
      if (percentEl) percentEl.textContent = `${percent}%`;
      if (stageLabel && titleEl) titleEl.textContent = stageLabel;
      if (etaEl) etaEl.textContent = etaText;
    }
  }

  cancel() {
    if (this.isCancelled || this.isDone) return;
    this.isCancelled = true;
    this.cleanup();

    if (this.dom) {
      const titleEl = this.dom.querySelector('#ptTitle');
      const etaEl = this.dom.querySelector('#ptEta');
      const cancelBtn = this.dom.querySelector('#btnCancelTask');
      const fillEl = this.dom.querySelector('#ptFill');

      if (titleEl) titleEl.textContent = 'تم إلغاء العملية ✕';
      if (etaEl) etaEl.textContent = 'اتلغى';
      if (cancelBtn) cancelBtn.remove();
      if (fillEl) fillEl.style.background = '#ef4444';
    }

    if (typeof this.onCancel === 'function') {
      this.onCancel();
    }

    setTimeout(() => this.destroy(), 1200);
  }

  done(successMessage = 'تمت العملية بنجاح ✓') {
    if (this.isDone || this.isCancelled) return;
    this.isDone = true;
    this.cleanup();

    if (this.dom) {
      this.dom.setAttribute('aria-valuenow', '100');
      const fillEl = this.dom.querySelector('#ptFill');
      const percentEl = this.dom.querySelector('#ptPercent');
      const titleEl = this.dom.querySelector('#ptTitle');
      const etaEl = this.dom.querySelector('#ptEta');
      const cancelBtn = this.dom.querySelector('#btnCancelTask');

      if (fillEl) {
        fillEl.style.width = '100%';
        fillEl.style.background = 'var(--accent-lime, #ccff00)';
      }
      if (percentEl) percentEl.textContent = '100%';
      if (titleEl) titleEl.textContent = successMessage;
      if (etaEl) etaEl.textContent = 'تم';
      if (cancelBtn) cancelBtn.remove();
    }

    setTimeout(() => this.destroy(), 900);
  }

  cleanup() {
    clearInterval(this.timerInterval);
    clearTimeout(this.longTaskTimer);
  }

  destroy() {
    this.cleanup();
    if (this.dom && this.dom.parentNode) {
      this.dom.remove();
    }
    this.dom = null;
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
}
