# UX audit: Custom game builder + Settings panel

Scope: src/components/CustomGameBuilder.tsx, src/components/builder/_, src/lib/data/{builder,published-game,normalize,game-library}.ts, src/components/SettingsPanel.tsx.
Method: Playwright against http://localhost:3000 plus rooms worker :8787, at 1440x900 and 390x844. Scripts and screenshots are in `scratchpad/ux/builder/` (t1–t6.mjs, d-_.png, p-\*.png).

---

**[P0] A JSON file with the wrong shape crashes the whole app**

- Where: `parseBuilderGame` (src/lib/data/builder.ts:181) and `CustomGameBuilder.tsx:63`.
- What's wrong: the parser only checks that `categories` and `clues` are truthy. `{"categories":"x","clues":"y"}` gets through, then `draft.categories.map is not a function` throws during render. The page is replaced by Next's "This page couldn't load", and the live game and room are lost.
- Repro: Room → More → Build a game → Import (upload icon) → pick `shape.json` (in the scratchpad). Screenshot: `d-import-shape.json.png`.
- Suggested fix: validate the import against a schema. `categories` should be an array of `{id: string, name: string}`, and `clues` an array with string `clue`/`correctResponse`, a finite `value`, a known `round` and a `categoryId` that exists. Report field-level problems. Wrap the builder in an error boundary.

**[P1] Importing JSON with categories that have no name corrupts the draft, and Save then throws silently**

- Where: builder.ts:88 `cat.name.trim()`; CategoryCard/CustomGameBuilder inputs become uncontrolled.
- What's wrong: `{"categories":[{"id":"c1"}],"clues":[]}` is accepted. React warns about a controlled→uncontrolled input. When you click Save, `Cannot read properties of undefined (reading 'trim')` is thrown in the handler. Nothing happens and no message appears.
- Repro: import `noname.json` and click Save. The console shows a PAGEERROR and the dialog just stays open.
- Suggested fix: the same schema validation as above. Coerce missing strings to "" on import.

**[P1] Money field reorders rows while you type and can't be cleared**

- Where: CategoryCard.tsx:31 (`sort` by value on every render) and :49 (`Number(v) || 0`).
- What's wrong: clearing the $200 field turns it into `0`. Typing "1500" then gives `01500`, and the row jumps from the top of the column to the bottom mid-keystroke. The focused input moves on screen, so you lose your place and which clue belongs to which row.
- Repro: t1.mjs gives values `0,400,…` after clearing and `400,600,800,1000,01500` after typing. Screenshot: `d-reorder.png`.
- Suggested fix: keep rows in a fixed slot order (the row index) and don't sort on value. Hold the raw string while the field is being edited and parse it on blur. Consider a select limited to the round's standard values.

**[P1] Validation error is rendered below ~60 fields, off-screen**

- Where: CustomGameBuilder.tsx:127 (error Typography at the end of DialogContent).
- What's wrong: when Save or Publish fails, the only feedback is a line at y≈2828px inside a scrolling dialog. At 1440x900 nothing visibly happens when you press Save. The failing field isn't highlighted, and the message ("Missing answer in Category 3.") doesn't name the round or the value. Only the first 3 errors are shown.
- Repro: open the builder and click Save on the empty board. t1 prints `err box y: 2827`. Screenshot: `d-save-empty.png` shows nothing.
- Suggested fix: show errors in an Alert next to the actions (or a sticky summary) and scroll/focus to the first invalid field. Set `error`/`helperText` on the offending TextFields. Messages should include the round and value ("Double Jeopardy › Science › $800: answer missing").

**[P1] Duplicate category names silently merge into one column**

- Where: `buildNormalizedGame` (builder.ts:84–130) uses the category _name_ as the clue's category, and there is no uniqueness check.
- What's wrong: naming two categories "Science" produces a single SCIENCE column with two $200 cells stacked in it (`d-custom-board.png`).
- Repro: set Cat 1 and Cat 2 to "Science", fill the $200 clue in each, Save → Restart → Begin.
- Suggested fix: add a blocking error for duplicate names (compared case-insensitively after trimming) within a round.

**[P1] Partially filled boards launch with holes and no warning**

- Where: builder.ts:93 (`if (!text && !answer) continue;`). The only minimum is "at least one clue".
- What's wrong: a single clue is a valid game. Categories with no clues disappear. Columns with gaps render blank cells (`d-custom-board.png` has an empty cell under "CATEGORY 3"). A board with only default names ("Category 1") ships with those placeholder names. No warning-severity issues are ever produced, even though `customIssues` exists for them.
- Suggested fix: emit warnings for empty cells, empty categories, default placeholder names, a missing Final and a round with no Daily Double. Show a pre-launch summary ("27 of 60 clues filled") and let the user confirm.

**[P1] Save does nothing visible during a live game**

