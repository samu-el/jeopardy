import { createTheme } from "@mui/material/styles";
import { controls, cssRoles, jeopardyFonts, ui } from "./jeopardy-style";
import { reducedMotionStyles } from "./motion";
import { viewportRootStyles } from "./viewport";

/**
 * The MUI theme is a thin wrapper over the tokens in `jeopardy-style.ts`
 * (the system is written down in `design.md` at the repo root): every colour
 * here is one of those, so a MUI component and a hand-drawn one end up the
 * same colour without either knowing about the other.
 *
 * Type: capitals belong to the show. Headings are the condensed display face
 * in uppercase; buttons, labels, chips, tabs and menus are the body face as
 * written, untracked. The scale is fixed at a 1.2 ratio from a 16px body.
 */
const bodyFont = jeopardyFonts.body;

/** A display heading: the show's face, uppercase, one weight, barely tracked. */
const displayHead = (fontSize: number) =>
  ({
    fontFamily: jeopardyFonts.display,
    fontWeight: 700,
    fontSize,
    lineHeight: 1.05,
    letterSpacing: "0.01em",
    textTransform: "uppercase",
    overflowWrap: "break-word",
    minWidth: 0,
    textWrap: "balance",
  }) as const;

/** The one focus ring: gold, 2px, instant. */
const focusRing = {
  outline: `2px solid ${ui.focus}`,
  outlineOffset: "2px",
} as const;

/** A panel that takes focus only to hold it (a dialog frame, a menu list): no ring of its own. */
const panelTakesFocus = { outline: "none" } as const;

