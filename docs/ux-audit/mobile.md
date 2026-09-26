# Mobile web / installable-app UX audit

Method: Playwright + Chromium device emulation (isMobile/hasTouch) against the running dev server: iPhone SE 375x667, iPhone 14 390x844, Pixel 7, iPad gen7 portrait/landscape, phone landscape 844x390. Used real archive boards (6x5). Scripts and screenshots are in `scratchpad/ux/mobile/` (`run1-5.mjs`, `r_*.png`, `f_*.png`, `o_*.png`, `s_*.png`). Measurements are from real runs. iOS-only behaviour (keyboard, safe areas, audio) comes from reading the code, because Chromium can't emulate it.

---

**[P0] The BUZZ button starts below the fold on every phone, and in phone landscape**

- Where: `src/components/board/BoardFrame.tsx:71-82` (clue panel `height: min(66vh,560px)` / `--board-height: min(64vh,540px)` at xs), `GameSurface.tsx` (the lecterns row sits under the ClueControls strip), `clue/PodiumClueButtons.tsx`.
- What's wrong: while a clue is up, the blue clue panel, the timer strip and the lectern header fill the whole viewport. The buzzer sits under your own score, off screen. Measured buzzer top against viewport height: SE 691/667, iPhone 14 808/844 (only its top ~36px is visible, the rest is clipped at the bottom), Pixel 7 805/839, phone landscape 477/390 (entirely hidden). The page must be scrolled mid-clue to buzz. `buzzerRef.focus()` doesn't bring it into view either (scrollY stayed 0 when it enabled), and the lecterns row wraps under the fold as soon as there are 2+ players.
- Repro: `run3.mjs se` / `run3.mjs land`. See `f_se-canbuzz.png`, `r_ip14-clue.png`, `r_land-clue.png`.
- Suggested fix: on `xs` / `(pointer:coarse)`, size the clue panel from what's left, e.g. `height: calc(100dvh - toolbar - strip - buzzbar - env(safe-area-inset-bottom))`, or use a flex column at `100dvh`. Also pin a full-width "thumb zone" buzz bar (`position: sticky; bottom: env(safe-area-inset-bottom)`) that doesn't depend on the lectern row. In landscape, put the buzzer beside the clue.

**[P0] The buzzer is 22px tall and the main tap targets are under 44px**

- Where: `src/components/clue/bench-style.ts` `stackedButtonSx` (`height: 22`), and the toolbar icons (`RoomToolbar`).
- What's wrong: the one control you press every clue is 112x22 on phones (150x22 on iPad). That's half of WCAG 2.5.5's 44px target, and it's easy to miss when tapping fast. Toolbar buttons are 32x32, the room-code chip is 71x26, and "Show the room code" is 26x26.
- Repro: `run1.mjs` logs `buzzer {"r":[132,691,112,22]}`. `run5.mjs` lists the targets under 44px.
- Suggested fix: under `@media (pointer:coarse)`, make the buzzer at least 56-72px tall and full width, and give icon buttons at least 44px of hit area (padding or a pseudo-element). The desktop lectern can keep its compact look.

**[P1] Board category text drops to 7px on phones and gets clipped in landscape**

- Where: `board/BoardFrame.tsx:19-21` `categoryFontSize = clamp(7px, 1.58cqw, 18px)`, and the category cell in `Board.tsx:181-200` (`overflow:hidden`, no line clamp).
- What's wrong: all phones measured 7px category text (SE, iPhone 14, Pixel 7 and landscape). That's unreadable, and below iOS's 11pt minimum. In phone landscape the board is only `46vh` tall (~180px), so categories get clipped top and bottom ("HOW SOON WE FORGET!" shows as "SOON WE FORGET!", and "ADVERTISING" loses its first and last letters). Value tiles are 55x33 on SE and 42x24 in landscape, so they're short of 44px too. The board also takes only about a third of the width in landscape.
- Repro: `run2.mjs`. See `r_se-board.png` and `r_land-board.png`.
- Suggested fix: raise the floor to about 10-11px and allow 3-4 lines with auto-shrink (e.g. `-webkit-line-clamp` plus a fit-text step). Give the category row more height on xs (`1.1fr`). In landscape, size the board from `dvh` minus the chrome, not `46vh`, so it gets the width. Tap-to-zoom on a category header would help too.

**[P1] Safe areas are ignored while the status bar is `black-translucent`**

- Where: `src/app/layout.tsx` (`appleWebApp.statusBarStyle: "black-translucent"`, viewport has no `viewportFit: "cover"`). There is no `env(safe-area-inset-*)` anywhere in `src/` (grep).
- What's wrong: a standalone iOS PWA draws content under the status bar and notch, so the wordmark and toolbar sit under the clock/Dynamic Island. With nothing padding the bottom inset, a bottom buzz bar would sit on the home indicator, and landscape content goes under the notch.
- Repro: code grep. On device: Add to Home Screen on an iPhone 14, then launch.
- Suggested fix: add `viewportFit: "cover"` to `viewport`. Pad the Room/Landing containers with `env(safe-area-inset-top/left/right/bottom)`. Or use `statusBarStyle: "black"`.

