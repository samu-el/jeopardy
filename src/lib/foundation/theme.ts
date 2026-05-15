import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: {
      main: "#1e63ff",
    },
    secondary: {
      main: "#f8c14a",
    },
    success: {
      main: "#35c784",
    },
    error: {
      main: "#ff5a66",
    },
    background: {
      default: "#080b12",
      paper: "#101624",
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },
});
