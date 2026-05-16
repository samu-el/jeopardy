"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import { useGameStore } from "@/lib/state/game-store";

interface TranscriptPaneProps {
  open: boolean;
  onClose: () => void;
}

export function TranscriptPane({ open, onClose }: TranscriptPaneProps) {
  const chat = useGameStore((s) => s.chat);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [chat, open]);

  if (!open) return null;

  return (
    <Paper
      role="region"
      aria-label="Game transcript"
      variant="outlined"
      sx={{
        position: "fixed",
        right: 16,
        top: 80,
        bottom: 16,
        width: { xs: "92vw", sm: 360 },
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
        background: "rgba(8,11,26,0.96)",
      }}
    >
      <Stack
        direction="row"
        sx={{
          p: 1.5,
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Typography variant="overline" sx={{ color: "text.secondary" }}>
          Transcript
        </Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} aria-label="Close transcript">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box
        ref={ref}
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {chat.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            —
          </Typography>
        ) : (
          chat.map((message) => (
            <Box key={message.id} sx={{ fontSize: 13 }}>
              <Typography
                component="span"
                sx={{
                  fontSize: 10,
                  letterSpacing: 1,
                  color: kindColor(message.kind),
                  mr: 1,
                  textTransform: "uppercase",
                }}
              >
                {message.kind}
              </Typography>
              <Typography component="span" sx={{ color: "rgba(255,255,255,0.85)" }}>
                {message.text}
              </Typography>
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );
}

function kindColor(kind: string): string {
  switch (kind) {
    case "system":
      return "#5ad0ff";
    case "host":
      return "#ffd23b";
    case "judge":
      return "#ffb648";
    default:
      return "#5b8cff";
  }
}