**[P1] Layout relies on `100vh` / `vh`, which breaks with mobile browser chrome**

- Where: `Room.tsx:58,70` (`minHeight:100vh`), `Landing.tsx:91`, `BoardFrame.tsx` (`46vh/64vh/66vh`). `DisplayView` correctly uses `dvh`.
- What's wrong: on iOS Safari and Chrome Android, `vh` is the large viewport, so the board and clue sizing assume the URL bar is hidden. This makes the buzzer-below-the-fold problem worse and causes a jump when the toolbar collapses.
- Suggested fix: use `svh`/`dvh` with a `vh` fallback throughout.

**[P1] On iOS, the answer field won't open the keyboard after buzzing, and the keyboard hides the clue**

- Where: `ClueControls.tsx:152,197` (`autoFocus` on the answer field after the server confirms the buzz), `MicAnswerField.tsx`.
- What's wrong: the field mounts after a network round-trip, outside the tap gesture. iOS Safari ignores programmatic focus without a gesture, so the player sees a focused-looking field with no keyboard and has to tap again, which uses up the answer window. When the keyboard does open, the answer field (SE doc y≈595) gets scrolled up and the clue text (y≈260-400) scrolls out of the ~360px visual viewport, so players can't re-read the clue while typing. Nothing listens to `visualViewport` (grep).
- Repro: `run3.mjs se` → `f_se-afterbuzz-full.png`. Keyboard behaviour is from code plus known iOS behaviour; confirm on device.
- Suggested fix: render the answer input (hidden or disabled) before buzzing and focus it synchronously in the buzz tap handler, or keep the input always mounted. When the keyboard is open (`visualViewport` resize), switch to a compact layout: a one-line clue summary above the field, pinned to `visualViewport.height`.

**[P1] Buzzing fires on `click` (release), and there's no `touch-action: manipulation`**

- Where: `PodiumClueButtons.tsx:48` (`onClick`). Measured computed `touch-action: auto` on the buzzer and on board tiles.
- What's wrong: buzz timing is measured at finger lift, not touch-down, which adds ~50-150ms and varies by how people tap. That's unfair next to keyboard (Space) players. Rapid double taps on iOS can still trigger double-tap zoom or scrolling, because `touch-action` isn't restricted. `user-select:none` is set, but `-webkit-touch-callout: none` isn't, so long-pressing on iOS can show the callout or magnifier.
- Suggested fix: buzz on `onPointerDown` (primary pointer, `preventDefault`), and keep `onClick` for keyboard. Add `touch-action: manipulation; -webkit-touch-callout: none` to the buzzer and tiles.

**[P1] No apple-touch-icon or PNG icons, and the manifest icon won't install well**

- Where: `public/manifest.webmanifest` (a single SVG, `"purpose": "any maskable"`), `layout.tsx` (`icons: { icon: "/icon.svg" }`). `/apple-touch-icon.png`, `/favicon.ico` and `/icon-192.png` all return 404.
- What's wrong: iOS ignores SVG for home-screen icons, so it falls back to a page screenshot. Chrome's installability wants 192 and 512 PNGs. Combining "any maskable" on an icon with rounded corners and text near the edge means Android's mask crops the "J!". The SVG also uses Inter text, which may not be installed, so the glyphs render in a fallback font.
- Suggested fix: add `apple-touch-icon` 180 PNG, 192/512 PNG `any` icons, and a separate 512 `maskable` icon with safe-zone padding. Outline the glyph paths in the SVG.

**[P1] No Open Graph or Twitter metadata for shared room links**

- Where: `layout.tsx` `metadata`. The rendered `/?room=XXXX` head has no `og:*` or `twitter:*` tags and no `metadataBase`.
- What's wrong: a room link pasted into iMessage, WhatsApp, Slack or Discord shows a bare URL and no preview. The brief commits to "Shareable room links" and phone buzzing.
- Suggested fix: add `openGraph`/`twitter` (title, description, 1200x630 image via `opengraph-image.tsx`) and `metadataBase`. Optionally use `generateMetadata` so `?room=` gets "Join room ABCD" copy.

**[P1] On a join link, a guest's first tap doesn't unlock audio or speech**

- Where: `primeAudio`/`primeSpeech` are only called from `Board.tsx:130` (picking a clue), `PodiumClueButtons` (buzz) and `RoomToolbar` Begin. `Landing.tsx` (New Game, Join) and the Onboarding "Let's play" button don't call them.
- What's wrong: on iOS, a guest who joins from a link and isn't the picker never taps a tile. Their clue readout stays silent (speechSynthesis and the WebAudio context are locked) until their first buzz, which is after the readout they needed. The iOS silent switch also mutes WebAudio SFX, and `navigator.audioSession` isn't set.
- Suggested fix: prime in the Join, New Game and "Let's play" handlers, plus a one-time `pointerdown` listener on `document`. Set `navigator.audioSession.type = "playback"` where supported, and show a "Tap to enable sound" chip if the context is still suspended.

**[P2] `theme-color` doesn't match between the meta tag, the manifest and the body**

