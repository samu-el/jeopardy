"use client";

import { useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import ShareIcon from "@mui/icons-material/IosShareOutlined";

/**
 * The link a publish produced, said plainly: that it worked, what the link
 * is, and a button that copies it — or, when the clipboard says no, the text
 * selected so it can be copied by hand.
 */
export function ShareLink({ url, updated }: { url: string; updated: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function selectText() {
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      selectText();
      setStatus("Couldn't copy automatically. The link is selected: copy it by hand.");
    }
  }

  return (
    <Alert severity="success" data-testid="publish-result">
      <AlertTitle>{updated ? "Link updated" : "Published"}</AlertTitle>
      {updated
        ? "Everyone with the link now gets this version."
        : "Anyone with this link can play your game."}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
        <TextField
          size="small"
          fullWidth
          label="Share link"
          value={url}
          inputRef={inputRef}
          onFocus={selectText}
          slotProps={{ htmlInput: { readOnly: true, "data-testid": "game-link" } }}
        />
        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          onClick={copy}
          data-testid="copy-game-link"
          sx={{ flexShrink: 0 }}
        >
          Copy
        </Button>
        {canShare ? (
          <Button
            variant="outlined"
            startIcon={<ShareIcon />}
            onClick={() => navigator.share({ title: "Play my Jeopardy game", url }).catch(() => {})}
            sx={{ flexShrink: 0 }}
          >
            Share
          </Button>
        ) : null}
      </Stack>
      <span role="status" aria-live="polite">
        {status}
      </span>
    </Alert>
  );
}
