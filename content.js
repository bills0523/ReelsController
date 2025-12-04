let overrideEnabled = false;

function isReelsPage() {
  return /^\/(reel|reels)/.test(window.location.pathname);
}

function shouldIgnoreTarget(target) {
  if (!target) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='searchbox']"
    )
  );
}

function findNearestVideo() {
  const videos = Array.from(document.querySelectorAll("video"));
  if (!videos.length) return null;

  const viewportCenter = window.innerHeight / 2;
  let best = null;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const video of videos) {
    const rect = video.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(center - viewportCenter);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      best = video;
    }
  }

  return best;
}

function clickButtonByLabel(labels) {
  const selector = labels
    .map(
      (label) =>
        `button[aria-label*='${label}' i], div[role='button'][aria-label*='${label}' i]`
    )
    .join(", ");
  const el = document.querySelector(selector);
  if (el) {
    el.click();
    return true;
  }
  return false;
}

function goToNext() {
  if (clickButtonByLabel(["next", "forward"])) return true;
  const video = findNearestVideo();
  if (video && typeof video.fastSeek === "function") {
    video.fastSeek(video.currentTime + 0.001);
    return true;
  }
  return false;
}

function goToPrevious() {
  if (clickButtonByLabel(["previous", "back"])) return true;
  const video = findNearestVideo();
  if (video && video.currentTime > 1) {
    video.currentTime = 0;
    return true;
  }
  return false;
}

function togglePlayback() {
  const video = findNearestVideo();
  if (!video) return false;
  if (video.paused) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
  return true;
}

function handleKeydown(event) {
  if (!overrideEnabled || !isReelsPage()) return;
  if (shouldIgnoreTarget(event.target)) return;

  let handled = false;

  switch (event.key) {
    case "ArrowRight":
    case "l":
    case "L":
      handled = goToNext();
      break;
    case "ArrowLeft":
    case "h":
    case "H":
      handled = goToPrevious();
      break;
    case " ":
    case "k":
    case "K":
      handled = togglePlayback();
      break;
    default:
      return;
  }

  if (handled) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function setOverride(enabled) {
  overrideEnabled = Boolean(enabled);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.reelsOverrideEnabled) return;
  setOverride(changes.reelsOverrideEnabled.newValue);
});

chrome.storage.sync
  .get({ reelsOverrideEnabled: false })
  .then(({ reelsOverrideEnabled }) => {
    setOverride(reelsOverrideEnabled);
  });

document.addEventListener("keydown", handleKeydown, true);