- Where: `layout.tsx` `themeColor: "#070a16"`; manifest `theme_color: "#3b6cff"`, `background_color: "#070a16"`; MUI body `#000000`.
- What's wrong: the installed PWA title bar or task switcher is bright blue, while the in-browser bar is navy and the page is black. The splash screen shows a navy-to-black flash.
- Suggested fix: pick one value (black `#000` or navy) for all three.

**[P2] No service worker or offline shell; a reload while offline shows the browser error page**

- Where: `public/` has no `sw.js`, and nothing registers one.
- What's wrong: once installed, launching with a flaky connection shows Chrome's dino page (`run4.mjs` → `ERR_INTERNET_DISCONNECTED`). Some browsers also want a SW for the richer install prompt, and there's no `beforeinstallprompt` UX.
- Suggested fix: add a minimal SW (Serwist or next-pwa-style) that precaches the app shell and serves an offline page saying "You're offline — rooms need a connection". Solo boards could run from the cached fixture.

**[P2] The screen can sleep mid-game (no Wake Lock), and there's no haptic feedback**

- Where: no `navigator.wakeLock` or `navigator.vibrate` in `src/` (grep).
- What's wrong: phones auto-lock during long readouts, spectating or the Final Jeopardy think time, which drops the socket. Buzz, lockout and correct/incorrect results give no haptic confirmation (supported on Android).
- Suggested fix: request `screen` wake lock while in a room, and re-acquire it on `visibilitychange`. Call `navigator.vibrate(15)` on a successful buzz and a longer pattern on lockout, behind the reduced-motion/haptics preference.

**[P2] Onboarding copy is keyboard-only on touch devices**

- Where: `Onboarding.tsx` step 3, "Press Space the moment the lights come on…". See `s_onboarding.png`.
- Suggested fix: under `(pointer:coarse)`, say "Tap BUZZ the moment the lights come on".

**[P2] Answer and room-code inputs lack mobile keyboard hints**

- Where: the answer field (`MicAnswerField`/`ClueControls`) and the room code input on Landing. Measured: no `autocapitalize`, `autocorrect`, `spellcheck`, `enterkeyhint` or `autocomplete="off"`.
- What's wrong: iOS autocorrect rewrites proper-noun answers ("Izzard" becomes "Lizard") and Chrome may suggest autofill. The room code should open an uppercase, no-autocorrect keyboard.
- Suggested fix: answer field gets `autoCorrect="off" autoCapitalize="none" spellCheck={false} autoComplete="off" enterKeyHint="send"`. Room code gets `autoCapitalize="characters" autoCorrect="off" inputMode="text" enterKeyHint="go"`.

**[P2] Sticky hover scale on board tiles after a tap**

- Where: `Board.tsx` tile `"&:hover": { filter, transform: scale(1.02) }`, not wrapped in `@media (hover:hover)`.
- What's wrong: on touch, the tapped tile keeps its hover state, so a glow is left behind when the board returns.
- Suggested fix: wrap it in `@media (hover: hover)`.

**[P2] First load: no code splitting, and fonts load from a render-blocking Google Fonts stylesheet**

- Where: no `next/dynamic` or `React.lazy` in `src/` (grep). `CustomGameBuilder`, `ReplayView`, `GamePicker`, `TranscriptPane`, `ShortcutsOverlay` and `SettingsPanel` all ship in the initial bundle. `layout.tsx` uses a `<link rel="stylesheet">` to fonts.googleapis.com instead of `next/font`. The MUI body stack starts with `Inter`, which is never loaded.
- What's wrong: in dev, the landing page pulled 7.3MB of uncompressed JS (the largest chunks were MUI 1.5MB and `src_*` 1.0MB), so prod will be noticeably heavier than it needs to be on 4G. The external font CSS is render-blocking and a third-party round-trip. When it's blocked, as it is in this sandbox (`ERR_CERT_AUTHORITY_INVALID`), the board falls back to system fonts, and when it loads late the tiles reflow. Measured LCP was 408ms and CLS 0 on local dev, so the jank risk is only on real networks. I didn't run a prod build, per the instructions.
- Suggested fix: `next/dynamic` the modals and builder, switch to `next/font/google` (self-hosted, `adjustFontFallback`), and drop `Inter` from the stack or load it.

**[P2] The Next.js dev indicator sits on content on phones (dev only)**

- The "N" badge covers the lectern and landing text at bottom-left on every phone screenshot. It's dev-only, but it hides the lectern in e2e and audit screenshots. Consider `devIndicators: false` or moving it.

## Verified OK

- No horizontal page overflow on any device (scrollWidth equals clientWidth everywhere).
- Rotating portrait → landscape → portrait mid-clue keeps state and reflows correctly (`o_rotated-*.png`).
- Inputs are 16px, so iOS doesn't zoom on focus. The viewport doesn't block pinch-zoom, which is good for accessibility.
- The buzzer has `user-select: none` and a transparent tap highlight.
- The manifest is served as `application/manifest+json` with `display: standalone`.
- CLS was 0 on landing and on board deal (local).
