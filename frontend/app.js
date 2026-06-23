/**
 * FreeTranslate Client Logic
 * Handles state management, UI bindings, and API communication.
 */

// ── Application State ────────────────────────────────────────────────────────
const state = {
  cudaAvailable: false,
  device: 'cpu',
  modelKey: 'nllb_600M',
  isTranslating: false,
  abortController: null,
  rtlLangs: new Set([
    "ar","arb_Arab","ary_Arab","arz_Arab","acm_Arab","acq_Arab","aeb_Arab",
    "ajp_Arab","apc_Arab","ars_Arab","he","heb_Hebr","fa","pes_Arab","prs_Arab",
    "ur","urd_Arab","yi","ydd_Hebr","ps","pbt_Arab","sd","snd_Arab",
    "uig_Arab","azb_Arab","ckb_Arab","kas_Arab","knc_Arab","bjn_Arab","min_Arab"
  ])
};

// ── Theme Toggle ───────────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
let currentTheme = localStorage.getItem('theme') || 'dark';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'neo-brutalism' ? 'neo-brutalism' : '');
  themeIcon.textContent = theme === 'neo-brutalism' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
  currentTheme = theme;
}

// Apply saved theme on load
if (themeToggle && themeIcon) {
  applyTheme(currentTheme);
  
  themeToggle.addEventListener('click', () => {
    const newTheme = currentTheme === 'dark' ? 'neo-brutalism' : 'dark';
    applyTheme(newTheme);
  });
}

const DEFAULT_DEFAULTS = {
  nllb_600M: { src: "eng_Latn", tgt: "arb_Arab" },
  nllb_1_3B: { src: "eng_Latn", tgt: "arb_Arab" }
};

// ── DOM Elements ─────────────────────────────────────────────────────────────
const UI = {
  statusPill: document.getElementById('status-pill'),
  modelSelect: document.getElementById('model-select'),
  deviceToggle: document.getElementById('device-toggle'),
  applyBtn: document.getElementById('apply-btn'),
  streamToggle: document.getElementById('stream-toggle'),
  
  srcLangSel: document.getElementById('source-lang-select'),
  tgtLangSel: document.getElementById('target-lang-select'),
  swapBtn: document.getElementById('swap-btn'),
  
  sourceInput: document.getElementById('source-input'),
  charCount: document.getElementById('source-char-count'),
  
  targetOutput: document.getElementById('target-output'),
  loadingSkeleton: document.getElementById('loading-skeleton'),
  copyBtn: document.getElementById('copy-btn'),
  downloadBtn: document.getElementById('download-btn'),
  
  clearBtn: document.getElementById('clear-btn'),
  fileInput: document.getElementById('file-input'),
  fileName: document.getElementById('file-name'),
  
  docInput: document.getElementById('doc-input'),
  docDownload: document.getElementById('doc-download'),
  
  translateBtn: document.getElementById('translate-btn'),
  stopBtn: document.getElementById('stop-btn'),
  toast: document.getElementById('toast')
};

// ── Utility Functions ────────────────────────────────────────────────────────
function setStatus(text, type = 'normal') {
  UI.statusPill.textContent = text;
  UI.statusPill.className = 'status-pill';
  if (type !== 'normal') UI.statusPill.classList.add(type);
}

function showToast(message) {
  UI.toast.textContent = message;
  UI.toast.classList.add('show');
  setTimeout(() => UI.toast.classList.remove('show'), 2500);
}

function isRtl(code) {
  return state.rtlLangs.has(code);
}

function updateDirectionality() {
  const src = UI.srcLangSel.value;
  const tgt = UI.tgtLangSel.value;
  UI.sourceInput.dir = (src === 'auto' || !isRtl(src)) ? 'ltr' : 'rtl';
  UI.targetOutput.dir = isRtl(tgt) ? 'rtl' : 'ltr';
}

function updateCharCount() {
  const count = UI.sourceInput.value.length;
  UI.charCount.textContent = `${count.toLocaleString()} chars`;
}

// ── API Operations ───────────────────────────────────────────────────────────
async function initApp() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    
    state.cudaAvailable = data.cuda_available;
    state.device = data.active_device || data.default_device;
    state.modelKey = data.active_model_key || data.default_model_key;
    
    UI.modelSelect.value = state.modelKey;
    UI.deviceToggle.textContent = `Device: ${state.device.toUpperCase()}`;
    setStatus('Ready', 'connected');
    
    await fetchLanguages();
  } catch (err) {
    console.error('Failed to initialize:', err);
    setStatus('Server offline', 'error');
  }
}

