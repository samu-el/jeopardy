"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { loadLastReplay, type ReplayEntry, type ReplayLog } from "@/lib/runtime";

interface ReplayViewProps {
  open: boolean;
  onClose: () => void;
}

export function ReplayView({ open, onClose }: ReplayViewProps) {
  const [cursor, setCursor] = useState(0);
  const log = useMemo<ReplayLog | null>(() => (open ? loadLastReplay() : null), [open]);
  const entries: ReplayEntry[] = log?.entries ?? [];
  const visible = entries.slice(0, cursor);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Replay last game</DialogTitle>
      <DialogContent dividers>
        {!log ? (
          <Typography variant="body2" color="text.secondary">
            No completed game in storage yet.
          </Typography>
        ) : (
          <Stack spacing={2}>
            <Typography variant="caption" color="text.secondary">
              {entries.length} events · started{" "}
              {new Date(log.startedAt).toLocaleString()}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={entries.length === 0 ? 0 : (cursor / entries.length) * 100}
            />
            <Box
              sx={{
                maxHeight: 320,
                overflowY: "auto",
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                background: "rgba(255,255,255,0.03)",
                p: 1.5,
                borderRadius: 1,
              }}
            >
              {visible.map((entry, index) => (
                <Box key={index} sx={{ mb: 0.5 }}>
                  <Typography
                    component="span"
                    sx={{ color: "rgba(255,255,255,0.4)", mr: 1, fontSize: 11 }}
                  >
                    {new Date(entry.t).toLocaleTimeString()}
                  </Typography>
                  {entry.cmd ? (
                    <Typography component="span" sx={{ color: "#5b8cff" }}>
                      cmd: {entry.cmd.type}
                    </Typography>
                  ) : entry.events ? (
                    <Typography component="span" sx={{ color: "#ffd23b" }}>
                      {entry.events.map((event) => event.type).join(", ")}
                    </Typography>
                  ) : null}
                </Box>
              ))}
              {visible.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Press Play to step through events.
                </Typography>
              ) : null}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {log ? (
          <>
            <Button onClick={() => setCursor(0)}>Reset</Button>
            <Button onClick={() => setCursor((c) => Math.max(0, c - 1))}>Back</Button>
            <Button
              onClick={() => setCursor((c) => Math.min(entries.length, c + 1))}
            >
              Step
            </Button>
            <Button
              variant="contained"
              onClick={() => setCursor(entries.length)}
            >
              Play to end
            </Button>
          </>
        ) : null}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
