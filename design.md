# Design: Jeopardy

What the app looks like and why, so a change keeps the look. The code is the source of truth; this file describes it.

## System
- A studio around the show's board. The board is the one specific object (board blue tiles, gold values, black seams); everything else is a black stage, deep blue panels and lit keys.
- Tokens live in `src/lib/foundation/jeopardy-style.ts` (`jeopardyPalette` for the board, `ui` for the studio, `controls` for keys and readouts). `src/lib/foundation/theme.ts` maps them onto MUI. Components draw from these and nothing else.
- Dark only.

## Colour
- Stage `#000000`; surface `#0B0F2A`; raised `#141A44`; hairlines are white at 10% and 22%.
- Board blue `#060CE9` (deep `#0409A8`, shade `#03066B`): the board, the clue panel, the Daily Double splash, the round intro, the results banner and the host card on the landing.
- Interactive blue `#4B5BFF`: the wordmark, links, a selected key, field focus. Its text tint `#8A96FF` is used where blue is text.
- Gold (bright `#F2C14E`, deep `#D69F4C`): values on the board, the room code, scores, New Game, what is lit right now.
- Green `#2FD07A` and red `#FF4E5B` are rulings and the buzzer; text on red is near-black.

## Type
- Oswald (the show's condensed face) uppercase for headings, the board, keys, readouts, lectern names and the television.
- Bitter for clue text only.
- The platform UI face for body copy, fields and tables.
- Text on the television never drops under 16px.

## Controls
- A key has a lit top edge and a dark underside (`controls.key`); the key that moves the game on is blue (`controls.keyPrimary`); the landing's New Game is gold.
- The buzzer is a glowing red key; it dims to a recessed key when it cannot be pressed.
- A readout (score, code, field) is black glass set into the surface.
- Lecterns are deep blue podiums with a base; the picker glows gold and the player who rang in glows white.
- Focus: a gold ring (2px, offset 2px) on anything that draws none of its own; tiles ring inside their edge; fields ring their outline. Dialog frames and menu lists take focus without a ring.

## Faces
- A player's face is a `PlayerAvatar`: a filled Material icon from a fixed set, or their initial in Oswald, on the player's own colour. Never emoji. It sits on the lectern's top edge, in the players panel and in the avatar picker.

## Copy and layout
- No taglines, helper text or secondary labels. A screen makes sense from its headings, controls and data.
- Meta never joins with a middle dot: `MetaParts` sets the pieces apart with a gap.
- Curly apostrophes and quotes in copy; no em dashes anywhere.
- Room notices sit bottom-left, above the phone's buzz bar, never over the room toolbar.

## Motion
- Brisk: a clue zooms from its tile, the Daily Double slams in, the round intro fades. Everything ends at once under reduced motion or the in-app switch (`src/lib/foundation/motion.ts`, `src/app/globals.css`).
