"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ui } from "@/lib/foundation/jeopardy-style";

const STORAGE_KEY = "jeopardy.onboarded.v1";

function readSeenOnce(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return true;
  }
}

export function Onboarding() {
  const [open, setOpen] = useState(() => !readSeenOnce());

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }

  if (!open) return null;

  return (
    <Box
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(0,0,0,0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // A short phone in landscape can't fit the card; let it scroll rather
        // than trapping the dismiss button off-screen.
        overflowY: "auto",
        p: 2,
      }}
    >
      <Box
        onClick={(event) => event.stopPropagation()}
        sx={{
          maxWidth: 420,
          background: ui.surface,
          border: `1px solid ${ui.line}`,
          borderRadius: 1,
          p: 3,
          my: "auto",
        }}
      >
        <Typography variant="overline">Welcome</Typography>
        <Typography variant="h4" sx={{ mt: 0.5, mb: 2, fontSize: 26 }}>
          Three steps and you&rsquo;re playing
        </Typography>
        <Stack spacing={1.25} sx={{ mb: 3 }}>
          <Step
            num={1}
            title="Your board is dealt"
            body="A real Jeopardy! board is already up. The shuffle icon deals another."
          />
          <Step
            num={2}
            title="Play alone or together"
            body="Every board has a room code up top. Reveal it, share it, and they are in."
          />
          <Step
            num={3}
            title="Ring in"
            body="Press Space the moment the lights come on, then type or speak your answer."
          />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <Button variant="contained" onClick={dismiss}>
            Let&rsquo;s play
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

function Step({ num, title, body }: { num: number; title: string; body: string }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
      <Box
        sx={{
          width: 22,
          height: 22,
          flex: "0 0 22px",
          borderRadius: "50%",
          background: ui.gold,
          color: "#1A1200",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 12,
        }}
      >
        {num}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        <Typography variant="body2">{body}</Typography>
      </Box>
    </Stack>
  );
}
