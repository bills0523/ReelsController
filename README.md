# ReelController (Chrome Extension)

Keyboard-first controls for Instagram Reels on desktop with toast feedback and safer input handling.

## Install (unpacked)
- Download/clone this repo.
- Open Chrome → `chrome://extensions`.
- Enable **Developer mode** (top right).
- Click **Load unpacked** and select this folder (where `manifest.json` lives).
- Visit an Instagram Reel page (`instagram.com/reel/...`) and use the shortcuts below.

## Shortcuts (capture phase)
- `Space`: Play/Pause (prevents the default scroll-to-next).
- `M`: Mute/Unmute.
- `←` Left Arrow: Seek backward 3s.
- `→` Right Arrow (tap): Seek forward 3s.
- `→` Right Arrow (hold > 200ms): Boost to 2.0x while held; returns to 1.0x on keyup.

Notes: Shortcuts ignore inputs/textareas/contenteditable elements (e.g., while commenting). The active video is picked dynamically based on the reel closest to the viewport center. A small toast appears to confirm each action.
