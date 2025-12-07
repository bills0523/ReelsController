const TOAST_LIFETIME = 1500;
const LONG_PRESS_MS = 200;

let speedBoostActive = false;
let rightArrowTimer = null;
let rightArrowDownAt = null;

function isTypingTarget(target) {
  if (!target) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='searchbox']"
    )
  );
}

function getActiveVideo() {
  const videos = Array.from(document.querySelectorAll("video"));
  if (!videos.length) return null;

  const viewportCenter = window.innerHeight / 2;
  let closest = null;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const video of videos) {
    const rect = video.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(center - viewportCenter);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closest = video;
    }
  }

  return closest;
}

function showToast(text) {
  let toast = document.getElementById("reelcontroller-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "reelcontroller-toast";
    toast.style.position = "fixed";
    toast.style.top = "50%";
    toast.style.left = "50%";
    toast.style.transform = "translate(-50%, -50%)";
    toast.style.zIndex = "99999";
    toast.style.background = "rgba(0, 0, 0, 0.78)";
    toast.style.color = "#fff";
    toast.style.padding = "10px 14px";
    toast.style.borderRadius = "10px";
    toast.style.fontSize = "14px";
    toast.style.fontFamily =
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    toast.style.pointerEvents = "none";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 150ms ease";
    document.body.appendChild(toast);
  }

  toast.textContent = text;
  toast.style.opacity = "1";

  const lastTimeout = toast.dataset.timeoutId;
  if (lastTimeout) {
    clearTimeout(Number(lastTimeout));
  }

  const timeoutId = window.setTimeout(() => {
    toast.style.opacity = "0";
  }, TOAST_LIFETIME);
  toast.dataset.timeoutId = String(timeoutId);
}

function togglePlayPause(video) {
  if (!video) return;
  if (video.paused) {
    video.play().catch(() => {});
    showToast("▶️ Play");
  } else {
    video.pause();
    showToast("⏸ Pause");
  }
}

function toggleMute(video) {
  if (!video) return;
  video.muted = !video.muted;
  showToast(video.muted ? "🔇 Muted" : "🔊 Unmuted");
}

function seek(video, deltaSeconds) {
  if (!video) return;
  video.currentTime = Math.max(0, video.currentTime + deltaSeconds);
  showToast(deltaSeconds >= 0 ? "⏩ +3s" : "⏪ -3s");
}

function setSpeed(video, speed) {
  if (!video) return;
  video.playbackRate = speed;
  showToast(speed > 1 ? "⏩ 2x Speed" : "▶️ 1x Speed");
}

function handleKeyDown(event) {
  if (isTypingTarget(event.target)) return;

  const video = getActiveVideo();
  if (!video) return;

  if (event.key === " " || event.code === "Space") {
    event.preventDefault();
    event.stopPropagation();
    togglePlayPause(video);
    return;
  }

  if (event.key === "m" || event.key === "M") {
    event.preventDefault();
    event.stopPropagation();
    toggleMute(video);
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    event.stopPropagation();
    seek(video, -3);
    return;
  }

  if (event.key === "ArrowRight") {
    if (event.repeat) return; // ignore auto-repeat to keep timing clean
    event.preventDefault();
    event.stopPropagation();

    rightArrowDownAt = performance.now();
    rightArrowTimer = window.setTimeout(() => {
      speedBoostActive = true;
      setSpeed(video, 2.0);
    }, LONG_PRESS_MS);
  }
}

function handleKeyUp(event) {
  if (isTypingTarget(event.target)) return;

  const video = getActiveVideo();
  if (!video) return;

  if (event.key === "ArrowRight") {
    event.preventDefault();
    event.stopPropagation();

    if (rightArrowTimer) {
      clearTimeout(rightArrowTimer);
      rightArrowTimer = null;
    }

    const heldMs = rightArrowDownAt ? performance.now() - rightArrowDownAt : 0;
    rightArrowDownAt = null;

    if (speedBoostActive) {
      speedBoostActive = false;
      setSpeed(video, 1.0);
      return;
    }

    if (heldMs < LONG_PRESS_MS) {
      seek(video, 3);
    }
  }
}

// Capture phase so we intercept before Instagram React handlers.
window.addEventListener("keydown", handleKeyDown, { capture: true });
window.addEventListener("keyup", handleKeyUp, { capture: true });
