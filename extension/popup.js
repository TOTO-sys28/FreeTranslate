document.addEventListener("DOMContentLoaded", () => {
  const apiUrlInput = document.getElementById("api-url");
  const triggerModeInput = document.getElementById("trigger-mode");
  const targetLangInput = document.getElementById("target-lang");
  const saveBtn = document.getElementById("save-btn");
  const translatePageBtn = document.getElementById("translate-page-btn");
  const enableFullPageCheckbox = document.getElementById("enable-full-page");
  const themeToggleBtn = document.getElementById("theme-toggle");
  const statusMsg = document.getElementById("status-msg");
  const statusDot = document.getElementById("status-dot");
  const statusLabel = document.getElementById("status-label");

  let currentTargetLang = "arb_Arab";

  // Theme Toggle
  let currentTheme = localStorage.getItem("extensionTheme") || "dark";
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme === "neo-brutalism" ? "neo-brutalism" : "");
    themeToggleBtn.textContent = theme === "neo-brutalism" ? "☀️" : "🌙";
    localStorage.setItem("extensionTheme", theme);
    chrome.storage.local.set({ extensionTheme: theme }); // Save for content script
    currentTheme = theme;
  }
  
  // Load theme from storage first if available
  chrome.storage.local.get(["extensionTheme"], (items) => {
    if (items.extensionTheme) {
      currentTheme = items.extensionTheme;
    }
    applyTheme(currentTheme);
  });
  
  themeToggleBtn.addEventListener("click", () => {
    const newTheme = currentTheme === "dark" ? "neo-brutalism" : "dark";
    applyTheme(newTheme);
  });

  // Default fallback language list if server is offline
  const DEFAULT_LANGS = {
    "arb_Arab": "Arabic [arb_Arab]",
    "eng_Latn": "English [eng_Latn]",
    "spa_Latn": "Spanish [spa_Latn]",
    "fra_Latn": "French [fra_Latn]",
    "deu_Latn": "German [deu_Latn]",
    "zho_Hans": "Chinese [zho_Hans]"
  };

  // 1. Load settings from storage
  chrome.storage.local.get(["apiUrl", "triggerMode", "targetLang", "enableFullPage"], (items) => {
    const apiUrl = items.apiUrl || "http://localhost:8000";
    const triggerMode = items.triggerMode || "icon";
    currentTargetLang = items.targetLang || "arb_Arab";
    const enableFullPage = items.enableFullPage !== undefined ? items.enableFullPage : true;

    apiUrlInput.value = apiUrl;
    enableFullPageCheckbox.checked = enableFullPage;
    
    // Disable translate page button if full page translation is disabled
    translatePageBtn.disabled = !enableFullPage;
    translatePageBtn.style.opacity = enableFullPage ? "1" : "0.5";
    
    // Wait for custom dropdowns to initialize
    setTimeout(() => {
      if (window.customDropdowns) {
        window.customDropdowns.triggerMode.setValue(triggerMode);
        window.customDropdowns.targetLang.setValue(currentTargetLang);
      }
    }, 100);

    checkServerAndLoadLanguages(apiUrl);
  });

  // 2. Test server connectivity and load full language directory
  async function checkServerAndLoadLanguages(url) {
    statusDot.className = "status-dot";
    statusLabel.textContent = "Checking server...";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${url}/api/languages`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        statusDot.className = "status-dot online";
        statusLabel.textContent = `Online (${data.model_key})`;

        populateLanguages(data.languages);
        
        chrome.storage.local.set({ cachedLanguages: data.languages });
      } else {
        throw new Error("HTTP error checking languages");
      }
    } catch (e) {
      statusDot.className = "status-dot offline";
      statusLabel.textContent = "Offline – check server is running";
      
      populateLanguages(DEFAULT_LANGS);
    }
  }

  function populateLanguages(languages) {
    if (!window.customDropdowns) return;
    
    const targetDropdown = window.customDropdowns.targetLang;
    const entries = Object.entries(languages).sort((a, b) => a[1].localeCompare(b[1]));
    
    const options = entries.map(([code, label]) => ({
      value: code,
      label: label.includes("[") ? label : `${label} [${code}]`
    }));
    
    // Update dropdown items
    const menu = targetDropdown.menu;
    menu.innerHTML = '';
    
    options.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.dataset.value = opt.value;
      item.textContent = opt.label;
      item.setAttribute('role', 'option');
      menu.appendChild(item);
    });
    
    targetDropdown.updateItemsFromMenu();
    
    // Apply previously saved selection
    const targetLangValue = targetLangInput.value || currentTargetLang;
    if (options.find(o => o.value === targetLangValue)) {
      targetDropdown.setValue(targetLangValue);
    } else {
      targetDropdown.setValue(options[0].value);
    }
  }

  let checkDebounce;
  apiUrlInput.addEventListener("input", () => {
    clearTimeout(checkDebounce);
    checkDebounce = setTimeout(() => {
      checkServerAndLoadLanguages(apiUrlInput.value.trim());
    }, 800);
  });

  // 3. Save Settings
  saveBtn.addEventListener("click", () => {
    const apiUrl = apiUrlInput.value.trim() || "http://localhost:8000";
    const triggerMode = triggerModeInput.value;
    const targetLang = targetLangInput.value;
    const enableFullPage = enableFullPageCheckbox.checked;

    chrome.storage.local.set({
      apiUrl: apiUrl,
      triggerMode: triggerMode,
      targetLang: targetLang,
      enableFullPage: enableFullPage
    }, () => {
      statusMsg.textContent = "Configuration saved successfully!";
      statusMsg.className = "status-text success";
      setTimeout(() => { statusMsg.textContent = ""; statusMsg.className = "status-text"; }, 2500);
    });
  });

  // Kill switch toggle
  enableFullPageCheckbox.addEventListener("change", () => {
    translatePageBtn.disabled = !enableFullPageCheckbox.checked;
    translatePageBtn.style.opacity = enableFullPageCheckbox.checked ? "1" : "0.5";
    
    // Save setting immediately
    chrome.storage.local.set({ enableFullPage: enableFullPageCheckbox.checked });
  });

  // 4. Full Page Translation
  translatePageBtn.addEventListener("click", async () => {
    const apiUrl = apiUrlInput.value.trim() || "http://localhost:8000";
    const targetLang = targetLangInput.value;
    
    translatePageBtn.disabled = true;
    translatePageBtn.textContent = "Translating...";
    statusMsg.textContent = "Translating page...";
    statusMsg.className = "status-text";

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        throw new Error("No active tab found");
      }
      
      // Send message to content script to translate the page
      chrome.tabs.sendMessage(tab.id, {
        action: "translatePage",
        apiUrl: apiUrl,
        targetLang: targetLang
      }, (response) => {
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }
        
        if (response && response.success) {
          statusMsg.textContent = `Page translated! (${response.translatedNodes} text nodes)`;
          statusMsg.className = "status-text success";
        } else {
          throw new Error(response?.error || "Translation failed");
        }
        
        translatePageBtn.disabled = false;
        translatePageBtn.textContent = "Translate Entire Page";
      });
      
    } catch (error) {
      console.error("Page translation error:", error);
      statusMsg.textContent = `Error: ${error.message}`;
      statusMsg.className = "status-text error";
      translatePageBtn.disabled = false;
      translatePageBtn.textContent = "Translate Entire Page";
    }
  });
});
