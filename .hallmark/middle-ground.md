# Middle ground: OLD (0a567fc) vs NEW (Hallmark redesign)

The owner preferred OLD. Base for every visual file is OLD as it stood after the helper-text and em dash cut (bb91b6d), with only the NEW changes below kept on top.

| Area | OLD did better | NEW did better | Decision |
| --- | --- | --- | --- |
| Tokens and theme | Black stage, blue interactive keys, bevelled keys, glowing red buzzer, the show's energy | Nothing a player sees as better | OLD `jeopardy-style.ts` and `theme.ts`; kept NEW's no-ring on dialog frames, popovers and menu lists |
| Landing | Big blue wordmark, glowing board-blue host card, gold New Game, uppercase keys | Nothing; the board-as-hero split lost the welcome | OLD layout, no tagline, features, eyebrows or code hint (cut rule); curly apostrophes in errors |
| Board and clue panel | Hover lift on tiles, OLD header sizes | Keyboard focus ring also on MUI's focus-visible class | OLD; kept the focus class, `clue-headline` test hook, "X is wagering" copy |
| Lecterns | Gradient podium with base, gold glow for the picker, white glow for who rang in | Player faces (owner decision) | OLD podium with `PlayerAvatar` on the top edge |
| Buzzer and bench | Red glowing buzzer, Oswald key faces | Ruling label legible at 14px; judge bench no longer repeats names in Final | OLD keys; kept NEW JudgeBench copy and Final dedupe |
| Room toolbar and notices | OLD capitals, glowing code | Notices moved bottom-left so they no longer cover the toolbar | OLD bar; notices bottom-left |
| Phone play | OLD look | Clue panel clears the fixed buzz bar (OLD hid the answer field under it) | OLD look with NEW's height fix |
| Final at 1440x900 | OLD look | Own lectern stays on screen (shorter clue panel) | Kept the fix |
| TV views | OLD colours, tracking, QR size | 16px minimum type; corner keys at 3:1 | OLD look with 16px minimums and 0.5 opacity corner keys |
| Results | Centered winner banner, cards, coloured standings | Nothing the owner wanted; tables read as a spreadsheet | OLD, middle dots replaced by gaps |
| Avatar host | OLD radial face and caption card | Faces are icons, not emoji (agentlint rule) | OLD styling, NEW icon faces |
| Global CSS | n/a | Base focus ring, `overflow-x: clip`, reduced motion at 0s | Kept, Hallmark comments removed |
| design.md | n/a | n/a | Rewritten to describe what ships |
