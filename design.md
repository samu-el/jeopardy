# Design: Jeopardy

The locked system. Every Hallmark run reads this first and every screen shares it. Change it on purpose; the file is the rule.

## System
- Genre: playful (a party game), set as app screens: the landing is the one page, everything after New Game is a screen someone plays in.
- Shape: app screen (landing: a Stage split, the board-blue field on one side, the two ways in on the other).
- Theme: brand, kept. The show's board blue, the two golds and the self-hosted Oswald and Bitter faces are the material.
- Axes: dark / display-condensed / warm (gold) · posture: Committed (board blue carries the board, the clue and the landing field; gold is the one signal).

## Tokens
`src/lib/foundation/jeopardy-style.ts` is the source of truth (hex, so `contrast.ts` can test every pair).
`src/lib/foundation/theme.ts` maps it onto MUI and writes the roles below on `:root` for hand-written CSS.
```css
:root {
  --color-paper: #080A1F;  --color-paper-2: #0F1333;  --color-paper-3: #181D49;   /* stage, surface, raised */
  --color-ink: #F5F6FF;  --color-ink-2: #B9BDE0;  --color-muted: #9DA2CC;  --color-rule: #2A2F5E;
  --color-edge: #6E74A8;                     /* a field's edge, 3:1 or better on every surface */
  --color-accent: #F2C14E;  --color-accent-ink: #1A1200;  --color-focus: #F2C14E;   /* gold */
  --color-field: #060CE9;                    /* the board blue, a declared surface, not accent */
  --color-error: #FF4E5B;  --color-success: #2FD07A;
  --font-display: Oswald (the show's condensed face);  --font-body: the platform UI face;  --font-outlier: Bitter (clue text only);
  --radius-control: 8px;  --radius-panel: 12px;  --rule-hair: 1px;  --shadow-card: none;
}
```
Type is fixed at a 1.2 ratio from a 16px body (h6 16, h5 19, h4 23, h3 28, h2 33, h1 40); no fluid heads outside the board and the television.

## Type rules
- Capitals belong to the show: Oswald uppercase for headings, the board, the clue and the television, tracked 0.02em at most, never under 16px.
- Everything else (buttons, labels, chips, tabs, menus, captions, table heads) is the body face, sentence or title case as written, untracked.
- Bitter is the clue face and nothing else. Money on the board and the lecterns is Oswald; money in a table is the body face with tabular numerals.

## Controls
- Primary: gold fill, `--color-accent-ink` text, 8px radius, 40px (app) or 48px (landing). One per screen or dialog.
- Secondary: a flat key (`--color-paper-3` fill, a hairline) or text, same radius and height.
- The buzzer: flat red, near-black label; it is the only red control.
- No bevels, inset highlights, gradients on controls or coloured glow shadows. Elevation is lightness.
- Focus: a 2px gold outline, offset 2px, instant, on everything that takes focus.

## Exceptions (named on purpose)
- The judge bench's verdict keys: Correct is a green fill and Incorrect a red one, side by side. They are the ruling itself, colour-coded and labelled, so they are the one place two filled keys stand together (F4).
- Room codes are tracked capitals in the display face (0.12em to 0.3em) on readouts: the code field, the join card, the room bar and the TV join panel. A code is read out letter by letter; the spacing is what keeps the letters apart.
- Player avatars are emoji the player picks and stores: their content, shown back as their face, not icons.

## Motion
- Character: brisk. Motion is state (a clue zooming from its tile, the round intro), 120 to 220ms on controls; everything ends at once under reduced motion or the in-app switch.

## Layout
- Meta never joins with a middle dot: separate elements with a gap, a list, or a table.
- No eyebrow over a heading; a panel names itself with its own heading.
- No card inside a card: a panel holds rows separated by hairlines.
- Room notices (joins, host changes) sit bottom-left, above the phone's buzz bar, never over the room toolbar.

## Exports
`jeopardy-style.ts` (TS objects) and the `:root` roles from `theme.ts`. Tailwind, DTCG or shadcn blocks are added here on request.
