// background.js

// Create the context menu when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "translate-selection",
      title: "Translate Selection",
      contexts: ["selection"]
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "translate-selection" || !tab?.id || !info.selectionText) {
    return;
  }

  chrome.tabs.sendMessage(
    tab.id,
    {
      action: "trigger_translation_overlay",
      text: info.selectionText
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("Content script not available:", chrome.runtime.lastError.message);
      }
    }
  );
});

// Proxy translation requests from content scripts to the local backend
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action !== "fetch_translation") {
    return;
  }

  const { text, sourceLang, targetLang, apiUrl } = request;
  const baseUrl = (apiUrl || "http://localhost:8000").replace(/\/$/, "");

  fetch(`${baseUrl}/api/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text,
      source_lang: sourceLang || null,
      target_lang: targetLang || null,
      stream: false
    })
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Server returned HTTP ${response.status}${errorText ? `: ${errorText}` : ""}`
        );
      }
      return response.json();
    })
    .then((data) => {
      sendResponse({ success: true, data });
    })
    .catch((error) => {
      console.error("Translation proxy error:", error);
      sendResponse({ success: false, error: error.message || "Unknown error" });
    });

  return true; // Keep the message channel open for async response
});