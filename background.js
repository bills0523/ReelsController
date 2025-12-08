const INSTAGRAM_MATCHES = ["https://www.instagram.com/*"]; // Origins where the content script may run
const CONTENT_SCRIPT_ID = "reels-controller-script"; // Stable id for the registered content script

// Check whether the extension already has instagram.com permission
async function hasInstagramPermission() { // Wrapper to check existing host permissions
  return chrome.permissions.contains({ origins: INSTAGRAM_MATCHES }); // Check if the user granted instagram.com access
}

// Ensure the Reels controller content script is registered when permission exists
async function ensureContentScriptRegistered() { // Register the content script when allowed
  if (!(await hasInstagramPermission())) {
    return { registered: false, reason: "missing_permission" }; // Bail when permission is missing
  }

  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID],
  }); // Check current registrations for our id

  if (existing && existing.length) {
    return { registered: true }; // Already present, nothing to do
  }

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID, // Keep id consistent for unregistering later
      matches: INSTAGRAM_MATCHES, // Limit to instagram.com
      js: ["content.js"], // Inject our keyboard override logic
      runAt: "document_idle", // Wait until page is idle to load
    },
  ]); // Register the script with Chrome

  return { registered: true }; // Report success to caller
}

// Remove the content script registration if it is present
async function unregisterContentScript() { // Remove our content script registration safely
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID],
  }); // Ask Chrome what scripts are registered

  if (!existing || !existing.length) {
    return; // Nothing to remove
  }

  await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] }); // Remove the script registration
}

// Attempt registration on install while tolerating missing permissions
chrome.runtime.onInstalled.addListener(() => { // On install, try to register the content script
  ensureContentScriptRegistered().catch(() => {
    /* Ignore at install; popup will request permission. */ // Fail quietly so onboarding continues
  });
}); // Try to register on install but let the popup handle missing permission

// Allow the popup to request registration on demand
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => { // Handle messages from the popup
  if (message?.type === "ensureContentScript") {
    ensureContentScriptRegistered()
      .then((result) => sendResponse(result)) // Report registration outcome
      .catch((error) =>
        sendResponse({ registered: false, reason: error?.message }) // Surface any error messages
      );
    return true; // keep channel open for async
  }
}); // Respond to popup asking us to ensure registration

chrome.permissions.onRemoved.addListener(async ({ origins }) => { // React when permissions are revoked
  if (origins?.some((origin) => INSTAGRAM_MATCHES.includes(origin))) {
    await unregisterContentScript(); // Remove script if instagram.com permission was revoked
    await chrome.storage.sync.set({ reelsOverrideEnabled: false }); // Turn off override toggle when permission goes away
  }
}); // Keep state clean when permissions shrink

chrome.permissions.onAdded.addListener(async ({ origins }) => { // React when permissions are granted
  if (origins?.some((origin) => INSTAGRAM_MATCHES.includes(origin))) {
    await ensureContentScriptRegistered(); // Register script as soon as permission appears
  }
}); // React to permission grants