async function fetchLanguages() {
  try {
    const res = await fetch('/api/languages');
    const data = await res.json();
    populateLangDropdowns(data.languages, data.default_source, data.default_target);
  } catch(e) {
    console.error('Failed to fetch languages', e);
    setStatus('Failed to load languages', 'error');
  }
}

function populateLangDropdowns(languages, defaultSrc, defaultTgt) {
  const prevSrc = UI.srcLangSel.value;
  const prevTgt = UI.tgtLangSel.value;

  const entries = Object.entries(languages).sort((a,b) => a[1].localeCompare(b[1]));
  
  // Prepare options arrays for custom dropdowns
  const srcOptions = [{ value: 'auto', label: 'Auto Detect' }];
  const tgtOptions = [];
  
  for (const [code, label] of entries) {
    // Keep dropdowns compact
    const cleanLabel = label.split(" [")[0];
    const displayLabel = `${cleanLabel} [${code}]`;
    
    srcOptions.push({ value: code, label: displayLabel });
    tgtOptions.push({ value: code, label: displayLabel });
  }

  // Update custom dropdowns
  if (window.customDropdowns) {
    window.customDropdowns.source.setOptions(srcOptions);
    window.customDropdowns.target.setOptions(tgtOptions);
  }

  // Set values using hidden inputs
  UI.srcLangSel.value = (prevSrc && srcOptions.find(o => o.value === prevSrc)) ? prevSrc : defaultSrc;
  UI.tgtLangSel.value = (prevTgt && tgtOptions.find(o => o.value === prevTgt)) ? prevTgt : defaultTgt;
  
  // Update custom dropdown selections
  if (window.customDropdowns) {
    window.customDropdowns.source.setValue(UI.srcLangSel.value);
    window.customDropdowns.target.setValue(UI.tgtLangSel.value);
  }

  updateDirectionality();
}

async function handleApplyModel() {
  setStatus('Loading model...');
  UI.applyBtn.disabled = true;
  try {
    const res = await fetch('/api/reload', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({model_key: state.modelKey, device: state.device})
    });
    const data = await res.json();
    if (data.ok) {
      setStatus('Model loaded', 'connected');
      await fetchLanguages();
    } else {
      setStatus('Failed to load model', 'error');
    }
  } catch (e) {
    setStatus('Connection failed', 'error');
  } finally {
    UI.applyBtn.disabled = false;
  }
}

