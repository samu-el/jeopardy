"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/DownloadOutlined";
import UploadIcon from "@mui/icons-material/UploadFileOutlined";
import ShareIcon from "@mui/icons-material/IosShareOutlined";
import { roundNames, type PlayableRound } from "@/lib/game";
import { CategoryCard } from "./builder/CategoryCard";
import { useBuilderDraft } from "./builder/use-builder-draft";

interface CustomGameBuilderProps {
  open: boolean;
  onClose: () => void;
}

const buildableRounds: PlayableRound[] = ["jeopardy", "double-jeopardy"];

/** Write a game: six categories, two rounds, a Final, and a link to share it. */
export function CustomGameBuilder({ open, onClose }: CustomGameBuilderProps) {
  const builder = useBuilderDraft(onClose);
  const { draft, setDraft } = builder;
  const [copied, setCopied] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Builder</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Title"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            fullWidth
          />

          <Card variant="outlined">
            <CardContent>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
                }}
              >
                {draft.categories.map((cat, index) => (
                  <TextField
                    key={cat.id}
                    size="small"
                    placeholder={`Cat ${index + 1}`}
                    value={cat.name}
                    onChange={(event) =>
                      builder.updateCategoryName(cat.id, event.target.value)
                    }
                  />
                ))}
              </Box>
            </CardContent>
          </Card>

          <Tabs
            value={builder.round}
            onChange={(_, value) => builder.setRound(value)}
            variant="scrollable"
          >
            {buildableRounds.map((round) => (
              <Tab key={round} value={round} label={roundNames[round].plain} />
            ))}
          </Tabs>

          <Stack spacing={2}>
            {draft.categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                name={cat.name}
                clues={builder.cluesByCategory.get(cat.id) ?? []}
                onChange={builder.updateClue}
              />
            ))}
          </Stack>

          <Divider />

          <Card variant="outlined">
            <CardContent>
              <Chip label="Final" sx={{ mb: 1 }} color="error" variant="outlined" />
              <Stack spacing={1}>
                <TextField
                  size="small"
                  label="Category"
                  value={draft.finalClue?.category ?? ""}
                  onChange={(event) => builder.updateFinal({ category: event.target.value })}
                />
                <TextField
                  size="small"
                  label="Clue"
                  value={draft.finalClue?.clue ?? ""}
                  onChange={(event) => builder.updateFinal({ clue: event.target.value })}
                />
                <TextField
                  size="small"
                  label="Answer"
                  value={draft.finalClue?.correctResponse ?? ""}
                  onChange={(event) =>
                    builder.updateFinal({ correctResponse: event.target.value })
                  }
                />
              </Stack>
            </CardContent>
          </Card>

          {builder.error ? <Typography color="error">{builder.error}</Typography> : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1, flexWrap: "wrap" }}>
        <IconButton component="label" aria-label="Import JSON" title="Import JSON">
          <UploadIcon />
          <input
            hidden
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) builder.importJson(file);
            }}
          />
        </IconButton>
        <IconButton aria-label="Export JSON" onClick={builder.exportJson} title="Export JSON">
          <DownloadIcon />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        {builder.shareUrl ? (
          <Button
            size="small"
            data-testid="copy-game-link"
            onClick={() => {
              navigator.clipboard
                ?.writeText(builder.shareUrl!)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1_800);
                })
                .catch(() => {});
            }}
            sx={{ textTransform: "none" }}
          >
            {copied ? "Link copied" : builder.shareUrl.replace(/^https?:\/\//, "")}
          </Button>
        ) : null}
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={builder.commit}>Save</Button>
        <Button
          variant="contained"
          onClick={builder.publish}
          disabled={builder.publishing}
          data-testid="publish-game"
          startIcon={builder.publishing ? <CircularProgress size={16} /> : <ShareIcon />}
        >
          {builder.publishing ? "Publishing…" : "Publish & share"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
