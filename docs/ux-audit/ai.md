# UX audit: AI and audio surfaces

Scope: AI judge, bots, readout voice, SFX, mic dictation, avatar host, and the settings that control them.
Probe scripts are in `scratchpad/ux/ai/`: `judge-probe.ts`, `bot-probe.ts`, `aijudge-spoof.ts`, `narrator-probe.ts`, `persona-probe.ts`, `voice-flow.mjs`, `voice-long.mjs`, `mic.mjs`, `sfx.mjs`, `judge-toggle.mjs`, `caption-mobile.mjs`, and `stub.js` (a fake speechSynthesis that logs calls).
Context: there is no judge API route and no OpenAI path. `judgeWithReasoning` and `setAmbiguousJudgeResolver` are never called. Every verdict comes from the fuzzy `judgeAnswer` (in-memory-room.ts:307, JudgeBench.tsx:26).

---

**[P1] Any connected player can force an AI ruling on their own answer, even with AI judge off**

- Where: `src/lib/realtime/room-session.ts:61-67` passes the `ai-judge` frame through. `src/lib/realtime/in-memory-room.ts:243` and `runAiJudge` (l.297-325) apply it.
- What's wrong: `runAiJudge` never checks `settings.aiJudgeEnabled` or whether the sender is the host. It then dispatches `judge-answer` as `settings.hostId`, which skips the host-only guard in `clue-flow.ts:387`. A player who buzzes can send `{t:"ai-judge", targetPlayerId:<self>}` and get scored before the human host rules. This breaks the rule that realtime clients send intent only.
- Repro: `bun aijudge-spoof.ts` sets up a room with `aiJudgeEnabled:false`, host "ada", and player "mal". Mal buzzes, answers, and sends `ai-judge` from their own connection. Result: `judges={"mal":false}` and mal's score is -200, ruled without the host.
- Suggested fix: in `receive("ai-judge")`, reject unless the sender is the host and `aiJudgeEnabled` is true, or drop the client frame entirely and let only RoomDirector call `runAiJudge`.

**[P1] Turning "AI judge" off mid-game does nothing; the room keeps auto-judging**

- Where: `PlayersPanel.tsx:204-212` calls `setAiJudge` (`game-store.ts:366`). That only updates `lobby`. `aiJudgeEnabled` reaches the room only in `dealBoard` and at room creation (`room-session.ts:98,178`).
- What's wrong: the switch appears to work but the room ignores it. A host who wants to judge by hand still gets overruled after 900 ms (`room-director.ts:283`).
- Repro: `node judge-toggle.mjs` starts a game, opens More > Players and turns off AI judge. Result: `{"lobby":false,"room":true}`.
- Suggested fix: have `setAiJudge` also send `update-settings {aiJudgeEnabled}` when a runtime exists, and drive the switch from `publicState.settings`.

**[P1] Fuzzy judge accepts wrong numbers and partial names**

- Where: `src/lib/ai/judge.ts:137-156`. The substring "inclusion" bonus is at least 0.65 + overlap×0.35, and it compares characters, not words.
- What's wrong: Jeopardy answers often hinge on digits and regnal numbers, and these get marked correct:
  - "2" for "12" (0.825)
  - "12" for "2"
  - "100" for "1000" (0.91)
  - "Henry VIII" for "Henry VII" (0.965)
  - "Mary" for "Mary I"
  - "Washington" for "George Washington" (0.856, arguably fine)
  - "on" for "London" scores 0.77, just under the threshold
