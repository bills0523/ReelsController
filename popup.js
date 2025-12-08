const INSTAGRAM_ORIGINS = ["https://www.instagram.com/*"]; // Origins the extension needs permission for

const requestAccessBtn = document.getElementById("requestAccess"); // Button to request host permissions
const toggleOverrideBtn = document.getElementById("toggleOverride"); // Button to toggle override on/off
const statusEl = document.getElementById("status"); // Status text element in the popup

function setStatus(text) { // Replace the visible status message
  statusEl.textContent = text; // Update status text content
}

async function hasPermission() { // Determine if instagram.com permission is already granted
  return chrome.permissions.contains({ origins: INSTAGRAM_ORIGINS }); // Query Chrome permissions API
}

async function ensureContentScript() { // Ask background script to register content script
  return chrome.runtime.sendMessage({ type: "ensureContentScript" }); // Send request message and await result
}

function updateToggleLabel(enabled) { // Update toggle button label and aria state
  toggleOverrideBtn.textContent = `Override shortcuts: ${enabled ? "On" : "Off"}`; // Reflect current toggle state
  toggleOverrideBtn.setAttribute("aria-pressed", String(enabled)); // Keep accessibility state in sync
}

async function loadState() { // Load permission and stored toggle status to render UI
  const [{ reelsOverrideEnabled }, permissionGranted] = await Promise.all([
    chrome.storage.sync.get({ reelsOverrideEnabled: false }), // Fetch stored toggle preference
    hasPermission(), // Check if permission is present
  ]); // Wait for both operations

  requestAccessBtn.disabled = permissionGranted; // Disable permission button when granted
  toggleOverrideBtn.disabled = !permissionGranted; // Only enable toggle when permission exists
  updateToggleLabel(reelsOverrideEnabled); // Set toggle text based on stored state

  if (!permissionGranted) { // If permission is missing
    setStatus("Permission needed to control instagram.com"); // Prompt user to grant it
    return; // Stop further initialization
  }

  await ensureContentScript(); // Ensure the content script is registered before toggling
  setStatus(
    reelsOverrideEnabled
      ? "Override is active on Instagram Reels." // Message when override enabled
      : "Override is ready. Turn it on to take over Reels keys." // Message when ready but off
  ); // Apply status text
}

requestAccessBtn.addEventListener("click", async () => { // Handle permission request clicks
  setStatus("Requesting permission…"); // Inform user that permission prompt is coming
  const granted = await chrome.permissions.request({ origins: INSTAGRAM_ORIGINS }); // Ask Chrome for host permission
  if (!granted) { // If user denies
    setStatus("Permission declined. Reels control stays off."); // Explain that override remains off
    return; // Exit handler
  }

  await ensureContentScript(); // Register content script now that permission exists
  await loadState(); // Refresh UI and toggle state
});

toggleOverrideBtn.addEventListener("click", async () => { // Handle toggling override on/off
  const current = (await chrome.storage.sync.get({ reelsOverrideEnabled: false }))
    .reelsOverrideEnabled; // Read current toggle value from storage
  const next = !current; // Flip the toggle
  await chrome.storage.sync.set({ reelsOverrideEnabled: next }); // Persist the new value
  updateToggleLabel(next); // Update button label and aria state
  setStatus(
    next
      ? "Override is active on Instagram Reels." // Status when override is on
      : "Override is ready. Turn it on to take over Reels keys." // Status when override is off
  ); // Show the updated state
});

document.addEventListener("DOMContentLoaded", loadState); // Initialize UI once popup DOM is ready
