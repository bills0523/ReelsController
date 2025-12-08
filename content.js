const TOAST_LIFETIME = 1500; // Duration to keep toast visible in milliseconds
const LONG_PRESS_MS = 200; // Threshold for treating ArrowRight as a long press

let speedBoostActive = false; // Tracks whether 2x playback is currently active
let rightArrowTimer = null; // Timeout id used to detect long press of ArrowRight
let rightArrowDownAt = null; // Timestamp when ArrowRight was pressed
let muteLockState = null; // null means no lock yet; boolean after first mute toggle
let muteApplyPending = false; // Prevents redundant mute lock applications per frame

function isTypingTarget(target) { // Determine if the focused element is a text input
  if (!target) return false; // No target means we should not block shortcuts
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='textbox'], [role='searchbox']")); // Skip overrides when user is typing
}

function getActiveVideo() { // Pick the video element closest to the center of the viewport
  const videos = Array.from(document.querySelectorAll("video")); // Collect all video elements on the page
  if (!videos.length) return null; // If none exist, there is nothing to control

  const viewportCenter = window.innerHeight / 2; // Compute the vertical midpoint of the viewport
  let closest = null; // Placeholder for the closest video so far
  let smallestDistance = Number.POSITIVE_INFINITY; // Start with an infinitely large distance

  for (const video of videos) { // Iterate over every video tag
    const rect = video.getBoundingClientRect(); // Get position relative to viewport
    const center = rect.top + rect.height / 2; // Find the vertical center of this video
    const distance = Math.abs(center - viewportCenter); // Calculate distance to viewport center
    if (distance < smallestDistance) { // If this video is closer than previous best
      smallestDistance = distance; // Update the smallest distance seen
      closest = video; // Remember this video as the active one
    }
  }

  return closest; // Return the video closest to the center
}

function showToast(text) { // Display a temporary toast message overlay
  let toast = document.getElementById("reelcontroller-toast"); // Try to reuse an existing toast element
  if (!toast) { // If it does not exist yet, create it
    toast = document.createElement("div"); // Make a new div for the toast
    toast.id = "reelcontroller-toast"; // Assign a stable id for reuse
    toast.style.position = "fixed"; // Keep the toast fixed on the viewport
    toast.style.top = "50%"; // Center vertically
    toast.style.left = "50%"; // Center horizontally
    toast.style.transform = "translate(-50%, -50%)"; // Offset to true center position
    toast.style.zIndex = "99999"; // Ensure the toast floats above page content
    toast.style.background = "rgba(0, 0, 0, 0.78)"; // Semi-transparent dark background
    toast.style.color = "#fff"; // White text for contrast
    toast.style.padding = "10px 14px"; // Spacing inside the toast
    toast.style.borderRadius = "10px"; // Rounded corners for a pill look
    toast.style.fontSize = "14px"; // Reasonable text size for visibility
    toast.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"; // Neutral font stack
    toast.style.pointerEvents = "none"; // Allow clicks to pass through the toast
    toast.style.opacity = "0"; // Start hidden so transitions can fade in
    toast.style.transition = "opacity 150ms ease"; // Smooth fade in/out animation
    document.body.appendChild(toast); // Attach the toast to the page
  }

  toast.textContent = text; // Update toast message text
  toast.style.opacity = "1"; // Make the toast visible

  const lastTimeout = toast.dataset.timeoutId; // Read any previous timeout id stored on the element
  if (lastTimeout) { // If a timeout was pending
    clearTimeout(Number(lastTimeout)); // Cancel the previous hide timeout
  }

  const timeoutId = window.setTimeout(() => { // Schedule the toast to hide after lifetime
    toast.style.opacity = "0"; // Fade the toast out
  }, TOAST_LIFETIME); // Use the configured lifetime
  toast.dataset.timeoutId = String(timeoutId); // Persist the timeout id for possible cancellation
}

function togglePlayPause(video) { // Toggle playback state for the active video
  if (!video) return; // Do nothing if no video exists
  if (video.paused) { // If video is currently paused
    video.play().catch(() => {}); // Attempt to play and swallow play blocking errors
    showToast("▶️ Play"); // Notify the user that playback resumed
  } else { // If video is playing
    video.pause(); // Pause playback
    showToast("⏸ Pause"); // Notify the user that playback paused
  }
}

function toggleMute(video) { // Toggle mute lock and apply it across videos
  if (!video) return; // Skip when no video is present
  const nextState = muteLockState === null ? !video.muted : !muteLockState; // Determine the next mute value
  muteLockState = nextState; // Remember the chosen mute state
  applyMuteLockToAllVideos({ silent: false }); // Apply immediately to all videos with feedback
}

function seek(video, deltaSeconds) { // Jump forward or backward in the video
  if (!video) return; // Skip when no active video exists
  video.currentTime = Math.max(0, video.currentTime + deltaSeconds); // Clamp seek so it never goes before zero
  showToast(deltaSeconds >= 0 ? "⏩ +3s" : "⏪ -3s"); // Show direction of the seek
}

function setSpeed(video, speed) { // Adjust playback speed of the video
  if (!video) return; // Skip when no video exists
  video.playbackRate = speed; // Apply the requested speed
  showToast(speed > 1 ? "⏩ 2x Speed" : "▶️ 1x Speed"); // Indicate current speed mode
}

