const MENU_ANALYZE = "visual-prompt-analyze-image";
const MENU_CAPTURE = "visual-prompt-capture-region";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ANALYZE,
      title: "Prepare ChatGPT prompt from this image",
      contexts: ["image"]
    });
    chrome.contextMenus.create({
      id: MENU_CAPTURE,
      title: "Capture area for a ChatGPT prompt",
      contexts: ["page"]
    });
  });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) await openPanel(tab.windowId);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !tab.windowId) return;

  if (info.menuItemId === MENU_ANALYZE) {
    await captureImageElement(tab, info.srcUrl || "");
  }

  if (info.menuItemId === MENU_CAPTURE) {
    await captureVisibleForCrop(tab);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "START_REGION_CAPTURE") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) throw new Error("No active tab found.");
      await captureVisibleForCrop(tab);
      sendResponse({ ok: true });
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HANDOFF_TO_CHATGPT") {
    handoffToChatGpt(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }
});

async function captureImageElement(tab, srcUrl) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: locateImage,
      args: [srcUrl]
    });

    if (!result?.bounds) throw new Error("The selected image is not currently visible.");
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await setPendingCapture({
      kind: "crop",
      dataUrl: screenshotDataUrl,
      bounds: result.bounds,
      sourceUrl: tab.url || "",
      capturedAt: Date.now()
    });
    await openPanel(tab.windowId);
  } catch (error) {
    await setPendingCapture({ kind: "error", error: readableError(error), capturedAt: Date.now() });
    await openPanel(tab.windowId);
  }
}

function locateImage(srcUrl) {
  const images = [...document.images];
  const normalized = (value) => {
    try { return new URL(value, location.href).href; } catch { return value; }
  };
  const wanted = normalized(srcUrl);
  const exact = images.find((image) => normalized(image.currentSrc || image.src) === wanted);
  const element = exact || images
    .filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width > 30 && rect.height > 30 && rect.bottom > 0 && rect.top < innerHeight;
    })
    .sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    })[0];

  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(innerWidth, rect.right);
  const bottom = Math.min(innerHeight, rect.bottom);
  if (right <= left || bottom <= top) return null;

  return {
    bounds: {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight
    }
  };
}

async function captureVisibleForCrop(tab) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await setPendingCapture({
      kind: "manual-crop",
      dataUrl,
      sourceUrl: tab.url || "",
      capturedAt: Date.now()
    });
    await openPanel(tab.windowId);
  } catch (error) {
    const url = tab.url || "";
    const detail = readableError(error);
    const protectedPage = /^(chrome|chrome-extension|devtools|edge|about):/i.test(url)
      || /^https:\/\/chromewebstore\.google\.com\//i.test(url);
    await setPendingCapture({
      kind: "error",
      error: protectedPage
        ? "This is a Chrome-protected page and extensions cannot capture it. Open the extension on a normal website tab."
        : `Chrome could not capture this website: ${detail}`,
      capturedAt: Date.now()
    });
    await openPanel(tab.windowId);
  }
}

async function setPendingCapture(value) {
  await chrome.storage.local.set({ pendingCapture: value });
  chrome.runtime.sendMessage({ type: "PENDING_CAPTURE_READY" }).catch(() => {});
}

async function openPanel(windowId) {
  try {
    await chrome.sidePanel.open({ windowId });
  } catch {
    // Chrome may refuse a programmatic open if user activation has expired.
    // The pending capture remains available when the toolbar button is clicked.
  }
}

function readableError(error) {
  const message = error?.message || String(error);
  if (message.includes("Cannot access")) return "Chrome does not allow extensions on this page. Try a normal website tab.";
  return message;
}

async function handoffToChatGpt(payload) {
  if (!payload?.id || !payload?.imageDataUrl || !payload?.prompt) {
    throw new Error("The ChatGPT handoff was missing its image or prompt.");
  }

  await chrome.storage.local.set({ pendingChatGptHandoff: payload });
  const tab = await chrome.tabs.create({ url: "https://chatgpt.com/", active: true });
  if (!tab.id) throw new Error("Chrome could not open ChatGPT.");

  const response = await deliverToTab(tab.id, payload);
  if (response?.ok) await chrome.storage.local.remove("pendingChatGptHandoff");
  return response || { ok: false, error: "ChatGPT opened, but the handoff did not complete." };
}

async function deliverToTab(tabId, payload) {
  const deadline = Date.now() + 20000;
  let lastError = "Waiting for ChatGPT to load.";

  while (Date.now() < deadline) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "DELIVER_CHATGPT_HANDOFF",
        payload
      });
      if (response?.ok || (response?.partial && (response?.promptInserted || response?.imageAttached))) return response;
      if (response?.error) lastError = response.error;
    } catch (error) {
      lastError = error?.message || lastError;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  return {
    ok: false,
    error: `ChatGPT opened, but the extension could not fill the composer. ${lastError}`
  };
}
