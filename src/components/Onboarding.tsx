"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

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
        p: 2,
      }}
    >
      <Box
        onClick={(event) => event.stopPropagation()}
        sx={{
          maxWidth: 420,
          background: "linear-gradient(180deg, #0e1530, #050a26)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 2,
          p: 3,
        }}
      >
        <Typography
          variant="overline"
          sx={{ color: "#5b8cff", letterSpacing: 2 }}
        >
          Welcome
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, mb: 2 }}>
          Three steps and you&rsquo;re playing
        </Typography>
        <Stack spacing={1.25} sx={{ mb: 3 }}>
          <Step
            num={1}
            title="Open the picker"
            body="Use the shuffle icon up top to load a real Jeopardy! board."
          />
          <Step
            num={2}
            title="Begin"
            body="Hit Begin to deal the board. Solo by default; add bots from Players."
          />
          <Step
            num={3}
            title="BUZZ in"
            body="Press Space when the bar fills, type or speak your answer, win the round."
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
          background: "#5b8cff",
          color: "#000",
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
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)" }}>
          {body}
        </Typography>
      </Box>
    </Stack>
  );
}
