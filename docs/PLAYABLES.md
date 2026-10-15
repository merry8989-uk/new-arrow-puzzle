# Running on YouTube Playables

This branch (`playables`) makes the game compliant with the YouTube Playables
requirements. The same build still runs on the web and on GitHub Pages - the
Playables SDK is a no-op outside YouTube.

## What was integrated

| Requirement | Where |
|---|---|
| Load the Playables SDK **before any game code** | `index.html` - `<script src="https://www.youtube.com/game_api/v1"></script>` is the first script |
| SDK wrapper that no-ops off YouTube | `js/playables.js` (`window.YTPlay`) |
| `firstFrameReady()` when frames are drawn | `js/game.js` boot, right after the first paint |
| `gameReady()` only when the home screen is interactive | `js/game.js` boot, after cloud progress has loaded |
| Cloud save via `loadData()` / `saveData()` | `js/game.js` - `save()` uses the SDK inside Playables; `saveData` never runs before `loadData` resolves |
| `onPause` / `onResume` (not the Page Visibility API) | `js/game.js` - pauses input and saves on pause |
| Respect YouTube mute (`isAudioEnabled` / `onAudioEnabledChange`) | `js/game.js` - `sfx()` is gated on `YT.audioEnabled()` |
| No external calls | online packs are hidden and disabled inside Playables (`checkForPacks` returns early) |
| Esc closes dialogs, no `preventDefault` | `js/game.js` keydown handler |
| Tell the player when content ends | final level shows "You've cleared all 12,000 levels" |
| Responsive in all aspect ratios, no orientation lock | `css/style.css` (board sized with `min(92vw, 62vh, 460px)` + a landscape block) |
| No in-game exit/quit button, no external links, no in-game sharing | the game has none |

Everything else (touch + mouse input, relative paths, no absolute paths, small
bundle) already held.

## Build the upload bundle

```bash
bash tools/build_bundle.sh
```

This stages only the runtime files (`index.html`, `css/`, `js/`) into
`build/playables/`, zips them into `build/playables-bundle.zip` with
`index.html` at the root, and then validates the bundle:

```bash
python3 tools/check_bundle.py build/playables
```

The checker mirrors Google's bundle-analyzer limits (30 MiB per file, 250 MiB
total, 8000 files, filename charset) and additionally fails on **external calls**
and **absolute paths**, which Playables forbids.

Because the 12,000 levels are generated in code, the bundle is tiny - far under
every limit.

## Testing before submission

Google provides an **SDK Test Suite** that validates the SDK integration (it
reports missing `firstFrameReady` / `gameReady` / save / pause behaviour). Run
your staged bundle through it, and test on YouTube desktop web, mobile web,
YouTube for Android and YouTube for iOS. The Developer Portal gives you a
**YouTube Dev Link** and a **Test Suite Link** for exactly this.

## Publishing

1. Fill in the **Playables interest form** (developer access is invite-only).
2. Once your channel is onboarded, open the **Playables Developer Portal**
   (channel-manager permission required) → **Add a new game**.
3. Provide metadata (title, genre, description, publisher/developer) and
   **thumbnails** in the required ratios (1:1, 5:7, 16:9); no branding/logos in
   them.
4. Upload `build/playables-bundle.zip`.
5. Configure monetization, then **Create release**.
6. On the **Verify and test** tab, test with the Dev Link + Test Suite, then
   **Submit for Certification**.
7. After review, the game goes live in the Playables catalogue.

## Notes / gotchas

- Inside Playables the game must not fetch anything. The online-pack feature is
  therefore disabled there; all levels are built in.
- If you later add assets that are loaded dynamically, remember Playables uses a
  Content Security Policy: script tags created from JavaScript need the page's
  `nonce` added to them.
- Keep saved data well under 3 MiB (this game saves a few KB).
