"use client";

import { useId, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { primeAudio, primeSpeech } from "@/lib/ai";
import { ui } from "@/lib/foundation/jeopardy-style";
import { useRoomRole } from "./use-room-role";

const STORAGE_KEY = "jeopardy.onboarded.v1";

function readSeenOnce(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return true;
  }
}

interface StepCopy {
  title: string;
  body: string;
}

/**
 * The words change with who is reading them: a host can deal another board
 * and a guest can't, and a phone has a buzzer to tap rather than a Space bar.
 */
export function onboardingSteps(role: "host" | "guest", touch: boolean): StepCopy[] {
  const ringIn: StepCopy = {
    title: "Ring in",
    body: touch
      ? "Tap the buzzer the moment the lights come on, then type or speak your answer."
      : "Press Space the moment the lights come on, then type or speak your answer.",
  };
  if (role === "guest") {
    return [
      {
        title: "You're in the room",
        body: "The host deals the board and runs the game. Your lectern is under the board.",
      },
      {
        title: "Pick when it's your turn",
        body: "Whoever has control chooses a category and a value. Get one right and control is yours.",
      },
      ringIn,
    ];
  }
  return [
    {
      title: "Your board is dealt",
      body: "A real Jeopardy! board is already up. The shuffle key deals another, or build your own from More.",
    },
    {
      title: "Play alone or together",
      body: "Every board has a room code up top. Share it and friends join from their phones.",
    },
    ringIn,
  ];
}

export function Onboarding() {
  const [open, setOpen] = useState(() => !readSeenOnce());
  const titleId = useId();
  const touch = useMediaQuery("(pointer: coarse)");
  const { isRoomHost } = useRoomRole();

  function dismiss() {
    // The button is a tap, which is what a phone needs before it will play
    // the readout the guest is about to hear.
    primeAudio();
    primeSpeech();
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }

  const steps = onboardingSteps(isRoomHost ? "host" : "guest", touch);

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      aria-labelledby={titleId}
      maxWidth="xs"
      fullWidth
      scroll="body"
      slotProps={{
        paper: {
          sx: { background: ui.surface, border: `1px solid ${ui.line}`, borderRadius: 1 },
        },
      }}
    >
      <DialogContent sx={{ pb: 1 }}>
        <Typography variant="overline">Welcome</Typography>
        <Typography id={titleId} variant="h4" component="h2" sx={{ mt: 0.5, mb: 2, fontSize: 26 }}>
          Three steps and you&rsquo;re playing
        </Typography>
        <Stack spacing={1.25} component="ol" sx={{ m: 0, p: 0, listStyle: "none" }}>
          {steps.map((step, index) => (
            <Step key={step.title} num={index + 1} title={step.title} body={step.body} />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button variant="contained" onClick={dismiss} autoFocus>
          Let&rsquo;s play
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Step({ num, title, body }: { num: number; title: string; body: string }) {
  return (
    <Stack component="li" direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
      <Box
        aria-hidden="true"
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
