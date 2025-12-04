const INSTAGRAM_MATCHES = ["https://www.instagram.com/*"];
const CONTENT_SCRIPT_ID = "reels-controller-script";

async function hasInstagramPermission() {
  return chrome.permissions.contains({ origins: INSTAGRAM_MATCHES });
}

async function ensureContentScriptRegistered() {
  if (!(await hasInstagramPermission())) {
    return { registered: false, reason: "missing_permission" };
  }

  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID],
  });

  if (existing && existing.length) {
    return { registered: true };
  }

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches: INSTAGRAM_MATCHES,
      js: ["content.js"],
      runAt: "document_idle",
    },
  ]);

  return { registered: true };
}

async function unregisterContentScript() {
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID],
  });

  if (!existing || !existing.length) {
    return;
  }

  await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureContentScriptRegistered().catch(() => {
    /* Ignore at install; popup will request permission. */
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ensureContentScript") {
    ensureContentScriptRegistered()
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({ registered: false, reason: error?.message })
      );
    return true; // keep channel open for async
  }
});

chrome.permissions.onRemoved.addListener(async ({ origins }) => {
  if (origins?.some((origin) => INSTAGRAM_MATCHES.includes(origin))) {
    await unregisterContentScript();
    await chrome.storage.sync.set({ reelsOverrideEnabled: false });
  }
});

chrome.permissions.onAdded.addListener(async ({ origins }) => {
  if (origins?.some((origin) => INSTAGRAM_MATCHES.includes(origin))) {
    await ensureContentScriptRegistered();
  }
});