export const appTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    // Gold is the one signal: the primary action, what is selected, focus.
    primary: {
      main: ui.goldBright,
      dark: ui.goldDeep,
      light: ui.goldHover,
      contrastText: ui.onGold,
    },
    secondary: {
      main: ui.goldBright,
      dark: ui.goldDeep,
      contrastText: ui.onGold,
    },
    success: { main: ui.green, contrastText: ui.onGreen },
    // Dark text on the red: white on #FF4E5B is 3.2:1 (fails AA), near-black
    // is 6.2:1, and the red itself still reads 5.1:1+ as text on every surface.
    error: { main: ui.red, contrastText: ui.onRed },
    warning: { main: ui.goldBright, contrastText: ui.onGold },
    info: { main: ui.blueText, contrastText: ui.stage },
    background: {
      default: ui.stage,
      paper: ui.surface,
    },
    text: {
      primary: ui.ink,
      secondary: ui.inkMuted,
      disabled: ui.inkFaint,
    },
    divider: ui.line,
    action: {
      hover: ui.hoverTint,
      selected: ui.goldTint,
      disabledBackground: ui.keyOff,
      disabled: ui.inkFaint,
    },
  },
  shape: {
    borderRadius: ui.radius,
  },
  typography: {
    fontFamily: bodyFont,
    h1: displayHead(40),
    h2: displayHead(33),
    h3: displayHead(28),
    h4: displayHead(23),
    h5: displayHead(19),
    h6: displayHead(16),
    // A panel's own name, in the body face. Never an eyebrow over a heading.
    overline: {
      fontFamily: bodyFont,
      fontWeight: 600,
      fontSize: 14,
      letterSpacing: 0,
      lineHeight: 1.4,
      textTransform: "none",
      color: ui.inkMuted,
    },
    button: {
      fontFamily: bodyFont,
      fontWeight: 600,
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 15,
      lineHeight: 1.2,
    },
    body1: { fontSize: 16, lineHeight: 1.5 },
    body2: { fontSize: 14, lineHeight: 1.45, color: ui.inkMuted },
    caption: { fontSize: 13, color: ui.inkFaint },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600, color: ui.inkMuted },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": { ...viewportRootStyles, ...cssRoles },
        html: {
          colorScheme: "dark",
          backgroundColor: ui.stage,
          WebkitTextSizeAdjust: "100%",
          overflowX: "clip",
          scrollbarColor: `${ui.lineStrong} ${ui.stage}`,
        },
        body: {
          backgroundColor: ui.stage,
          color: ui.ink,
          minHeight: "var(--app-svh, 100vh)",
          overflowX: "clip",
          caretColor: ui.goldBright,
        },
        "::selection": { background: ui.goldTint },
        ":focus-visible": focusRing,
        ...reducedMotionStyles,
      },
    },
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: { "&.Mui-focusVisible": focusRing },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: ui.radius,
          paddingInline: 16,
          minHeight: 40,
          whiteSpace: "nowrap",
          transition: "background-color 120ms ease-out, color 120ms ease-out, border-color 120ms ease-out",
          "&:active": { transform: "translateY(1px)" },
          
        },
        sizeSmall: { minHeight: 32, fontSize: 14, paddingInline: 12 },
        sizeLarge: { minHeight: 48, fontSize: 16, paddingInline: 24 },
        // One filled primary: gold, flat.
        contained: {
          border: `1px solid transparent`,
          "&.Mui-disabled": { ...controls.keyOff },
        },
        // The secondary key: a flat raised fill and a hairline.
        outlined: {
          ...controls.key,
          "&.Mui-disabled": { ...controls.keyOff },
        },
        text: { color: ui.inkMuted, "&:hover": { color: ui.ink, backgroundColor: ui.hoverTint } },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: ui.inkMuted,
          borderRadius: ui.radius,
          transition: "background-color 120ms ease-out, color 120ms ease-out",
          "&:hover": { color: ui.ink, backgroundColor: ui.hoverTint },
          "&.Mui-disabled": { color: ui.inkFaint, opacity: 0.55 },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          letterSpacing: 0,
          fontWeight: 600,
          "&.Mui-selected": { color: ui.onGold, backgroundColor: ui.goldBright },
          "&.Mui-selected:hover": { backgroundColor: ui.goldHover },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: ui.line },
      },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { backgroundColor: "transparent", borderColor: ui.line, borderRadius: ui.radiusPanel } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: ui.surface,
          border: `1px solid ${ui.line}`,
          borderRadius: ui.radiusPanel,
          backgroundImage: "none",
          "&:focus-visible": panelTakesFocus,
        },
        // A dialog takes focus on its frame so the keyboard lands inside it;
        // the ring belongs on the controls, not around the whole panel.
        container: { "&:focus-visible": panelTakesFocus },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          ...displayHead(23),
        },
      },
    },
    MuiDialogContentText: {
      styleOverrides: { root: { color: ui.inkMuted } },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: ui.surface,
          border: `1px solid ${ui.line}`,
          borderRadius: ui.radiusPanel,
          "&:focus-visible": panelTakesFocus,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { backgroundColor: ui.surface, border: `1px solid ${ui.line}` },
        list: { padding: 4, "&:focus-visible": panelTakesFocus },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { borderRadius: ui.radius - 2, fontSize: 15, minHeight: 40 },
      },
    },
    MuiChip: {
      styleOverrides: {
        // Chips are small labels: the body face, as written, untracked.
        root: {
          borderRadius: 6,
          fontFamily: bodyFont,
          fontWeight: 600,
          textTransform: "none",
          letterSpacing: 0,
          border: `1px solid ${ui.line}`,
        },
        colorDefault: { backgroundColor: ui.surfaceRaised },
        outlined: { backgroundColor: "transparent", borderColor: ui.lineStrong, color: ui.inkMuted },
        colorPrimary: { borderColor: "transparent" },
        colorSecondary: { borderColor: "transparent" },
        sizeSmall: { height: 24, fontSize: 13 },
        label: { paddingInline: 10 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        // A field: the stage colour set into the surface, a 3:1 edge, and a
        // focus ring that never changes the border's width.
        root: {
          backgroundColor: controls.readout.background,
          borderRadius: controls.readout.borderRadius,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: ui.lineStrong, borderWidth: 1 },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: ui.inkMuted },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: ui.goldBright, borderWidth: 1 },
          // The ring: the gold edge plus one more pixel outside it, as a
          // shadow so it follows the corners and never changes the border.
          "&:focus-within": {
            boxShadow: `0 0 0 1px ${ui.focus}`,
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": { borderColor: ui.red },
          "&.Mui-disabled": { opacity: 0.55, cursor: "not-allowed" },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        // The field's outline carries the ring, not the bare input inside it.
        input: { "&:focus-visible": { outline: "none" } },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { color: ui.inkMuted, "&.Mui-focused": { color: ui.goldBright } } },
    },
    MuiFormLabel: {
      styleOverrides: { root: { color: ui.inkMuted, "&.Mui-focused": { color: ui.goldBright } } },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: bodyFont,
          fontWeight: 600,
          fontSize: 15,
          textTransform: "none",
          letterSpacing: 0,
          minHeight: 44,
          color: ui.inkMuted,
          "&.Mui-selected": { color: ui.ink },
        },
      },
    },
    MuiTabs: {
      styleOverrides: { indicator: { backgroundColor: ui.goldBright, height: 3 } },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        track: { borderRadius: 11, backgroundColor: ui.lineStrong, opacity: 1 },
        thumb: { boxShadow: "none" },
        switchBase: {
          "&.Mui-checked + .MuiSwitch-track": { backgroundColor: ui.goldBright, opacity: 1 },
          "&.Mui-checked .MuiSwitch-thumb": { color: ui.onGold },
          "&.Mui-focusVisible .MuiSwitch-thumb": focusRing,
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: { root: { color: ui.lineStrong } },
    },
    MuiSlider: {
      styleOverrides: {
        thumb: { boxShadow: "none", "&.Mui-focusVisible": { ...focusRing, boxShadow: "none" } },
        rail: { backgroundColor: ui.lineStrong, opacity: 1 },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: { label: { fontSize: 15 } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: ui.surfaceRaised,
          border: `1px solid ${ui.line}`,
          color: ui.ink,
          fontSize: 13,
          fontWeight: 500,
        },
        arrow: { color: ui.surfaceRaised },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: ui.radius, fontSize: 15 },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: ui.line } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, backgroundColor: ui.line },
        bar: { borderRadius: 999 },
      },
    },
  },
});