async function handleTranslation() {
  const text = UI.sourceInput.value;
  if (!text.trim()) {
    showToast('Please enter some text to translate');
    return;
  }

  // Cleanup previous state
  if (state.abortController) {
    state.abortController.abort();
  }
  state.abortController = new AbortController();
  
  state.isTranslating = true;
  UI.translateBtn.disabled = true;
  UI.stopBtn.disabled = false;
  
  // UI Loading State
  UI.targetOutput.innerHTML = '';
  UI.targetOutput.className = 'output-text translating';
  UI.loadingSkeleton.classList.add('active');
  UI.copyBtn.classList.add('hidden');
  UI.downloadBtn.classList.add('hidden');
  setStatus('Translating...');

  const srcLang = UI.srcLangSel.value === 'auto' ? null : UI.srcLangSel.value;
  const tgtLang = UI.tgtLangSel.value || null;
  const useStream = UI.streamToggle.checked;

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text, source_lang: srcLang, target_lang: tgtLang, stream: useStream}),
      signal: state.abortController.signal
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (useStream) {
      UI.loadingSkeleton.classList.remove('active');
      UI.targetOutput.classList.remove('translating');
      UI.targetOutput.classList.remove('empty');
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim());
            if (payload.done) break;
            if (payload.token) {
              UI.targetOutput.textContent += payload.token;
              // Smooth auto-scroll to bottom as text arrives
              UI.targetOutput.parentElement.scrollTop = UI.targetOutput.parentElement.scrollHeight;
            }
          } catch(e) {}
        }
      }
    } else {
      const data = await res.json();
      UI.loadingSkeleton.classList.remove('active');
      UI.targetOutput.classList.remove('translating');
      UI.targetOutput.classList.remove('empty');
      
      if (data.error) {
        throw new Error(data.error);
      }
      
          UI.targetOutput.innerHTML = ''; // Clear empty state
      UI.targetOutput.textContent = data.translation;
      
      // Update auto-detect UI if applicable
      if (UI.srcLangSel.value === 'auto' && data.detected_source) {
        if (window.customDropdowns) {
          const sourceDropdown = window.customDropdowns.source;
          const currentValue = sourceDropdown.getValue();
          
          // Find the detected language label
          const items = sourceDropdown.items;
          const detectedItem = items.find(i => i.dataset.value === data.detected_source);
          
          if (detectedItem) {
            const detectedLabel = detectedItem.textContent.split(' [')[0];
            const displayElement = sourceDropdown.valueDisplay;
            const originalText = displayElement.textContent;
            
            // Show detected language temporarily
            displayElement.textContent = `Auto: ${detectedLabel}`;
            
            // Restore after 4 seconds
            setTimeout(() => {
              if (sourceDropdown.getValue() === 'auto') {
                displayElement.textContent = originalText;
              }
            }, 4000);
          }
        }
      }
    }

    // Success finalization
    if (UI.targetOutput.textContent.trim()) {
      UI.copyBtn.classList.remove('hidden');
      UI.downloadBtn.classList.remove('hidden');
      setStatus('Translation complete', 'connected');
    }

  } catch (err) {
    UI.loadingSkeleton.classList.remove('active');
    UI.targetOutput.classList.remove('translating');
    
    if (err.name === 'AbortError') {
      UI.targetOutput.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">⏹️</span>
          <p class="empty-state-title">Translation stopped by user</p>
          <small class="empty-state-subtitle">Press Translate to try again</small>
        </div>
      `;
      UI.targetOutput.className = 'output-text empty';
      setStatus('Translation stopped');
    } else {
      UI.targetOutput.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">❌</span>
          <p class="empty-state-title">Translation failed</p>
          <small class="empty-state-subtitle">Please check your connection and try again</small>
        </div>
      `;
      UI.targetOutput.className = 'output-text error-state';
      setStatus('Translation failed', 'error');
    }
  } finally {
    state.isTranslating = false;
    UI.translateBtn.disabled = false;
    UI.stopBtn.disabled = true;
    state.abortController = null;
  }
}

// ── Event Listeners ──────────────────────────────────────────────────────────
UI.sourceInput.addEventListener('input', updateCharCount);

UI.sourceInput.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    handleTranslation();
  }
  // Allow Esc to stop
  if (e.key === 'Escape' && state.isTranslating) {
    if (state.abortController) state.abortController.abort();
  }
});

// Global Esc handler for stopping
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.isTranslating) {
    if (state.abortController) state.abortController.abort();
  }
});

UI.stopBtn.addEventListener('click', () => {
  if (state.abortController) state.abortController.abort();
});

UI.translateBtn.addEventListener('click', handleTranslation);

UI.deviceToggle.addEventListener('click', () => {
  state.device = state.device === 'cpu' ? 'cuda' : 'cpu';
  if (state.device === 'cuda' && !state.cudaAvailable) {
    state.device = 'cpu';
    showToast('CUDA not available on this system');
  }
  UI.deviceToggle.textContent = `Device: ${state.device.toUpperCase()}`;
});

UI.applyBtn.addEventListener('click', handleApplyModel);

// Custom dropdown event listeners
document.addEventListener('languageChange', (e) => {
  const { type, value } = e.detail;
  if (type === 'source') {
    UI.srcLangSel.value = value;
  } else if (type === 'target') {
    UI.tgtLangSel.value = value;
  }
  updateDirectionality();
});

document.addEventListener('modelChange', (e) => {
  const { value } = e.detail;
  state.modelKey = value;
  UI.modelSelect.value = value;
  setStatus('Click "Load Model" to apply changes');
});

// Fallback for when custom dropdowns aren't loaded yet
UI.srcLangSel.addEventListener('change', updateDirectionality);
UI.tgtLangSel.addEventListener('change', updateDirectionality);

