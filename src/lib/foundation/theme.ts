import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: {
      main: "#3b6cff",
      light: "#6b91ff",
      dark: "#1f3fbf",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#ffc34a",
      contrastText: "#0c1224",
    },
    success: {
      main: "#33d684",
    },
    error: {
      main: "#ff5a6e",
    },
    warning: {
      main: "#ffb648",
    },
    info: {
      main: "#5ad0ff",
    },
    background: {
      default: "#070a16",
      paper: "#0e1530",
    },
    text: {
      primary: "#f4f6fb",
      secondary: "#a4b0d3",
    },
    divider: "rgba(255,255,255,0.08)",
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    "none",
    "0 2px 6px rgba(0,0,0,0.4)",
    "0 4px 14px rgba(0,0,0,0.45)",
    "0 6px 18px rgba(0,0,0,0.5)",
    "0 8px 22px rgba(0,0,0,0.55)",
    "0 10px 26px rgba(0,0,0,0.55)",
    "0 12px 32px rgba(0,0,0,0.6)",
    "0 14px 36px rgba(0,0,0,0.6)",
    "0 16px 40px rgba(0,0,0,0.6)",
    "0 18px 44px rgba(0,0,0,0.6)",
    "0 20px 48px rgba(0,0,0,0.6)",
    "0 22px 52px rgba(0,0,0,0.6)",
    "0 24px 56px rgba(0,0,0,0.6)",
    "0 26px 60px rgba(0,0,0,0.6)",
    "0 28px 64px rgba(0,0,0,0.6)",
    "0 30px 68px rgba(0,0,0,0.6)",
    "0 32px 72px rgba(0,0,0,0.6)",
    "0 34px 76px rgba(0,0,0,0.6)",
    "0 36px 80px rgba(0,0,0,0.6)",
    "0 38px 84px rgba(0,0,0,0.6)",
    "0 40px 88px rgba(0,0,0,0.6)",
    "0 42px 92px rgba(0,0,0,0.6)",
    "0 44px 96px rgba(0,0,0,0.6)",
    "0 46px 100px rgba(0,0,0,0.6)",
    "0 48px 104px rgba(0,0,0,0.6)",
  ],
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontWeight: 800, letterSpacing: -1 },
    h2: { fontWeight: 800, letterSpacing: -0.5 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});
