import { createTheme } from "@mui/material/styles";
import { controls, jeopardyFonts, ui } from "./jeopardy-style";

/**
 * The MUI theme is a thin wrapper over the tokens in `jeopardy-style.ts`:
 * every colour here is one of those, so a MUI component and a hand-drawn
 * one end up the same colour without either knowing about the other.
 *
 * Type: the show's condensed face for anything that labels or commands —
 * headings, buttons, eyebrows, numbers — and a plain sans for reading.
 */
const bodyFont =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const appTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: {
      main: ui.blue,
      dark: ui.blueDeep,
      light: "#7B87FF",
      contrastText: ui.ink,
    },
    secondary: {
      main: ui.gold,
      dark: ui.goldDeep,
      contrastText: "#1A1200",
    },
    success: { main: ui.green, contrastText: "#03170C" },
    error: { main: ui.red, contrastText: ui.ink },
    warning: { main: ui.gold, contrastText: "#1A1200" },
    info: { main: ui.blue, contrastText: ui.ink },
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
      hover: "rgba(255,255,255,0.06)",
      selected: ui.blueTint,
      disabledBackground: "rgba(255,255,255,0.08)",
      disabled: ui.inkFaint,
    },
  },
  shape: {
    borderRadius: ui.radius,
  },
  typography: {
    fontFamily: bodyFont,
    h1: { fontFamily: jeopardyFonts.display, fontWeight: 700, textTransform: "uppercase" },
    h2: { fontFamily: jeopardyFonts.display, fontWeight: 700, textTransform: "uppercase" },
    h3: { fontFamily: jeopardyFonts.display, fontWeight: 700, textTransform: "uppercase" },
    h4: { fontFamily: jeopardyFonts.display, fontWeight: 600, textTransform: "uppercase" },
    h5: {
      fontFamily: jeopardyFonts.display,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.02em",
    },
    h6: {
      fontFamily: jeopardyFonts.display,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    },
    // The eyebrow over a panel: small, spaced, gold.
    overline: {
      fontFamily: jeopardyFonts.display,
      fontWeight: 600,
      fontSize: 11,
      letterSpacing: "0.22em",
      lineHeight: 1.6,
      color: ui.gold,
    },
    button: {
      fontFamily: jeopardyFonts.display,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      fontSize: 14,
    },
    body2: { color: ui.inkMuted },
    caption: { color: ui.inkFaint },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: ui.stage },
        "::selection": { background: ui.blueTint },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: ui.radius,
          paddingInline: 16,
          minHeight: 38,
        },
        sizeSmall: { minHeight: 30, fontSize: 12, paddingInline: 12 },
        sizeLarge: { minHeight: 48, fontSize: 16, paddingInline: 24 },
        // Every filled button is a key: a lit top edge and a dark underside.
        contained: {
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 0 rgba(0,0,0,0.6)",
          "&:hover": { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.34), 0 1px 0 rgba(0,0,0,0.6)" },
          "&:active": { transform: "translateY(1px)" },
        },
        outlined: controls.key,
        text: { color: ui.inkMuted, "&:hover": { color: ui.ink } },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: ui.inkMuted,
          borderRadius: ui.radius,
          "&:hover": { color: ui.ink, backgroundColor: "rgba(255,255,255,0.06)" },
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
      styleOverrides: { root: { backgroundColor: "transparent", borderColor: ui.line } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: ui.surface,
          border: `1px solid ${ui.line}`,
          backgroundImage: "none",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: jeopardyFonts.display,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontSize: 18,
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: { backgroundColor: ui.surface, border: `1px solid ${ui.line}` },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { backgroundColor: ui.surface, border: `1px solid ${ui.line}` },
        list: { padding: 4 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { borderRadius: ui.radius - 2, fontSize: 14, minHeight: 36 },
      },
    },
    MuiChip: {
      styleOverrides: {
        // Chips are small keys: the set's face, tracked, on the housing colour.
        root: {
          borderRadius: 6,
          fontFamily: jeopardyFonts.display,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          backgroundColor: ui.surfaceRaised,
          border: `1px solid ${ui.line}`,
        },
        outlined: { backgroundColor: "transparent", borderColor: ui.lineStrong, color: ui.inkMuted },
        colorPrimary: { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24)", borderColor: "transparent" },
        colorSecondary: { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)", borderColor: "transparent" },
        sizeSmall: { height: 24, fontSize: 11 },
        label: { paddingInline: 10 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        // A field is a readout you can type into: the same black glass as a
        // lectern's score display, set into the surface.
        root: {
          backgroundColor: controls.readout.background,
          boxShadow: controls.readout.boxShadow,
          borderRadius: controls.readout.borderRadius,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: ui.lineStrong },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: ui.inkMuted },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: ui.blue,
            boxShadow: `0 0 0 3px ${ui.blueTint}`,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { color: ui.inkMuted } },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: jeopardyFonts.display,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          minHeight: 44,
        },
      },
    },
    MuiTabs: {
      styleOverrides: { indicator: { backgroundColor: ui.gold, height: 3 } },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        track: { borderRadius: 11, backgroundColor: "rgba(255,255,255,0.18)", opacity: 1 },
        thumb: { boxShadow: "none" },
        switchBase: {
          "&.Mui-checked + .MuiSwitch-track": { backgroundColor: ui.blue, opacity: 1 },
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: { label: { fontSize: 14 } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: ui.surfaceRaised,
          border: `1px solid ${ui.line}`,
          color: ui.ink,
          fontSize: 12,
          fontWeight: 500,
        },
        arrow: { color: ui.surfaceRaised },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: ui.line } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
        bar: { borderRadius: 999 },
      },
    },
  },
});
