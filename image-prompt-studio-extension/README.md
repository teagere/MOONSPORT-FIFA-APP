# Visual Prompt Studio

An original Manifest V3 Chrome extension that captures a reference image and hands both the image and a detailed analysis instruction to the user's signed-in ChatGPT page.

It does **not** call the OpenAI API, does not require an API key, and creates no separate API charges. ChatGPT performs the image analysis using the user's existing ChatGPT access.

## Workflow

1. Right-click a visible web image, capture the visible page and crop the useful area inside the extension, or upload an image from your Mac.
2. Add optional creative direction such as “focus on the lighting and editorial colour grade”.
3. Click **Send image + instruction to ChatGPT**.
4. The extension opens a new ChatGPT tab, attaches the reference image, and fills the detailed instruction.
5. Review the prepared message and press **Send** yourself.

The extension deliberately does not press Send. This prevents accidental usage and lets the user check the image and instruction first.

The prepared instruction asks ChatGPT to analyse:

- subject and action
- composition and focal hierarchy
- style and medium
- lighting
- colour palette
- materials and texture
- camera and lens character
- environment and mood
- typography and graphic elements
- a polished reusable generation prompt
- an optional negative prompt

## Install on Chrome for Mac

1. Open `chrome://extensions`.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select this `image-prompt-studio-extension` folder.
5. Pin **Visual Prompt Studio** from Chrome's Extensions menu.

If version 1.0 was already loaded, click its **Reload** button on `chrome://extensions` after replacing the files.

Chrome does not allow extensions to run on internal pages such as `chrome://` or on the Chrome Web Store itself. Test it on a normal website.

## Privacy

The extension has no API key, account system, analytics, advertising, or remote server. Captured images and up to 20 prepared instructions are stored only in `chrome.storage.local` inside the current Chrome profile.

Host access covers ordinary `http` and `https` websites. Chrome requires this permission for reliable visible-tab capture after the user changes tabs. The extension only captures when the user explicitly chooses a right-click action or presses **Select page area**.

On `chatgpt.com`, the same permission lets the extension locate ChatGPT's empty message composer, attach the selected image, and insert the prepared instruction. The content script does not read conversation messages and never clicks Send.

Permissions are used as follows:

- `activeTab`, `scripting`, and `tabs`: capture the visible image or page region you explicitly select, and open a new ChatGPT tab when requested.
- Website access: make user-triggered capture work reliably across ordinary inspiration and creative websites, even after changing tabs.
- `contextMenus`: add the right-click actions.
- `sidePanel`: show the extension workspace.
- `storage` and `unlimitedStorage`: keep temporary captures and local history.

## Browser limits

- Right-click capture records the visible pixels of an image. If it is partly off-screen, only the visible portion is captured.
- **Select page area** now captures the visible tab and presents the screenshot in an extension-owned crop screen. It no longer injects a selection overlay into the webpage.
- Chrome can still block screenshots of highly protected internal tabs such as some `chrome://` pages. Switch to a normal website tab in that case.
- ChatGPT occasionally changes its webpage controls. If automatic attachment is unavailable, the extension copies the instruction and offers the captured image as a download for manual upload.
- Unpacked extensions are local development installs. Chrome may periodically remind you that developer-mode extensions are enabled.
