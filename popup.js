const INSTAGRAM_ORIGINS = ["https://www.instagram.com/*"];

const requestAccessBtn = document.getElementById("requestAccess");
const toggleOverrideBtn = document.getElementById("toggleOverride");
const statusEl = document.getElementById("status");

function setStatus(text) {
  statusEl.textContent = text;
}

async function hasPermission() {
  return chrome.permissions.contains({ origins: INSTAGRAM_ORIGINS });
}

async function ensureContentScript() {
  return chrome.runtime.sendMessage({ type: "ensureContentScript" });
}

function updateToggleLabel(enabled) {
  toggleOverrideBtn.textContent = `Override shortcuts: ${enabled ? "On" : "Off"}`;
  toggleOverrideBtn.setAttribute("aria-pressed", String(enabled));
}

async function loadState() {
  const [{ reelsOverrideEnabled }, permissionGranted] = await Promise.all([
    chrome.storage.sync.get({ reelsOverrideEnabled: false }),
    hasPermission(),
  ]);

  requestAccessBtn.disabled = permissionGranted;
  toggleOverrideBtn.disabled = !permissionGranted;
  updateToggleLabel(reelsOverrideEnabled);

  if (!permissionGranted) {
    setStatus("Permission needed to control instagram.com");
    return;
  }

  await ensureContentScript();
  setStatus(
    reelsOverrideEnabled
      ? "Override is active on Instagram Reels."
      : "Override is ready. Turn it on to take over Reels keys."
  );
}

requestAccessBtn.addEventListener("click", async () => {
  setStatus("Requesting permission…");
  const granted = await chrome.permissions.request({ origins: INSTAGRAM_ORIGINS });
  if (!granted) {
    setStatus("Permission declined. Reels control stays off.");
    return;
  }

  await ensureContentScript();
  await loadState();
});

toggleOverrideBtn.addEventListener("click", async () => {
  const current = (await chrome.storage.sync.get({ reelsOverrideEnabled: false }))
    .reelsOverrideEnabled;
  const next = !current;
  await chrome.storage.sync.set({ reelsOverrideEnabled: next });
  updateToggleLabel(next);
  setStatus(
    next
      ? "Override is active on Instagram Reels."
      : "Override is ready. Turn it on to take over Reels keys."
  );
});

document.addEventListener("DOMContentLoaded", loadState);