- Where: `stage()` → `setCustomGame` (game-store.ts:293). While `online`, the store records the custom game but the current board keeps playing. Begin is hidden while `inGame`.
- What's wrong: from the only entry point (inside a running game), Save closes the dialog and the archived board stays (`d-dup-board.png`). To see the game you have to discover Restart → Begin. When offline, the opposite happens: Save destroys the running local game without asking.
- Suggested fix: after Save, offer "Play now" (with a confirm that the current game ends) or "Keep for later", and show a toast saying which game is queued. Mark the queued custom game in the RoomBar.

**[P1] Unsaved edits are lost on refresh, and Cancel doesn't cancel**

- Where: use-builder-draft.ts:39. The draft lives in `useState` and is persisted only on successful Save/Publish (`saveBuilderDraft`). The dialog's hook is always mounted, so Cancel, Escape and backdrop click all keep the edits in memory.
- What's wrong: (a) after typing a whole board and reloading, or after a failed Save because the board is incomplete, everything is gone. t2 shows the title back to "My custom game" after a reload. An incomplete draft can never be persisted, because Save refuses invalid boards. (b) Cancel, Escape and backdrop click (MUI `onClose`) look like "discard", but reopening shows the edits still there (t2: "Edited title" after Cancel). Nothing warns about unsaved changes.
- Suggested fix: autosave the draft to the store/localStorage on change (debounced), regardless of whether it's valid. Rename Cancel to "Close" (the draft is kept) and add an explicit "Reset draft" with a confirm. Or make Cancel truly revert and confirm before discarding. Disable backdrop-click close.

**[P1] No CSV import in the UI, even though a CSV normalizer exists**

- Where: `normalizeCustomCsvGame` (normalize.ts:73) is not referenced by any component. The file input has `accept="application/json"`.
- What's wrong: the brief's "Import/export game packages as JSON and CSV" has only the JSON half. If a user forces a .csv through the picker, they get "Could not parse JSON." with no hint about the expected format. The import and export buttons are icon-only, with no visible label or format help.
- Suggested fix: accept `.json,.csv,text/csv` and route by extension/content to `normalizeCustomCsvGame` (surfacing its row-numbered issues). Document the columns (round, category, value, clue, answer, dd). Add a sample-template download and text labels on the buttons.

**[P1] Invalid or expired share link fails silently**

- Where: AppShell.tsx:25 `void loadPublishedGame(gameId)` throws away the `{ok:false, error}` result.
- What's wrong: `/?game=zzzzzzzzzz` shows the normal landing page with no message, and `?game=` stays in the URL (`d-invalid-link.png`). The recipient can't tell the link is broken. There is also no loading state while the game is fetched.
- Suggested fix: show the returned error ("That game link is not valid any more.") on the landing page, strip the param, and show a "Loading shared game…" state.

**[P1] Builder is hard to find**

- Where: Landing.tsx has no builder entry. The only way in is RoomToolbar → More (⋮) → "Build a game", which requires first pressing New Game, which deals and starts an archived episode.
- What's wrong: to write a game you have to start someone else's game first. The Change-game picker (GamePicker) doesn't mention custom games either.
- Suggested fix: add "Build a game" and "Import game" on the Landing page and in GamePicker.

**[P2] Publishing again always makes a new link; edit tokens are never used**

- Where: use-builder-draft.ts:136 calls `publishGame({...})` without `existingId`, although game-library.ts has full PUT/edit-token support.
- What's wrong: each Publish creates a new id (t5: `wzezjr7ss6` then `6nyey6cn7e`). Fixing a typo breaks the link already sent to friends.
- Suggested fix: store the published id with the draft and PUT to it. Offer "Publish as new copy" separately.

**[P2] Over-long text is silently truncated on publish**

- Where: published-game.ts `trimmed(value, max)` (limits: title 120, clue 600, response 200, category 80). The builder fields have no `maxLength` and no counter.
- What's wrong: a 700-character clue and a 150-character title were stored as 600 and 120 (checked via GET /games/:id). The publisher's local copy is staged from the untruncated draft, so the host and the recipients play different text.
- Suggested fix: set `maxLength` plus a character counter on the fields using `publishedGameLimits`, or raise a validation error instead of slicing.

**[P2] Publish success is easy to miss, and a copy failure is swallowed**

- Where: CustomGameBuilder.tsx:146–162.
- What's wrong: success is only a small text button showing the URL. There is no "Published" message, no copy icon and no explanation that clicking copies. A clipboard rejection is `.catch(() => {})`, so nothing happens. On a phone the URL button wraps into the crowded footer.
- Suggested fix: show a success Alert with a read-only URL field, a Copy button (with a fallback that selects the text) and the Web Share API on mobile.

**[P2] Re-importing the same file does nothing; import overwrites without confirm**

- Where: CustomGameBuilder.tsx:135. The file input's value is never reset (t4: it still holds `C:\fakepath\bad.json` after import), so choosing the same file again doesn't fire `change` in real browsers. `setDraft(parsed)` replaces the current board with no confirm or undo.
- Suggested fix: reset `event.target.value = ""` after reading, and confirm before replacing a non-empty draft.

