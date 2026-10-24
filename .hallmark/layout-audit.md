# Layout audit: fit and finish

`bun run audit:layout` (README, "Layout audit") plays one game at 1440x900, 1280x800, 1024x768, 768x1024, 390x844, 360x740 and a 1920x1080 television, with a host, a guest and a TV in one room, and measures 58 views on the way. The app is dark only, so there is one theme. The look is the restored pre-Hallmark design (#29) and the constant stage (#30); nothing here changes either.

Baseline: 906 findings across 396 page loads (696 of them the TV's clue card measured as overlapping the board squares under it). After: 0 findings across 406 page loads. Some of the drop is the audit learning to skip what is not a defect (see "Audit"), the rest is the fixes below.

## Findings and fixes

| View | Viewport | Problem | Fix |
| --- | --- | --- | --- |
| TV clue, Daily Double, answer | all | The board squares stayed live under the clue card: every one read as a control under the card's "Reveal the answer" key (174 per view), and a screen reader walked all thirty | `BoardGrid` takes `covered` and goes `inert` while a clue is laid over it |
| TV Final | all | The countdown printed `0:122` for a Final clock over a minute | `formatCountdown` in `src/lib/foundation/clock.ts` (m:ss, tested) |
| Landing, join, shared-game error | desktop, laptop, tablet-land | "Build or import a game" sat 17px in from the wordmark | The wordmark's lean pushed its ink out of its box; `Wordmark` now pads for the lean (`0.09em`), and the build link pulls its icon under the mark's foot |
| Landing | phone-sm | Page scrolled 25px; mark wider than 80% of the column | Tighter phone gaps and padding; hero mark 52px on a phone |
| Room toolbar | phone, phone-sm | The two housings floated 22 to 24px inside the board's edges | Two equal columns on a phone; each housing fills its half, so the toolbar spans the board edge to edge |
| Room toolbar | tablet, results | Wordmark ink started 3px left of the board and results banner | Same `Wordmark` padding |
| Board | tablet, laptop, desktop | Category names about 11 to 13px in a strip 50 to 80px tall | `categoryFontSize` 12/columns cqw (was 9.5); the TV's multiplier drops to 1.1 so the television is unchanged |
| Board | phone-sm | Long categories ("CROSSWORD CLUES "Y"", "NUMERICAL EXPRESSIONS") cut off at top and bottom | Phone category row 1.8fr (was 1.35fr): four lines of 11px fit |
| Board | tablet-land (1024x768) | Room 14px taller than the screen, lecterns under the fold | Desk stage floor 47% of the height (was 50%); 800 and taller are unchanged |
| Clue answering | laptop, desktop, tablet | Answer bar plus judging bench overflowed the reserved clock strip by 6px | Strip gap and padding trimmed so both fit `clockStripSx` |
| Clue answering | tablet | The answer housing ran 8px past the board's left edge | `BuzzLights` capped at the strip's width; the answer field shrinks to fit (`min(250px, 100%)`) |
| Clue judging, Final | all | A lectern with a badge stood 4px higher than one without | Badge line height pinned to its 11px box; lectern row aligns tops |
| Transcript | phone | Pane covered the second toolbar row and had a 15/16px gutter | Under the two-row toolbar on a phone, 12px gutters both sides |
| Results | all | "How everyone played" cards centred in a full-width card, off the heading's edge | Cards start under the heading |
| Results | all | Accuracy bars read as cut off | Marked `data-audit-clip-ok`: the bar slides inside its track by design |
| TV results | phone, phone-sm, tablet | Trophy and Final cards clipped by the stage | Sizes take the smaller of the TV's height share and the matching width share (`tv()`), unchanged at 16:9 |
| TV join panel | phone, phone-sm | Panel ran under the corner keys; the room code spilled 34px | Panel capped clear of the keys, QR scales down, tighter code tracking on a phone, address hidden where it cannot fit one line |
| Builder | phone | Remove-category key dropped to its own line | Name field basis 140px, so count and both keys share its line |

## Looked at, left as is

- The phone layout keeps a 150px clock strip and the buzz bar's 84px under an idle board. That is #30's constant stage: the lecterns must not move when a clue opens.
- The settings popover scrolls inside itself at 768 tall and on phones; everything in it is reachable.
- The builder's round tabs scroll sideways on a phone with MUI's arrows.
- The game picker is full screen on a phone with its controls at the top.
- A removed guest sees the room notice and the banner say the same sentence; that is notice wiring, not layout.
- "Replay last game" says no completed game is stored straight after a game ends in the same tab; behaviour, not layout.

## Audit

Ported from fantasy-pl (`scripts/layout-audit/`), adapted to one route with many states: the runner drives the room through the dev store handle with the same intents the buttons send, on archive episode 9644. Changes to the checks, each with a test in `tests/unit/layout-audit/detect.test.ts`:

- Text an element cuts off itself (overflow hidden, no ellipsis or clamp) is flagged (`text-clipped`); this is what found the category names.
- Disabled and inert controls are not counted as overlapping.
- Clipping is measured only on the axes a container cuts off, not the ones it scrolls (MUI's scrollable tabs, a scrolling popover).
- A transparent element and its subtree (a switch's real input) are not measured.
- A centred control may sit up to 6px off true centre (icon side bearing, trailing letter spacing) before it is compared with the page's left edge.