function applyMuteLockToVideo(video, { silent = true } = {}) { // Enforce mute lock on a single video
  if (muteLockState === null || !video) return; // No lock or video means nothing to do
  if (video.muted === muteLockState) return; // Skip if already in desired state
  video.muted = muteLockState; // Apply mute/unmute to match lock
  if (!silent) { // If caller wants feedback
    showToast(muteLockState ? "🔇 Muted" : "🔊 Unmuted"); // Show mute status
  }
}

function applyMuteLockToAllVideos(options = {}) { // Enforce mute lock for all videos on the page
  if (muteLockState === null) return; // Nothing to do if lock not set
  const videos = document.querySelectorAll("video"); // Get all videos currently in the DOM
  videos.forEach((video) => applyMuteLockToVideo(video, options)); // Apply the lock to each video
}

function applyMuteLockToActive(options = {}) { // Apply mute lock to the currently active video
  const video = getActiveVideo(); // Find the video nearest the center
  applyMuteLockToVideo(video, options); // Enforce lock on that video
}

function scheduleMuteLockApply() { // Defer applying mute lock to avoid redundant work
  if (muteLockState === null || muteApplyPending) return; // Skip if no lock or already scheduled
  muteApplyPending = true; // Mark that an apply is pending this frame
  requestAnimationFrame(() => { // Wait for next frame to batch DOM work
    muteApplyPending = false; // Clear pending flag
    applyMuteLockToAllVideos({ silent: true }); // Apply lock quietly to all videos
  });
}

function handleKeyDown(event) { // Intercept keydown events for custom controls
  if (isTypingTarget(event.target)) return; // Let typing fields behave normally

  const video = getActiveVideo(); // Determine the active video to control
  if (!video) return; // Abort if no video is visible

  if (event.key === " " || event.code === "Space") { // Space toggles play/pause
    event.preventDefault(); // Stop default scroll
    event.stopPropagation(); // Prevent page handlers from running
    togglePlayPause(video); // Switch playback state
    return; // Exit after handling
  }

  if (event.key === "m" || event.key === "M") { // M toggles mute lock
    event.preventDefault(); // Prevent default page binding
    event.stopPropagation(); // Block other listeners
    if (typeof event.stopImmediatePropagation === "function") { // Extra guard for React listeners
      event.stopImmediatePropagation(); // Halt further propagation immediately
    }
    toggleMute(video); // Flip mute state
    scheduleMuteLockApply(); // Apply across videos at next frame
    return; // Exit after handling
  }

  if (event.key === "ArrowLeft") { // Left arrow rewinds
    event.preventDefault(); // Prevent default navigation
    event.stopPropagation(); // Keep Instagram from handling it
    seek(video, -3); // Jump back three seconds
    return; // Exit after handling
  }

  if (event.key === "ArrowRight") { // Right arrow seeks or speeds up depending on hold
    if (event.repeat) return; // ignore auto-repeat to keep timing clean
    event.preventDefault(); // Block default action
    event.stopPropagation(); // Stop other listeners

    rightArrowDownAt = performance.now(); // Record when the key went down
    rightArrowTimer = window.setTimeout(() => { // Schedule long-press behavior
      speedBoostActive = true; // Mark that speed boost is engaged
      setSpeed(video, 2.0); // Double the playback speed
    }, LONG_PRESS_MS); // Trigger after the long-press threshold
  }
}

function handleKeyUp(event) { // Handle keyup to finish right arrow logic
  if (isTypingTarget(event.target)) return; // Ignore when typing

  const video = getActiveVideo(); // Get the video to act on
  if (!video) return; // Abort if none present

  if (event.key === "ArrowRight") { // Only handle ArrowRight release
    event.preventDefault(); // Block default behavior
    event.stopPropagation(); // Stop other listeners

    if (rightArrowTimer) { // If a long-press timer exists
      clearTimeout(rightArrowTimer); // Cancel the long-press trigger
      rightArrowTimer = null; // Clear the timer handle
    }

    const heldMs = rightArrowDownAt ? performance.now() - rightArrowDownAt : 0; // Calculate how long the key was held
    rightArrowDownAt = null; // Reset the press timestamp

    if (speedBoostActive) { // If we already boosted speed
      speedBoostActive = false; // Clear the boost flag
      setSpeed(video, 1.0); // Return to normal speed
      return; // Exit after handling
    }

    if (heldMs < LONG_PRESS_MS) { // If the press was short
      seek(video, 3); // Seek forward three seconds
    }
  }
}

// Capture phase so we intercept before Instagram React handlers.
window.addEventListener("keydown", handleKeyDown, { capture: true }); // Listen for keydown in capture phase
window.addEventListener("keyup", handleKeyUp, { capture: true }); // Listen for keyup in capture phase
document.addEventListener("scroll", scheduleMuteLockApply, { passive: true }); // Apply mute lock when scrolling loads new videos
window.addEventListener("resize", scheduleMuteLockApply, { passive: true }); // Reapply mute lock when layout changes on resize

const reelsObserver = new MutationObserver(scheduleMuteLockApply); // Observe DOM changes to reapply mute state
if (document.body) { // If body exists now
  reelsObserver.observe(document.body, { childList: true, subtree: true }); // Watch for new videos immediately
} else { // If body not yet available
  window.addEventListener(
    "DOMContentLoaded",
    () => {
      reelsObserver.observe(document.body, { childList: true, subtree: true }); // Start observing once DOM is ready
    },
    { once: true }
  );
}

// Apply mute lock on load if user toggled before navigating reels.
applyMuteLockToActive({ silent: true }); // Enforce prior mute choice when script loads