UI.swapBtn.addEventListener('click', () => {
  const resultText = UI.targetOutput.textContent.trim();
  const isErrorOrEmpty = UI.targetOutput.classList.contains('empty') || UI.targetOutput.classList.contains('error-state');
  
  if (resultText && !isErrorOrEmpty) {
    UI.sourceInput.value = resultText;
    updateCharCount();
  }
  
  UI.targetOutput.innerHTML = `
    <div class="empty-state">
      <span class="empty-state-icon">🌍</span>
      <p class="empty-state-title">Translation will appear here</p>
      <small class="empty-state-subtitle">Enter text and press Ctrl+Enter to translate</small>
    </div>
  `;
  UI.targetOutput.className = 'output-text empty';
  UI.copyBtn.classList.add('hidden');
  UI.downloadBtn.classList.add('hidden');

  const srcVal = UI.srcLangSel.value === 'auto' ? DEFAULT_DEFAULTS[state.modelKey]?.src : UI.srcLangSel.value;
  const tgtVal = UI.tgtLangSel.value;
  
  // Swap values using custom dropdowns
  if (window.customDropdowns) {
    const sourceDropdown = window.customDropdowns.source;
    const targetDropdown = window.customDropdowns.target;
    
    // Check if source value exists in target dropdown
    if (srcVal && targetDropdown.items.find(i => i.dataset.value === srcVal)) {
      targetDropdown.setValue(srcVal);
      UI.tgtLangSel.value = srcVal;
    }
    
    // Check if target value exists in source dropdown (and not auto)
    if (tgtVal && tgtVal !== 'auto' && sourceDropdown.items.find(i => i.dataset.value === tgtVal)) {
      sourceDropdown.setValue(tgtVal);
      UI.srcLangSel.value = tgtVal;
    }
  }

  updateDirectionality();
  UI.sourceInput.focus();
});

UI.clearBtn.addEventListener('click', () => {
  UI.sourceInput.value = '';
  updateCharCount();
  UI.targetOutput.innerHTML = `
    <div class="empty-state">
      <span class="empty-state-icon">🌍</span>
      <p class="empty-state-title">Translation will appear here</p>
      <small class="empty-state-subtitle">Enter text and press Ctrl+Enter to translate</small>
    </div>
  `;
  UI.targetOutput.className = 'output-text empty';
  UI.fileInput.value = '';
  UI.fileName.textContent = '';
  UI.copyBtn.classList.add('hidden');
  UI.downloadBtn.classList.add('hidden');
  UI.sourceInput.focus();
});

UI.copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(UI.targetOutput.textContent);
    showToast('Translation copied to clipboard!');
  } catch (err) {
    showToast('Failed to copy text.');
  }
});

UI.downloadBtn.addEventListener('click', () => {
  const text = UI.targetOutput.textContent;
  const blob = new Blob([text], {type:'text/plain;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; 
  a.download = `translation_${Date.now()}.txt`;
  document.body.appendChild(a); 
  a.click();
  document.body.removeChild(a); 
  URL.revokeObjectURL(url);
});

// File upload handlers
UI.fileInput.addEventListener('change', e => {
  const file = e.target.files[0]; 
  if (!file) return;
  UI.fileName.textContent = file.name;
  const reader = new FileReader();
  reader.onload = evt => { 
    UI.sourceInput.value = evt.target.result; 
    updateCharCount();
  };
  reader.readAsText(file);
});

UI.docInput.addEventListener('change', async e => {
  const file = e.target.files[0]; 
  if (!file) return;
  
  setStatus('Translating document...');
  UI.docDownload.classList.remove('visible');
  
  const fd = new FormData();
  fd.append('file', file);
  
  const src = UI.srcLangSel.value === 'auto' ? '' : UI.srcLangSel.value;
  const tgt = UI.tgtLangSel.value;
  const params = new URLSearchParams();
  if (src) params.set('source_lang', src);
  if (tgt) params.set('target_lang', tgt);
  
  try {
    const res = await fetch(`/api/translate/document?${params.toString()}`, {method:'POST', body:fd});
    if (!res.ok) throw new Error('Doc translation failed');
    
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const nameMatch = disposition.match(/filename="([^"]+)"/);
    const outName = nameMatch ? nameMatch[1] : `translated_${file.name}`;
    
    const url = URL.createObjectURL(blob);
    UI.docDownload.href = url;
    UI.docDownload.download = outName;
    UI.docDownload.textContent = `↓ ${outName}`;
    UI.docDownload.classList.add('visible');
    
    setStatus('Document translated', 'connected');
    showToast('Document translated successfully.');
  } catch(err) {
    setStatus('Document translation failed', 'error');
    showToast('Failed to translate document.');
  } finally {
    // Reset input so the same file can be selected again
    UI.docInput.value = '';
  }
});

// ── Initialization ───────────────────────────────────────────────────────────
initApp();
