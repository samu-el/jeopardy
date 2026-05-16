"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SendIcon from "@mui/icons-material/SendOutlined";
import { useGameStore } from "@/lib/state/game-store";

export function Chat() {
  const chat = useGameStore((s) => s.chat);
  const runtime = useGameStore((s) => s.runtime);
  const lobby = useGameStore((s) => s.lobby);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chat]);

  function send() {
    const text = draft.trim();
    if (!text || !runtime) return;
    runtime.postChat(lobby.hostId, lobby.hostName, text);
    setDraft("");
  }

  return (
    <Paper variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle2">Game log & chat</Typography>
      </Box>
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          minHeight: 0,
        }}
      >
        {chat.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            No messages yet. Events will appear here as you play.
          </Typography>
        ) : (
          chat.map((message) => (
            <Stack
              key={message.id}
              direction="row"
              spacing={1}
              sx={{ alignItems: "baseline", fontSize: 13 }}
            >
              <Typography
                component="span"
                color={kindColor(message.kind)}
                sx={{ flexShrink: 0, fontSize: 12, fontWeight: 700 }}
              >
                {message.authorName ?? labelForKind(message.kind)}
              </Typography>
              <Typography component="span" sx={{ wordBreak: "break-word" }}>
                {message.text}
              </Typography>
            </Stack>
          ))
        )}
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ p: 1, borderTop: "1px solid", borderColor: "divider" }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Send a message…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              send();
            }
          }}
        />
        <IconButton color="primary" onClick={send} disabled={!draft.trim()}>
          <SendIcon />
        </IconButton>
      </Stack>
    </Paper>
  );
}

function labelForKind(kind: string) {
  switch (kind) {
    case "system":
      return "system";
    case "host":
      return "host";
    case "judge":
      return "judge";
    default:
      return "?";
  }
}

function kindColor(kind: string) {
  switch (kind) {
    case "system":
      return "info.main";
    case "host":
      return "secondary.main";
    case "judge":
      return "warning.main";
    default:
      return "primary.light";
  }
}