**[P2] Imported data can be silently dropped**

- Where: builder.ts:91 (`if (!category) continue;` for unknown `categoryId`). Imported `triple-jeopardy` clues have no tab (buildableRounds has only 2 rounds), and imports with ≠6 categories render but can't be added to or removed from.
- Suggested fix: report orphaned or unsupported-round clues as issues, and support adding/removing categories and rows.

**[P2] Phone layout: dialog not full-screen, ~7,200px scroll, crowded footer**

- Where: CustomGameBuilder.tsx:42 (`maxWidth="lg"` without `fullScreen` on xs).
- What's wrong: at 390x844 the paper is 326px wide with 32px margins. The content is 7245px tall (60 clue rows × 3 stacked fields). The actions wrap into 3 rows that take ~165px (`p-scroll.png`). The title is just "Builder". There is no per-category collapse or jump navigation.
- Suggested fix: `fullScreen` below `sm`, collapsible category accordions with a filled-count badge (e.g. "3/5"), and a sticky single-row action bar.

**[P2] Clue fields lack context for screen readers; category inputs are unlabeled**

- Where: CategoryCard.tsx (the labels "$", "Clue", "Answer", "DD" are repeated 60 times); the category name fields use only `placeholder="Cat N"`.
- What's wrong: an assistive-technology user hears "Clue, edit" 60 times with no category, round or value. "DD" is unexplained jargon. Nothing enforces or explains a Daily Double limit.
- Suggested fix: add aria-labels such as "Science $400 clue", a label "Category 1 name", "Daily Double" spelled out, and a limit warning (1 in J, 2 in DJ).

**[P2] No image/media clue support**

- Where: the `BuilderClue`/`GameClue` types have no media field.
- What's wrong: the scope asked for image/media clues, and the builder, CSV and published formats have no way to attach an image, audio or video URL.
- Suggested fix: add an optional `media: {kind, url, alt}` to the contracts, validate it as https, and require `alt` for images.

---

## Settings panel

**[P1] "Host: Voice" is the default, but the host is silent because Sound defaults off, and nothing says so**

- Where: game-store.ts:183–188 (`soundEnabled:false`, `avatarHostMode:"voice-only"`); avatar-narrator.ts:79 drops speech when sound is off. AvatarHostController.tsx:86 hides the captions unless Subtitles is on.
- What's wrong: with default settings the host neither speaks nor captions, while the panel shows "Host: Voice". The dependencies (Host needs Sound; Subtitles only work when Host ≠ Off) aren't explained or reflected in the UI.
- Suggested fix: add helper text ("Turn Sound on to hear the host"), or disable/annotate dependent controls. Consider enabling Subtitles when Sound is off.

**[P1] Host "Avatar" option does the same thing as "Voice"**

- Where: SettingsPanel.tsx:41. `avatar-and-voice` is never branched on anywhere in src; only `=== "off"` is checked.
- What's wrong: choosing Avatar changes nothing visible.
- Suggested fix: hide the option until an avatar renders, or label it "(coming soon)" and disable it.

**[P2] Buzz window control misleads non-hosts**

- Where: game-store.ts:391. The change is sent only when `isHost`. The Select reads the local `preferences.buzzWindowSeconds`, not `publicState.settings.buzzWindowMs`.
- What's wrong: a guest can pick "20 seconds — relaxed". It persists locally and shows as chosen, but the room keeps its own window. There's no explanation of what the window is (time after the readout).
- Suggested fix: for non-hosts, show the room's value read-only ("Set by host"). Add helper text.

**[P2] Settings key uses a speaker icon, identical to the voice Preview button**

- Where: RoomToolbar.tsx:21 `import SettingsIcon from "@mui/icons-material/VolumeUpOutlined"`, and SettingsPanel's Preview uses the same VolumeUp icon (`d-settings.png`).
- What's wrong: users look for a gear. The toolbar key reads as "sound on/off", and inside the panel two identical speakers mean different things.
- Suggested fix: use a Tune/Settings icon for the toolbar key and a play icon for Preview.

**[P2] Reduced motion ignores the OS preference; settings have no explanations**

- Where: no `prefers-reduced-motion` or `useMediaQuery` anywhere in src. `reducedMotion` defaults to false.
- What's wrong: users with the OS setting get full animations until they find the toggle. None of the toggles (Sound, Subtitles, Chat, Reduced motion) or the Persona menu has helper text, and "Persona" is enabled even when Host is Off.
- Suggested fix: default `reducedMotion` from `matchMedia('(prefers-reduced-motion: reduce)')` until the user sets it. Add a one-line caption per control and disable Persona/Voice when Host is Off.

Settings persistence works: after a reload, localStorage `jeopardy.lobby.v2` had reducedMotion=true and buzzWindowSeconds=20.
