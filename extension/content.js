(function () {
  // Prevent duplicate injection
  if (window.hasFreeTranslateInjected) return;
  window.hasFreeTranslateInjected = true;

  // Helper to check if extension context is still valid
  function isExtensionContextValid() {
    try {
      return chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  // Language direction definitions
  const RTL_LANGS = new Set([
    "ar","arb_Arab","ary_Arab","arz_Arab","acm_Arab","acq_Arab","aeb_Arab",
    "ajp_Arab","apc_Arab","ars_Arab","he","heb_Hebr","fa","pes_Arab","prs_Arab",
    "ur","urd_Arab","yi","ydd_Hebr","ps","pbt_Arab","sd","snd_Arab",
    "uig_Arab","azb_Arab","ckb_Arab","kas_Arab","knc_Arab","bjn_Arab","min_Arab",
  ]);
  function isRtl(code) { return RTL_LANGS.has(code); }

  let currentSettings = {
    apiUrl: "http://localhost:8000",
    targetLang: "arb_Arab",
    triggerMode: "icon" // "icon", "auto", "menu"
  };
  let cachedLanguages = {};

  // Load settings from storage
  function loadSettings() {
    if (!isExtensionContextValid()) return;
    
    chrome.storage.local.get(["apiUrl", "targetLang", "triggerMode", "cachedLanguages"], (items) => {
      if (chrome.runtime.lastError) return;
      
      if (items.apiUrl) currentSettings.apiUrl = items.apiUrl;
      if (items.targetLang) currentSettings.targetLang = items.targetLang;
      if (items.triggerMode) currentSettings.triggerMode = items.triggerMode;
      if (items.cachedLanguages) cachedLanguages = items.cachedLanguages;
    });
  }
  loadSettings();

  // Listen for storage changes
  if (isExtensionContextValid()) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.apiUrl) currentSettings.apiUrl = changes.apiUrl.newValue;
      if (changes.targetLang) currentSettings.targetLang = changes.targetLang.newValue;
      if (changes.triggerMode) currentSettings.triggerMode = changes.triggerMode.newValue;
      if (changes.cachedLanguages) cachedLanguages = changes.cachedLanguages.newValue;
      if (changes.enableFullPage) {
        // Kill switch for full page translation
      }
      if (changes.extensionTheme && container) {
        container.setAttribute("data-theme", changes.extensionTheme.newValue);
      }
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "translatePage") {
        // Check kill switch
        chrome.storage.local.get(["enableFullPage"], (items) => {
          const enableFullPage = items.enableFullPage !== undefined ? items.enableFullPage : true;
          
          if (!enableFullPage) {
            sendResponse({ success: false, error: "Full page translation is disabled in settings" });
            return;
          }
          
          translatePage(message.apiUrl, message.targetLang)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        });
        return true; // Keep message channel open for async response
      }
    });
  }

  // UI elements structure using Shadow DOM to avoid host site CSS leakage
  let container = null;
  let shadow = null;
  let floatingIcon = null;
  let activeOverlay = null;
  let previousActiveElement = null;

  function initUI() {
    if (container) return;
    container = document.createElement("div");
    container.id = "freetranslate-shadow-wrapper";
    
    // Apply theme to container
    chrome.storage.local.get(["extensionTheme"], (items) => {
      const theme = items.extensionTheme || "dark";
      container.setAttribute("data-theme", theme);
    });

    // Inline wrapper style to isolate
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.pointerEvents = "none";
    container.style.zIndex = "2147483647"; // Keep on top

    document.body.appendChild(container);
    shadow = container.attachShadow({ mode: "open" });

    // Inject styles directly inside Shadow DOM
    const style = document.createElement("style");
    style.textContent = `
      /* ─────────────────────────────────────────────────────────────────────────────
         FreeTranslate Design System
         Dark glassmorphism theme + Neo-Brutalism light theme
         ───────────────────────────────────────────────────────────────────────────── */
      
      /* Reset & Basic Box Sizing */
      * { box-sizing: border-box; margin: 0; padding: 0; }
      
      /* Theme Variables - Dark Theme (Default) */
      :host {
        --bg-primary: #080808;
        --bg-glass: rgba(15, 15, 15, 0.92);
        --border-glass: rgba(255, 255, 255, 0.1);
        --border-glass-hover: rgba(255, 255, 255, 0.15);
        --text-primary: #ffffff;
        --text-secondary: rgba(255, 255, 255, 0.7);
        --text-tertiary: rgba(255, 255, 255, 0.5);
        --text-muted: rgba(255, 255, 255, 0.35);
        --danger: #ff4d4d;
        --success: #22c55e;
        --radius-sm: 8px;
        --radius-lg: 16px;
        --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        --glass-blur: blur(24px);
        --shadow-glass: 0 16px 48px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
        --shadow-offset: none;
        --border-width: 1px;
      }

      /* Neo-Brutalism Light Theme */
      [data-theme="neo-brutalism"] {
        --bg-primary: #ffffff;
        --bg-glass: #ffffff;
        --border-glass: #000000;
        --border-glass-hover: #000000;
        --text-primary: #000000;
        --text-secondary: #333333;
        --text-tertiary: #666666;
        --text-muted: #999999;
        --danger: #ff6b6b;
        --success: #6bcb77;
        --radius-sm: 0px;
        --radius-lg: 0px;
        --transition: 0.15s ease;
        --glass-blur: none;
        --shadow-glass: 6px 6px 0px #000000;
        --shadow-offset: 4px 4px 0px #000000;
        --border-width: 3px;
      }
      
      /* Trigger Button - Premium Glassmorphism */
      .ft-trigger-btn {
        position: absolute;
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.08);
        border: var(--border-width) solid var(--border-glass);
        border-radius: 50%;
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        pointer-events: auto;
        opacity: 0;
        transform: scale(0.4);
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
        z-index: 10000;
        user-select: none;
        font-weight: 600;
        font-size: 14px;
      }
      .ft-trigger-btn.visible {
        opacity: 1;
        transform: scale(1);
      }
      .ft-trigger-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: var(--border-glass-hover);
        color: #ffffff;
      }

      [data-theme="neo-brutalism"] .ft-trigger-btn {
        background: #ffffff;
        border: var(--border-width) solid #000000;
        color: #000000;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        box-shadow: var(--shadow-offset);
      }

      [data-theme="neo-brutalism"] .ft-trigger-btn:hover {
        background: var(--accent-white);
        transform: translate(-2px, -2px) scale(1);
        box-shadow: 6px 6px 0px #000000;
      }

      /* Main Card Overlay - Premium Glassmorphism */
      .ft-card {
        position: absolute;
        width: 380px;
        max-width: 90vw;
        background: var(--bg-glass);
        backdrop-filter: var(--glass-blur);
        -webkit-backdrop-filter: var(--glass-blur);
        border: var(--border-width) solid var(--border-glass);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-glass);
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        overflow: hidden;
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        z-index: 10000;
        opacity: 0;
        transform: translateY(12px) scale(0.96);
        transition: opacity 0.22s ease-out, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .ft-card.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      [data-theme="neo-brutalism"] .ft-card {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }

      /* Header */
      .ft-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding: 12px 16px;
        cursor: move;
        user-select: none;
      }
      .ft-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ft-header-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ft-title {
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.6);
      }
      .ft-close {
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        transition: all 0.15s;
        background: none;
        border: none;
        outline: none;
        padding: 4px;
        border-radius: 6px;
      }
      .ft-close:hover {
        color: #ff4d4d;
        background: rgba(255, 77, 77, 0.1);
      }

      /* In-card custom dropdown */
      .ft-custom-dropdown {
        position: relative;
        max-width: 140px;
      }

      .ft-dropdown-trigger {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #ffffff;
        font-size: 0.8rem;
        padding: 4px 8px;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        width: 100%;
      }

      .ft-dropdown-trigger:hover,
      .ft-dropdown-trigger:focus,
      .ft-custom-dropdown:focus-within .ft-dropdown-trigger {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.15);
        outline: none;
      }

      .ft-dropdown-value {
        flex: 1;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0.75rem;
      }

      .ft-dropdown-arrow {
        flex-shrink: 0;
        transition: transform 0.2s;
        color: rgba(255, 255, 255, 0.5);
      }

      .ft-custom-dropdown[aria-expanded="true"] .ft-dropdown-arrow {
        transform: rotate(180deg);
      }

      .ft-dropdown-menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        background: rgba(15, 15, 15, 0.98);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-8px);
        transition: all 0.2s;
        min-width: 100%;
      }

      .ft-custom-dropdown[aria-expanded="true"] .ft-dropdown-menu {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .ft-dropdown-item {
        padding: 6px 10px;
        font-family: inherit;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ft-dropdown-item:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #ffffff;
      }

      .ft-dropdown-item.selected {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        font-weight: 500;
      }

      .ft-dropdown-item.highlighted {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      /* Body Contents */
      .ft-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      /* Source Label */
      .ft-text-meta {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.4);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-weight: 600;
      }

      .ft-source-text {
        max-height: 100px;
        overflow-y: auto;
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.9rem;
        line-height: 1.6;
        border-left: 2px solid rgba(255, 255, 255, 0.1);
        padding-left: 10px;
        white-space: pre-wrap;
      }

      .ft-divider {
        height: 1px;
        background: linear-gradient(to right, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.1));
        margin: 4px 0;
      }

      /* Result area */
      .ft-result-container {
        min-height: 60px;
        display: flex;
        flex-direction: column;
        position: relative;
      }
      .ft-result-text {
        color: #ffffff;
        font-size: 0.95rem;
        line-height: 1.6;
        white-space: pre-wrap;
      }
      .ft-result-text.loading {
        color: rgba(255, 255, 255, 0.5);
        font-style: italic;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      /* Spinner animation - Premium */
      .ft-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.15);
        border-top: 2px solid rgba(255, 255, 255, 0.6);
        border-radius: 50%;
        animation: ft-spin 0.8s linear infinite;
      }
      @keyframes ft-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Copy Button - Premium Style */
      .ft-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 8px;
      }
      .ft-action-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.8rem;
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
      }
      .ft-action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        color: #ffffff;
      }
      .ft-retry-btn {
        background: transparent;
        border: 1px solid rgba(255, 77, 77, 0.3);
        color: #ff4d4d;
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 0.75rem;
        margin-left: 8px;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
      }
      .ft-retry-btn:hover {
        background: rgba(255, 77, 77, 0.15);
        border-color: #ff4d4d;
        color: #ff4d4d;
      }

      /* Scrollbar Styling */
      ::-webkit-scrollbar {
        width: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 3px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.25);
      }
    `;
    shadow.appendChild(style);

    // Global Esc key handler for overlay inside Shadow DOM
    document.addEventListener("keydown", handleEscapeKey);
  }

  function handleEscapeKey(e) {
    if (e.key === "Escape") {
      removeOverlay();
      removeFloatingIcon();
    }
  }

  function handleTabKey(e) {
    if (!activeOverlay) return;
    
    if (e.key === "Tab") {
      e.preventDefault();
      
      // Get all focusable elements in the overlay
      const focusableElements = activeOverlay.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      // If shift + tab, move to previous element, otherwise next element
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
        } else {
          const index = Array.from(focusableElements).indexOf(document.activeElement);
          const prevIndex = index > 0 ? index - 1 : focusableElements.length - 1;
          focusableElements[prevIndex].focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
        } else {
          const index = Array.from(focusableElements).indexOf(document.activeElement);
          const nextIndex = index < focusableElements.length - 1 ? index + 1 : 0;
          focusableElements[nextIndex].focus();
        }
      }
    }
  }

  // Helper to place element near selection bounding box
  function positionElementNearRect(element, rect) {
    let x = rect.left;
    let y = rect.bottom + 8; // place 8px below selection

    // Boundary check (right edge)
    const cardWidth = 380;
    if (x + cardWidth > window.innerWidth - 16) {
      x = window.innerWidth - cardWidth - 16;
    }
    // Boundary check (left edge)
    if (x < 16) {
      x = 16;
    }

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }

  // Remove existing UI elements with smooth transitions
  function removeFloatingIcon() {
    if (floatingIcon) {
      const el = floatingIcon;
      el.classList.remove("visible");
      setTimeout(() => {
        el.remove();
      }, 200);
      floatingIcon = null;
      document.removeEventListener("keydown", handleEscapeKey);
    }
  }

  function removeOverlay() {
    if (activeOverlay) {
      const el = activeOverlay;
      el.classList.remove("visible");
      setTimeout(() => {
        el.remove();
        // Restore focus to previously focused element
        if (previousActiveElement && previousActiveElement.focus) {
          previousActiveElement.focus();
        }
      }, 200);
      activeOverlay = null;
      document.removeEventListener("keydown", handleEscapeKey);
      document.removeEventListener("keydown", handleTabKey);
    }
  }

  // Clamped dragging within the visible viewport bounds
  function setupDrag(card, header) {
    let startX = 0, startY = 0, initialX = 0, initialY = 0;
    
    header.addEventListener("mousedown", dragStart);

    function dragStart(e) {
      // Ignore drags initiating from target select dropdown
      if (e.target.classList.contains("ft-custom-dropdown") || e.target.closest(".ft-custom-dropdown")) return;

      startX = e.clientX;
      startY = e.clientY;
      initialX = card.offsetLeft;
      initialY = card.offsetTop;
      
      document.addEventListener("mousemove", dragging);
      document.addEventListener("mouseup", dragEnd);
    }

    function dragging(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let nextX = initialX + dx;
      let nextY = initialY + dy;

      const cardWidth = card.offsetWidth || 380;
      const cardHeight = card.offsetHeight || 220;

      // Restrict horizontal movements
      const minX = 8;
      const maxX = window.innerWidth - cardWidth - 8;
      nextX = Math.max(minX, Math.min(maxX, nextX));

      // Restrict vertical movements
      const minY = 8;
      const maxY = window.innerHeight - cardHeight - 8;
      nextY = Math.max(minY, Math.min(maxY, nextY));

      card.style.left = `${nextX}px`;
      card.style.top = `${nextY}px`;
    }

    function dragEnd() {
      document.removeEventListener("mousemove", dragging);
      document.removeEventListener("mouseup", dragEnd);
    }
  }

  let activeTranslationController = null;

  // Modular translation fetch handler
  function requestTranslation(text, card) {
    if (activeTranslationController) {
      activeTranslationController.abort();
    }
    activeTranslationController = new AbortController();

    const resultContainer = card.querySelector(".ft-result-container");
    const copyBtn = card.querySelector(".copy-btn");

    // Loading State
    resultContainer.innerHTML = `
      <div class="ft-result-text loading">
        <div class="ft-spinner" aria-hidden="true"></div>
        Translating...
      </div>
    `;
    copyBtn.style.display = "none";

    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      resultContainer.innerHTML = `<div class="ft-result-text error-text" style="color:#f43f5e; font-size:11px;">Extension reloaded. Please refresh the page and try again.</div>`;
      return;
    }

    chrome.runtime.sendMessage({
      action: "fetch_translation",
      text: text,
      targetLang: currentSettings.targetLang,
      apiUrl: currentSettings.apiUrl
    }, (response) => {
      // If aborted, do not update UI with old response
      if (activeTranslationController && activeTranslationController.signal.aborted) {
        return;
      }
      
      // Check for runtime errors (including context invalidation)
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;
        if (errorMsg.includes('context') || errorMsg.includes('disconnected')) {
          resultContainer.innerHTML = `<div class="ft-result-text error-text" style="color:#f43f5e; font-size:11px;">Extension reloaded. Please refresh the page and try again.</div>`;
        } else {
          resultContainer.innerHTML = `<div class="ft-result-text error-text" style="color:#f43f5e; font-size:11px;">Extension runtime error: ${errorMsg} <button class="ft-retry-btn">Retry</button></div>`;
          bindRetry(resultContainer, text, card);
        }
        return;
      }

      if (response && response.success) {
        const translation = response.data.translation;
        const resolvedSrc = response.data.detected_source || "auto";
        const resTextEl = document.createElement("div");
        resTextEl.className = "ft-result-text";
        resTextEl.textContent = translation;
        
        // Match target language typography direction
        if (isRtl(currentSettings.targetLang)) {
          resTextEl.dir = "rtl";
          resTextEl.style.textAlign = "right";
        } else {
          resTextEl.dir = "ltr";
          resTextEl.style.textAlign = "left";
        }

        resultContainer.innerHTML = "";
        resultContainer.appendChild(resTextEl);

        // Update titles with dynamic detected tag
        card.querySelector(".ft-title").textContent = `FreeTranslate [${resolvedSrc}]`;

        // Enable clipboard copy
        copyBtn.style.display = "block";
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.replaceWith(newCopyBtn);
        newCopyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(translation).then(() => {
            newCopyBtn.textContent = "Copied!";
            setTimeout(() => { newCopyBtn.textContent = "Copy"; }, 2000);
          });
        });
      } else {
        const errMsg = response?.error || "Cannot connect to FreeTranslate server.";
        resultContainer.innerHTML = `<div class="ft-result-text error-text" style="color:#f43f5e; font-size:11px;">Error: ${errMsg} <button class="ft-retry-btn">Retry</button></div>`;
        bindRetry(resultContainer, text, card);
      }
    });
  }

  function bindRetry(container, text, card) {
    const btn = container.querySelector('.ft-retry-btn');
    if (btn) {
      btn.addEventListener('click', () => requestTranslation(text, card));
    }
  }

  // Create and display the overlay card
  function showTranslationOverlay(text, rect) {
    initUI();
    removeFloatingIcon();
    removeOverlay();

    // Save currently focused element to restore later
    previousActiveElement = document.activeElement;

    const card = document.createElement("div");
    card.className = "ft-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Translation overlay");
    card.setAttribute("aria-modal", "true");
    
    const header = document.createElement("div");
    header.className = "ft-header";
    header.setAttribute("role", "banner");
    header.innerHTML = `
      <div class="ft-header-left">
        <span class="ft-title">FreeTranslate</span>
      </div>
      <div class="ft-header-right">
        <div class="ft-custom-dropdown" tabindex="0" role="combobox" aria-label="Change target language" aria-expanded="false">
          <button class="ft-dropdown-trigger" type="button">
            <span class="ft-dropdown-value">Loading...</span>
            <svg class="ft-dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div class="ft-dropdown-menu" role="listbox">
            <div class="ft-dropdown-item selected" data-value="arb_Arab" role="option">Arabic [arb_Arab]</div>
          </div>
          <input type="hidden" class="ft-dropdown-hidden" value="arb_Arab">
        </div>
        <button class="ft-close" aria-label="Close translation overlay" title="Close">×</button>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "ft-body";
    body.setAttribute("role", "main");
    body.innerHTML = `
      <div class="ft-text-meta">Original Selection</div>
      <div class="ft-source-text" role="region" aria-label="Original text"></div>
      <div class="ft-divider"></div>
      <div class="ft-text-meta">Translation</div>
      <div class="ft-result-container" role="region" aria-live="polite" aria-label="Translation result"></div>
      <div class="ft-actions">
        <button class="ft-action-btn copy-btn" style="display:none;" aria-label="Copy translation to clipboard">Copy</button>
      </div>
    `;

    card.appendChild(header);
    card.appendChild(body);
    shadow.appendChild(card);
    activeOverlay = card;

    // Populating in-overlay custom dropdown
    const customDropdown = card.querySelector(".ft-custom-dropdown");
    const dropdownTrigger = card.querySelector(".ft-dropdown-trigger");
    const dropdownMenu = card.querySelector(".ft-dropdown-menu");
    const dropdownValue = card.querySelector(".ft-dropdown-value");
    const dropdownHidden = card.querySelector(".ft-dropdown-hidden");
    
    const activeLangs = Object.keys(cachedLanguages).length > 0 ? cachedLanguages : {
      "arb_Arab": "Arabic",
      "eng_Latn": "English",
      "spa_Latn": "Spanish",
      "fra_Latn": "French",
      "deu_Latn": "German",
      "zho_Hans": "Chinese"
    };

    const sortedLangs = Object.entries(activeLangs).sort((a, b) => a[1].localeCompare(b[1]));
    
    // Clear and populate dropdown menu
    dropdownMenu.innerHTML = '';
    for (const [code, label] of sortedLangs) {
      const cleanLabel = label.split(" [")[0];
      const item = document.createElement('div');
      item.className = 'ft-dropdown-item';
      item.dataset.value = code;
      item.textContent = cleanLabel;
      item.setAttribute('role', 'option');
      if (code === currentSettings.targetLang) {
        item.classList.add('selected');
        dropdownValue.textContent = cleanLabel;
        dropdownHidden.value = code;
      }
      dropdownMenu.appendChild(item);
    }

    // Custom dropdown functionality
    let isDropdownOpen = false;
    let selectedIndex = -1;
    const dropdownItems = Array.from(dropdownMenu.querySelectorAll('.ft-dropdown-item'));

    function toggleDropdown() {
      isDropdownOpen = !isDropdownOpen;
      customDropdown.setAttribute('aria-expanded', isDropdownOpen);
    }

    function closeDropdown() {
      isDropdownOpen = false;
      customDropdown.setAttribute('aria-expanded', 'false');
    }

    function selectItem(item) {
      dropdownItems.forEach(i => {
        i.classList.remove('selected');
        i.classList.remove('highlighted');
      });
      item.classList.add('selected');
      
      const value = item.dataset.value;
      const label = item.textContent;
      dropdownValue.textContent = label;
      dropdownHidden.value = value;
      
      selectedIndex = dropdownItems.indexOf(item);
      currentSettings.targetLang = value;
      
      // Persist chosen target to extension settings
      if (isExtensionContextValid()) {
        chrome.storage.local.set({ targetLang: value });
      }
      
      closeDropdown();
      
      // Re-translate selection
      requestTranslation(originalText, card);
    }

    dropdownTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    customDropdown.addEventListener('keydown', (e) => {
      if (!isDropdownOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          toggleDropdown();
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          closeDropdown();
          break;
        case 'ArrowDown':
          e.preventDefault();
          selectedIndex = (selectedIndex + 1) % dropdownItems.length;
          highlightItem(dropdownItems[selectedIndex]);
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectedIndex = (selectedIndex - 1 + dropdownItems.length) % dropdownItems.length;
          highlightItem(dropdownItems[selectedIndex]);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0) {
            selectItem(dropdownItems[selectedIndex]);
          }
          break;
      }
    });

    dropdownMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.ft-dropdown-item');
      if (item) {
        selectItem(item);
      }
    });

    document.addEventListener('click', (e) => {
      if (!customDropdown.contains(e.target)) {
        closeDropdown();
      }
    });

    function highlightItem(item) {
      dropdownItems.forEach(i => i.classList.remove('highlighted'));
      item.classList.add('highlighted');
      item.scrollIntoView({ block: 'nearest' });
    }

    // Set initial selection
    const currentItem = dropdownItems.find(i => i.dataset.value === currentSettings.targetLang);
    if (currentItem) {
      selectedIndex = dropdownItems.indexOf(currentItem);
      dropdownValue.textContent = currentItem.textContent;
    }

    // Populate source text
    card.querySelector(".ft-source-text").textContent = text;

    // Position and setup drag
    positionElementNearRect(card, rect);
    setupDrag(card, header);

    // Setup close button listener
    header.querySelector(".ft-close").addEventListener("click", () => {
      removeOverlay();
    });

    // Add keyboard focus trap
    document.addEventListener("keydown", handleTabKey);

    // Trigger animation frame for CSS transitions
    requestAnimationFrame(() => {
      card.classList.add("visible");
      // Set focus to the first focusable element (language select)
      const firstFocusable = card.querySelector('.ft-dropdown-trigger');
      if (firstFocusable) {
        firstFocusable.focus();
      }
    });

    // Run first translation
    requestTranslation(text, card);
  }

  // Handle manual selection events on screen
  document.addEventListener("mouseup", (e) => {
    // If clicking inside the Shadow DOM elements, ignore selection dismissal
    if (container && container.contains(e.target)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (!text) {
        removeFloatingIcon();
        return;
      }

      if (currentSettings.triggerMode === "menu") return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (currentSettings.triggerMode === "auto") {
        showTranslationOverlay(text, rect);
      } else if (currentSettings.triggerMode === "icon") {
        initUI();
        removeFloatingIcon();

        const trigger = document.createElement("button");
        trigger.className = "ft-trigger-btn";
        // SVG Translation Icon
        trigger.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
          </svg>
        `;

        // Center button directly above selected block
        trigger.style.left = `${rect.right - 8}px`;
        trigger.style.top = `${rect.top - 38}px`;

        shadow.appendChild(trigger);
        floatingIcon = trigger;

        // Animate visibility
        requestAnimationFrame(() => {
          trigger.classList.add("visible");
        });

        trigger.addEventListener("click", (evt) => {
          evt.stopPropagation();
          showTranslationOverlay(text, rect);
        });
      }
    }, 10);
  });

  // Dismiss overlays when selecting/clicking else on document
  document.addEventListener("mousedown", (e) => {
    if (container && container.contains(e.target)) return;
    removeOverlay();
  });

  // Listen for context menu calls forwarded by background script
  if (isExtensionContextValid()) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === "trigger_translation_overlay") {
        const selection = window.getSelection();
        let rect = null;

        if (selection.rangeCount > 0) {
          rect = selection.getRangeAt(0).getBoundingClientRect();
        } else {
          // Center viewport fallback
          rect = {
            left: window.innerWidth / 2 - 160,
            right: window.innerWidth / 2 + 160,
            top: window.innerHeight / 3,
            bottom: window.innerHeight / 3 + 40
          };
        }

        showTranslationOverlay(message.text, rect);
      }
    });
  }

  // Full Page Translation Function
  async function translatePage(apiUrl, targetLang) {
    try {
      // Collect all text nodes from the page
      const textNodes = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip empty text nodes and those inside scripts/styles
            if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
            if (node.parentElement.tagName === 'SCRIPT') return NodeFilter.FILTER_REJECT;
            if (node.parentElement.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
            if (node.parentElement.tagName === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
            if (node.parentElement.tagName === 'IFRAME') return NodeFilter.FILTER_REJECT;
            
            // Skip very short text nodes (likely UI elements)
            if (node.textContent.trim().length < 2) return NodeFilter.FILTER_REJECT;
            
            // Skip if parent has contenteditable (likely input fields)
            if (node.parentElement.isContentEditable) return NodeFilter.FILTER_REJECT;
            
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }

      if (textNodes.length === 0) {
        return { success: true, translatedNodes: 0 };
      }

      let translatedCount = 0;
      
      // Process text nodes in smaller batches to avoid overwhelming the API
      const batchSize = 5; // Process 5 nodes at a time
      for (let i = 0; i < textNodes.length; i += batchSize) {
        const batch = textNodes.slice(i, i + batchSize);
        const translationPromises = batch.map(async (node) => {
          const text = node.textContent.trim();
          
          try {
            const response = await fetch(`${apiUrl}/api/translate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: text,
                source_lang: "auto",
                target_lang: targetLang
              })
            });

            if (!response.ok) {
              console.error(`Translation failed for: ${text.substring(0, 50)}...`);
              return null;
            }

            const data = await response.json();
            return { node, translation: data.translation };
          } catch (error) {
            console.error(`Translation error for: ${text.substring(0, 50)}...`, error);
            return null;
          }
        });

        const results = await Promise.all(translationPromises);
        
        // Apply translations
        results.forEach(result => {
          if (result && result.translation) {
            result.node.textContent = result.translation;
            translatedCount++;
          }
        });
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < textNodes.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return { success: true, translatedNodes: translatedCount };
    } catch (error) {
      console.error("Full page translation error:", error);
      throw error;
    }
  }
})();