- Repro: `bun judge-probe.ts`. 19 of 54 cases disagree with a human judge.
- Suggested fix:
  - Match on whole tokens only (the answer's tokens must be a subset of the expected tokens, or the reverse).
  - Require an exact match for numeric and roman-numeral tokens.
  - Never let the inclusion bonus pass for answers under about 4 characters.

**[P1] Fuzzy judge rejects answers a human host would accept**

- Where: `normalizeAnswer`, judge.ts:17-53.
- What's wrong: these valid answers are marked incorrect:
  - "4" vs "four", and "four" vs "4" (score 0). Number words are not normalised.
  - "1812" vs "the War of 1812" (0.777, 0.003 below the threshold).
  - "who was lincoln", "what was the alamo". "was/were" prefixes are missing, and "whats" (no apostrophe) only passes by luck.
  - "St. Louis" vs "Saint Louis", "Mt Everest" vs "Mount Everest".
  - "Mars (planet)", and archive-style answers with parentheticals such as "Canada (accept: Dominion of Canada)" (0.716).
  - "U.S.A." normalises to "u s": dots become spaces, and then the article filter deletes the lone "a".
  - "Café" vs "Cafe" (no Unicode diacritic folding).
  - "M*A*S\*H" vs "MASH".
  - "Abe Lincoln", and the misspelling "Lincon" vs "Abraham Lincoln" (0.4).
- Repro: `bun judge-probe.ts`.
- Suggested fix:
  - Apply NFD normalisation and strip diacritics.
  - Map number words to digits.
  - Expand common abbreviations (st/saint, mt/mount, dr).
  - Add was/were/whats prefixes.
  - Strip non-alphanumerics before splitting, and collapse single-letter runs (u s a → usa) before removing articles.
  - Treat parenthetical text in `correctResponse` as optional or alternatives.
  - Score the answer against the surname token alone as well.

**[P1] Bots' deliberately wrong answers are judged correct 83% of the time**

- Where: `bots.ts:139-154` (`scrambleAnswer`) together with the fuzzy judge.
- What's wrong: a "wrong" bot answer either swaps two letters (sometimes the same index, which leaves the answer unchanged) or drops one word of a multi-word answer. The judge accepts most of these ("Kilimanjaro" for "Mount Kilimanjaro", "Missispispi", "Shakespeare" unchanged). So a Rookie is far stronger than its profile: effective accuracy is about 0.74, not 0.49. The difficulty tiers blur together.
- Repro: `bun bot-probe.ts`, section 3. It forces the wrong path 4000 times: 1605 blank answers and 2395 attempts, of which 1981 are judged CORRECT.
- Suggested fix: generate wrong answers that are really wrong (a same-category distractor, or a string outside the judge's accept band). Add a unit test asserting `judgeAnswer(scramble(x), x).correct === false`.

**[P1] A bot leading into Final Jeopardy always wagers everything, even with the game locked**

- Where: `room-director.ts:204` passes `leaderScore = max(all scores)`, which includes the bot's own score. `bots.ts:92-96` then sets `required = leader*2 - current + 1 = current + 1`, which becomes all-in.
- What's wrong: every tier wagers 100% when ahead. That includes a runaway (20000 vs 5000), where the correct play is $0, so a bot throws away games it has already won.
- Repro: `bun bot-probe.ts`, section 2. Every profile wagers 20000 with a 20000/5000 lead, and a Rookie wagers 10000 with a 10000/9000 lead.
- Suggested fix: pass the highest _opponent_ score. Wager `max(0, 2*second - current + 1)` to cover, capped by aggression, and wager 0 when `current > 2*second`.

**[P1] Muting, turning the host off, or leaving the room doesn't stop the clue being read**

- Where: `AvatarHostController.tsx:55-57` deliberately has no cleanup. Nothing calls `narrator.cancel()` when `soundEnabled` or `avatarHostMode` changes, on Home/Leave, or on `skip`.
- What's wrong: the mute switch and the toolbar speaker don't silence a readout already in progress, and the voice keeps talking on the landing page after Home.
- Repro: `node voice-long.mjs mute|home|hostoff` with a 220-character clue. In all three cases the log shows no `cancel`, and the utterance keeps going until `end` about 6.7 s after the action (with Home, the page is already back on the landing page).
- Suggested fix: cancel through the narrator (so `generation` bumps) when sound turns off, when the mode turns off, on unmount or route change, and on `clue-closed` or `round-advanced`. If the SAPI StrictMode worry is real, guard it with a mounted ref or a delayed cancel rather than skipping cleanup.

**[P1] Host says "Incorrect." once per game, then never again**

- Where: `avatar-narrator.ts:67-71`. Duplicates are filtered by comparing text with the _last text of the same cue type_, for the whole session.
- What's wrong: the dedupe exists to stop re-played events from speaking twice, but it also silences real repeats. After the first "Incorrect." (Classic Host) or "Not quite…" (Coach), every later wrong answer is silent. "That is correct, Ada." is also silent when Ada gets two in a row. The caption still updates, so captions and voice drift apart.
- Repro: `bun narrator-probe.ts` emits incorrect, incorrect, correct(Ada), select, correct(Ada), incorrect and speaks only 3 of the 6. Speak flags: `[true,false,true,true,false,false]`.
- Suggested fix: dedupe by event identity (event id, or clueId + type + target) rather than text, or stop replaying old events.

**[P1] Every sound effect plays twice**

- Where: `AvatarHostController.tsx:59-83`. The effect depends on `publicState`, and `lastEvents` persists until the next batch. The room sends `game-events` and then `public-state`, so the same events are processed twice.
- What's wrong: buzz, correct, incorrect and timeout all double up about 60-90 ms apart, which sounds like a flam or echo, and a sound can replay whenever state changes without new events.
- Repro: `node sfx.mjs` counts oscillators. One buzz produces 4 square-wave oscillators (2 per sting, 2 bursts at +0 ms and +86 ms). One wrong answer produces 4 sawtooth oscillators.
- Suggested fix: key processed events by id or sequence and skip ones already played, or clear `lastEvents` after they are consumed. Take `publicState` out of the effect dependencies and read it through `getState()`.

**[P1] Voice personas pick the wrong voice or gender; on Edge the default "Aria" is a male voice**

- Where: `voice.ts:81-91` (`detectGender`) and `matchPersona` (l.325-336).
- What's wrong: the gender detection lists miss common voice names, and the fallback grabs the first voice with a matching gender, or else the first voice of any gender:
  - "Google UK English Male" is detected as "neutral" because "male" isn't in the male regex.
  - Edge natural voices Andrew, Emma, Christopher and Michelle are all "neutral".
  - Personas that name Emma, Nora, Natasha, Davis or Brandon can never match, because those names aren't in the gender lists.
  - As a result, on Edge the default `female-natural` resolves to **Andrew (male)**, and "Guy" resolves to the robotic SAPI **David** instead of an HD voice. On Chrome, "Guy"/"Daniel"/"Deep" resolve to the female Google US English.
- Repro: `bun persona-probe.ts`.
- Suggested fix: extend the gender tables (Edge/Google/Apple voices, plus a `/\bmale\b/` check), and have the fallback prefer the highest-quality voice of the right gender. When a persona can't be matched, show "Aria (unavailable: using X)".

**[P1] Mic permission denied or a recognition error gives no feedback**

- Where: `MicAnswerField.tsx:76-79`. `onError` ignores the message. `speech-recognition.ts:101`.
- What's wrong: on `not-allowed`, `no-speech`, `network` or `audio-capture` the icon just flips back. There's no helper text, snackbar or aria-live message, so the user doesn't know why dictation stopped or how to fix it.
- Repro: `node mic.mjs denied` and `node mic.mjs silent`. After clicking the mic, `aria-pressed` returns to false and there are no alert or status elements or helper text.
- Suggested fix: map error codes to messages ("Microphone blocked: allow it in the address bar", "Didn't catch that") in `FormHelperText` plus an aria-live region. Hide or disable the mic after a `not-allowed`.

**[P1] Legend bot is effectively unbeatable**

- Where: `profiles.ts:106-114` and `bots.ts:57-60`.
- What's wrong: once a bot buzzes, it's correct with probability `targetAccuracy + 0.15`. That's 1.00 for Legend and 0.89 for Champion.
  - Legend buzzes 90-420 ms after `readoutEndsAt`, measured on the room clock with no network delay.
  - A human needs visual reaction time (about 200-300 ms), plus the public-state broadcast, plus their RTT.
  - Legend therefore rings in first on most of the 88% of clues it "knows" and never misses.
  - Champion's 250 ms floor is also below a typical human's time from seeing the buzzer open to the buzz landing.
- Repro: `bun bot-probe.ts`, section 4.
- Suggested fix: cap the post-buzz correct rate below 1 (for example `targetAccuracy + 0.05`, at most 0.95). Measure the bot delay from when clients see the buzzer open (add a typical RTT), or apply the same latency compensation humans get. Set Legend's floor to about 250 ms.

**[P2] Bot knowledge is re-rolled on every state change during a clue**

- Where: `room-director.ts:257-270`. `decideBotBuzz` runs on every `evaluate()`. A "doesn't know" result leaves nothing pending, so the next unrelated same-scope change rolls again.
- What's wrong: the buzz rate grows with room activity (joins, presence changes, a human's lockout, and so on), not with difficulty.
- Repro: `bun bot-probe.ts`, section 1, with same-scope changes. Rookie goes from 0.34 to 0.79 after 3 changes and 0.94 after 6. Casual goes from 0.52 to 0.96 after 3. (Scope changes such as extend-readout cancel the old timer, so they don't inflate the rate.)
- Suggested fix: roll once per bot per clue attempt and store the decision, keyed by scope, even when it's "no buzz".

**[P2] Bots ring in and then say nothing**

- Where: `bots.ts:60-63`. After a buzz the answer roll is independent, and 40% of misses are `""`.
- What's wrong: about 20% of Rookie buzzes are blank answers, which reads as broken rather than human. The buzz was also supposed to mean the bot knows the answer.
- Suggested fix: carry `knowsAnswer` from the buzz decision into the answer. Buzz on a hunch with a separate low probability, and give an attempted wrong answer rather than a blank.

**[P2] The judge's percentage is similarity, not confidence, and near-misses are ruled silently**

- Where: `JudgeBench.tsx:26,62-72` and the chat line in in-memory-room.ts:318-323.
- What's wrong: a wrong answer shows "12%" in red and a blank shows "100%" in red. The ambiguous band (0.6-0.85) goes through the unused `judgeWithReasoning`, so it's never flagged for the host. Auto-judging after 900 ms leaves the host almost no time to override, and the chat line explaining the ruling is hidden because chat is off by default.
- Suggested fix: show a verdict label ("Likely correct", "Unsure", "Likely wrong") with the matched alternative. For scores between 0.6 and 0.85, hold the ruling for the host (or extend the delay) instead of deciding. Show the ruling in the clue stage, not only in chat.

**[P2] Muting during Final Jeopardy doesn't stop the countdown music**

- Where: `ClueStage.tsx:200-222` (`useFinalTheme`). When `live` turns false because `soundEnabled` went false, the branch only stops if the clue is gone or revealed.
- Repro (read from the code): `soundEnabled` true, then false while the Final Jeopardy clue is live. `live` becomes false, `clue.correctResponse` is still undefined, and the effect returns without calling `stopFinalTheme()`. The theme plays for its full 30 s.
- Suggested fix: call `stopFinalTheme()` whenever `!live`.

**[P2] "Stop listening" submits the answer**

- Where: `MicAnswerField.tsx:57-61`. `stop()` makes the recogniser deliver its final result, and `onFinal` still calls `onSubmit`.
- Repro: `node mic.mjs stop`. The interim text "what is jup" shows; clicking Stop removes the answer field and shows the correct response, so the answer was sent.
- Suggested fix: the Stop button should `abort()`, or leave the transcript in the field for review. Keep auto-submit only for a natural end of speech, or make auto-submit a setting.

**[P2] No clear state while listening, and no hint when dictation isn't supported**

- Where: `MicAnswerField.tsx:115-133`.
- What's wrong: listening is shown only by the icon colour. There's no "Listening…" text, level meter or aria-live announcement. On Firefox, or wherever SpeechRecognition is missing, the mic button silently disappears (`mic.mjs unsupported` gives count 0), while the "?" shortcut list still advertises "Answer by voice".
- Suggested fix: add placeholder or helper text such as "Listening… speak now", a pulsing ring, and aria-live. Show a disabled mic with a tooltip "Voice answers need Chrome, Edge or Safari".

**[P2] Voice menu shows "Default" but reads with a different voice, and throws MUI out-of-range warnings**

- Where: `SettingsPanel.tsx:49-70` and the default `voiceProfileId: "female-natural"` (game-store.ts:186).
- What's wrong: when no persona is claimed (Chrome's Google voices, Edge), the stored id isn't an option. The Select renders "Default" and the console fills with `MUI: out-of-range value 'female-natural'`. The voice actually used is the persona fallback (Google UK English Female on Chrome), not the top-ranked voice that "Default" suggests.
- Repro: `node voice-flow.mjs`.
- Suggested fix: always include a "Browser default" option. Store the id that actually resolved, or show "Aria → Google UK English Female".

**[P2] Voice preview queues instead of restarting, and doesn't match readout pace**

- Where: `SettingsPanel.tsx:94-101`.
- What's wrong: three clicks on Preview queue three utterances (`voice-flow.mjs` preview log). The preview uses rate 1 while readouts use 0.92 (avatar-narrator.ts:96), and there's no rate control anywhere.
- Suggested fix: use `interrupt: true` and the same rate. Add a reading-speed setting (0.8-1.2) that also feeds `spokenDurationEstimateMs`.

**[P2] Clue readout depends on the Host setting, and "Avatar" mode is the same as "Voice"**

- Where: `AvatarHostController.tsx:75` (readout only when mode ≠ off). `avatarHostMode` is only ever compared with "off"; nothing renders an avatar, and `animationHint` is unused.
- What's wrong: the landing page promises "Every clue read aloud: turn sound on", but Host = Off plus Sound = On reads nothing, with no explanation. The "Avatar" option changes nothing.
- Suggested fix: split "Read clues aloud" from "Host commentary". Hide the "Avatar" option until an avatar exists, or label it "coming soon".

**[P2] No volume control; one Sound switch covers voice, effects and music**

- Where: `sfx.ts:223` (`setSfxVolume` is exported but never called). Master gain is fixed at 0.9. `utterance.volume` defaults to 1.
- What's wrong: players can't keep the readout and drop the stings, or the reverse.
- Suggested fix: add separate "Voice" and "Effects" sliders in Settings, persisted in preferences.

**[P2] Host caption covers the player podium on phones**

- Where: `AvatarHostController.tsx:86-96` (fixed at bottom:16/right:16, zIndex 1300).
- What's wrong: on an iPhone 13 viewport the caption box (x 226-374, y 602-648) sits over the podium name and score (`caption-mobile.png`). It also repeats a clue that's already on screen.
- Suggested fix: on xs, dock the caption into the stage (above the ring-in bar) or at the top, and skip the caption for `clue-readout`, since the stage already shows the text.
