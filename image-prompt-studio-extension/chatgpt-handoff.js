(() => {
  const deliveredIds = new Set();
  let delivering = false;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "DELIVER_CHATGPT_HANDOFF") return;
    deliver(message.payload)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  });

  restorePendingHandoff();

  async function restorePendingHandoff() {
    const { pendingChatGptHandoff } = await chrome.storage.local.get("pendingChatGptHandoff");
    if (!pendingChatGptHandoff || Date.now() - pendingChatGptHandoff.createdAt > 120000) return;
    await deliver(pendingChatGptHandoff);
  }

  async function deliver(payload) {
    if (!payload?.id || !payload?.imageDataUrl || !payload?.prompt) {
      return { ok: false, error: "The handoff data was incomplete." };
    }
    if (deliveredIds.has(payload.id)) return { ok: true, alreadyDelivered: true };
    if (delivering) return { partial: true, error: "The handoff is already in progress." };

    delivering = true;
    try {
      const composer = await waitForComposer(15000);
      if (!composer) return { ok: false, error: "The ChatGPT message box was not found." };

      const existingText = readComposerText(composer);
      if (existingText) {
        return {
          ok: false,
          error: "ChatGPT already has an unsent draft. Clear it or start a new chat, then try again."
        };
      }

      const imageAttached = await attachImage(payload.imageDataUrl, payload.fileName || "visual-reference.webp");
      const promptInserted = insertPrompt(composer, payload.prompt);

      if (!promptInserted) {
        return { partial: imageAttached, ok: false, error: "The image was attached, but the instruction could not be inserted." };
      }

      deliveredIds.add(payload.id);
      await chrome.storage.local.remove("pendingChatGptHandoff");
      showNotice(imageAttached
        ? "Reference image and analysis instruction are ready. Review them, then press Send."
        : "The instruction is ready. Please attach the saved reference image, then press Send.",
        imageAttached ? "success" : "warning");

      return {
        ok: imageAttached && promptInserted,
        partial: promptInserted,
        imageAttached,
        promptInserted,
        error: imageAttached ? "" : "The prompt was inserted, but ChatGPT's image attachment control was not available."
      };
    } finally {
      delivering = false;
    }
  }

  async function waitForComposer(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const composer = findComposer();
      if (composer) return composer;
      await delay(250);
    }
    return null;
  }

  function findComposer() {
    const selectors = [
      "#prompt-textarea",
      "[data-testid='composer-text-input']",
      "form textarea[placeholder*='Message']",
      "main textarea[placeholder*='Message']",
      "form [contenteditable='true']",
      "main [contenteditable='true'][data-placeholder]"
    ];
    for (const selector of selectors) {
      const element = [...document.querySelectorAll(selector)].find(isVisible);
      if (element) return element;
    }
    return null;
  }

  function readComposerText(composer) {
    const text = "value" in composer ? composer.value : composer.innerText || composer.textContent;
    return String(text || "").trim();
  }

  async function attachImage(dataUrl, fileName) {
    let input = findFileInput();
    if (!input) {
      const attachButton = findAttachButton();
      if (attachButton) {
        attachButton.click();
        const deadline = Date.now() + 2500;
        while (!input && Date.now() < deadline) {
          await delay(150);
          input = findFileInput();
        }
      }
    }
    if (!input) return false;

    const { mimeType, bytes } = dataUrlToBytes(dataUrl);
    const file = new File([bytes], fileName, { type: mimeType, lastModified: Date.now() });
    const transfer = new DataTransfer();
    transfer.items.add(file);

    try {
      input.files = transfer.files;
    } catch {
      Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    }
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    await delay(500);
    return true;
  }

  function findFileInput() {
    return [...document.querySelectorAll("input[type='file']")].find((input) => {
      const accept = (input.accept || "").toLowerCase();
      return !accept || accept.includes("image") || accept.includes("*");
    }) || null;
  }

  function findAttachButton() {
    const selectors = [
      "button[data-testid='composer-plus-btn']",
      "button[aria-label*='Attach']",
      "button[aria-label*='attach']",
      "button[aria-label*='Add files']",
      "button[aria-label*='Upload']"
    ];
    for (const selector of selectors) {
      const element = [...document.querySelectorAll(selector)].find(isVisible);
      if (element) return element;
    }
    return null;
  }

  function insertPrompt(composer, prompt) {
    composer.focus();
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const prototype = composer instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (setter) setter.call(composer, prompt);
      else composer.value = prompt;
      composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt }));
      return readComposerText(composer).length > 0;
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    let inserted = false;
    try { inserted = document.execCommand("insertText", false, prompt); } catch {}
    if (!inserted || !readComposerText(composer)) {
      composer.textContent = prompt;
      composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt }));
    }
    return readComposerText(composer).length > 0;
  }

  function dataUrlToBytes(dataUrl) {
    const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
    if (!match) throw new Error("The captured image format was not supported.");
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { mimeType: match[1], bytes };
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function showNotice(message, type) {
    document.getElementById("visual-prompt-chatgpt-notice")?.remove();
    const notice = document.createElement("div");
    notice.id = "visual-prompt-chatgpt-notice";
    notice.textContent = message;
    Object.assign(notice.style, {
      position: "fixed",
      zIndex: "2147483647",
      right: "20px",
      bottom: "90px",
      maxWidth: "360px",
      padding: "13px 16px",
      borderRadius: "12px",
      color: "white",
      background: type === "success" ? "#166534" : "#92400e",
      boxShadow: "0 14px 40px rgba(0,0,0,.3)",
      font: "600 13px/1.45 -apple-system, BlinkMacSystemFont, sans-serif"
    });
    document.documentElement.appendChild(notice);
    setTimeout(() => notice.remove(), 9000);
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
