"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/AddOutlined";
import DownloadIcon from "@mui/icons-material/DownloadOutlined";
import FolderIcon from "@mui/icons-material/FolderOpenOutlined";
import LinkIcon from "@mui/icons-material/AddLinkOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartIcon from "@mui/icons-material/RestartAltOutlined";
import ShareIcon from "@mui/icons-material/IosShareOutlined";
import UploadIcon from "@mui/icons-material/UploadFileOutlined";
import {
  builderLimits,
  categoriesForRound,
  emptyBuilderGame,
  type BoardRound,
  type GameDataIssue,
  type NormalizedGame,
} from "@/lib/data";
import { roundNames } from "@/lib/game";
import { primeAudio, primeSpeech } from "@/lib/ai";
import { useGameStore } from "@/lib/state/game-store";
import { BuilderErrorBoundary } from "./builder/BuilderErrorBoundary";
import { CategoryCard, limitHelper } from "./builder/CategoryCard";
import { IssueList } from "./builder/IssueSummary";
import { ShareLink } from "./builder/ShareLink";
import {
  issueFieldId,
  issueTab,
  useBuilderDraft,
  type BuilderDraft,
  type BuilderTab,
} from "./builder/use-builder-draft";
import { ConfirmDialog } from "./ConfirmDialog";
import { useRoomRole } from "./use-room-role";

interface CustomGameBuilderProps {
  open: boolean;
  onClose: () => void;
  /** Runs just before Play now deals, e.g. to leave a room the landing page left open. */
  onBeforeDeal?: () => void;
}

/**
 * Write a game: columns per round, a Final, and a link to share it.
 *
 * The draft saves itself as it's typed, so closing the dialog — by Close,
 * Escape or the back gesture — never loses work. A click outside is ignored:
 * it's the one close nobody means.
 */
export function CustomGameBuilder({ open, onClose, onBeforeDeal }: CustomGameBuilderProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const titleId = useId();
  const saveDraft = useGameStore((s) => s.saveBuilderDraft);
  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason === "backdropClick") return;
        onClose();
      }}
      maxWidth="lg"
      fullWidth
      fullScreen={fullScreen}
      aria-labelledby={titleId}
    >
      {open ? (
        <BuilderErrorBoundary onClose={onClose} onReset={() => saveDraft(emptyBuilderGame())}>
          <BuilderBody titleId={titleId} onClose={onClose} onBeforeDeal={onBeforeDeal} />
        </BuilderErrorBoundary>
      ) : null}
    </Dialog>
  );
}

/** One row of keys fits a 320px phone: the icons go, the words stay. */
const compactOnPhone = {
  whiteSpace: "nowrap",
  px: { xs: 1, sm: 2 },
  "& .MuiButton-startIcon": { display: { xs: "none", sm: "inherit" } },
} as const;

interface Pending {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  run: () => void;
}

function BuilderBody({
  titleId,
  onClose,
  onBeforeDeal,
}: {
  titleId: string;
  onClose: () => void;
  onBeforeDeal?: () => void;
}) {
  const builder = useBuilderDraft();
  const { draft, setDraft } = builder;
  const setCustomGame = useGameStore((s) => s.setCustomGame);
  const startGame = useGameStore((s) => s.startGame);
  const { isRoomHost, inGame } = useRoomRole();
  const [pending, setPending] = useState<Pending | null>(null);
  const [fileMenu, setFileMenu] = useState<HTMLElement | null>(null);
  const [publishedFresh, setPublishedFresh] = useState<"new" | "updated" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  function jump(issue: GameDataIssue) {
    const tab = issueTab(issue);
    if (tab) builder.setTab(tab);
    const id = issueFieldId(issue);
    if (!id) return;
    // The tab has to render before its field can take focus.
    window.setTimeout(() => {
      const element = document.getElementById(id);
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      element?.focus({ preventScroll: true });
    }, 60);
  }

  /** A failed try: show the list, and take the person to the first problem. */
  function showFailure() {
    contentRef.current?.scrollTo({ top: 0 });
    const first = builder.errors[0];
    if (first) jump(first);
  }

  function withWarnings(what: string, run: () => void) {
    if (builder.warnings.length === 0) return run();
    setPending({
      title: `${what} with gaps?`,
      body: (
        <Stack spacing={1}>
          <Typography variant="body2">
            {builder.progress.complete} of {builder.progress.total} clues written
            {builder.progress.hasFinal ? ", with a Final." : ", no Final."}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {builder.warnings.slice(0, 6).map((issue, index) => (
              <li key={index}>
                <Typography variant="body2">{issue.message}</Typography>
              </li>
            ))}
            {builder.warnings.length > 6 ? (
              <li>
                <Typography variant="body2">…and {builder.warnings.length - 6} more.</Typography>
              </li>
            ) : null}
          </Box>
        </Stack>
      ),
      confirmLabel: `${what} anyway`,
      run,
    });
  }

  function deal(game: NormalizedGame) {
    onBeforeDeal?.();
    setCustomGame(game, builder.warnings);
    startGame();
    onClose();
  }

  function playNow() {
    primeAudio();
    primeSpeech();
    const game = builder.build();
    if (!game) return showFailure();
    const go = () => {
      if (!inGame) return deal(game);
      setPending({
        title: "Replace the game in progress?",
        body: (
          <Typography variant="body2">
            The board in play is swapped for yours and every score goes back to zero, for
            everyone in the room.
          </Typography>
        ),
        confirmLabel: "Replace and play",
        destructive: true,
        run: () => deal(game),
      });
    };
    withWarnings("Play", go);
  }

  function publish(asNew = false) {
    const updating = builder.hasPublishedLink && !asNew;
    if (!builder.build()) return showFailure();
    withWarnings(updating ? "Update" : "Publish", () => {
      void builder.publish(asNew).then((ok) => {
        if (ok) {
          setPublishedFresh(updating ? "updated" : "new");
          contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });
  }

  const report = builder.importReport;
  const showErrors = builder.attempted && builder.errors.length > 0;

  return (
    <>
      <DialogTitle sx={{ pb: 1 }}>
        <span id={titleId}>Build a game</span>
        <Typography
          component="span"
          variant="caption"
          sx={{ display: "block", color: "text.secondary" }}
          aria-live="polite"
        >
          {builder.progress.complete} of {builder.progress.total} clues written ·{" "}
          {builder.progress.hasFinal ? "Final ready" : "no Final yet"}
          {builder.savedAt ? " · Draft saved in this browser" : ""}
        </Typography>
      </DialogTitle>
      <DialogContent dividers ref={contentRef}>
        <Stack spacing={2}>
          {builder.shareUrl && publishedFresh ? (
            <ShareLink url={builder.shareUrl} updated={publishedFresh === "updated"} />
          ) : null}
          {builder.publishError ? (
            <Alert severity="error" role="alert">
              {builder.publishError}
            </Alert>
          ) : null}
          {report ? (
            <IssueList
              severity={report.ok ? (report.issues.length ? "warning" : "success") : "error"}
              title={
                report.ok
                  ? report.issues.length
                    ? `Imported ${report.fileName}, with ${report.issues.length} ${report.issues.length === 1 ? "note" : "notes"}`
                    : `Imported ${report.fileName}`
                  : `Couldn't import ${report.fileName}`
              }
              issues={report.issues}
              onClose={builder.dismissImportReport}
              testId="import-report"
            />
          ) : null}
          {showErrors ? (
            <IssueList
              severity="error"
              title={`Fix ${builder.errors.length === 1 ? "this" : `these ${builder.errors.length}`} before playing or publishing`}
              issues={builder.errors}
              onJump={jump}
              testId="builder-errors"
            />
          ) : null}
          {builder.attempted && !showErrors && builder.warnings.length > 0 ? (
            <IssueList
              severity="info"
              title="Worth a look"
              issues={builder.warnings}
              onJump={jump}
            />
          ) : null}

          <TextField
            id="bf-title"
            label="Game title"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            fullWidth
            error={builder.fieldErrors.has("bf-title")}
            helperText={limitHelper(
              draft.title,
              builderLimits.title,
              builder.fieldErrors.get("bf-title"),
            )}
            slotProps={{ htmlInput: { maxLength: builderLimits.title } }}
          />

          <Tabs
            value={builder.tab}
            onChange={(_, value: BuilderTab) => builder.setTab(value)}
            variant="scrollable"
            allowScrollButtonsMobile
            aria-label="Rounds"
          >
            {builder.rounds.map((round) => (
              <Tab key={round} value={round} label={<RoundTabLabel builder={builder} round={round} />} />
            ))}
            <Tab value="final" label={builder.progress.hasFinal ? "Final ✓" : "Final"} />
          </Tabs>

          {builder.tab === "final" ? (
            <FinalCard builder={builder} />
          ) : (
            <RoundPanel builder={builder} round={builder.tab} />
          )}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          p: { xs: 1, sm: 2 },
          gap: 1,
          flexWrap: "nowrap",
          // Clear the home indicator on a phone.
          pb: { xs: "max(8px, env(safe-area-inset-bottom))", sm: 2 },
        }}
      >
        <Tooltip title="Import, export and start over">
          <Button
            startIcon={<FolderIcon />}
            onClick={(event) => setFileMenu(event.currentTarget)}
            aria-haspopup="menu"
            aria-label="File: import, export, start over"
            sx={{
              minWidth: 0,
              px: { xs: 1, sm: 1.5 },
              "& .label": { display: { xs: "none", sm: "inline" } },
              "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 }, ml: { xs: 0, sm: -0.5 } },
            }}
          >
            <span className="label">File</span>
          </Button>
        </Tooltip>
        <input
          ref={fileInput}
          hidden
          type="file"
          accept=".json,.csv,application/json,text/csv"
          data-testid="builder-import-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) builder.importFile(file);
            // Choosing the same file again should import it again.
            event.target.value = "";
          }}
        />
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} sx={{ minWidth: 0, px: { xs: 1, sm: 2 } }}>
          Close
        </Button>
        <Tooltip
          title={
            isRoomHost
              ? inGame
                ? "Ends the game in progress and deals this one"
                : "Deal this board now"
              : "Only the host can put a game on the board"
          }
        >
          <span>
            <Button
              onClick={playNow}
              disabled={!isRoomHost}
              startIcon={<PlayArrowIcon />}
              data-testid="play-custom-game"
              sx={compactOnPhone}
            >
              Play now
            </Button>
          </span>
        </Tooltip>
        <Button
          variant="contained"
          onClick={() => publish(false)}
          disabled={builder.publishing}
          data-testid="publish-game"
          startIcon={builder.publishing ? <CircularProgress size={16} /> : <ShareIcon />}
          sx={compactOnPhone}
        >
          {builder.publishing ? "Publishing…" : builder.hasPublishedLink ? "Update link" : "Publish"}
        </Button>
      </DialogActions>

      <Menu anchorEl={fileMenu} open={Boolean(fileMenu)} onClose={() => setFileMenu(null)}>
        <MenuItem
          onClick={() => {
            setFileMenu(null);
            fileInput.current?.click();
          }}
        >
          <ListItemIcon>
            <UploadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Import JSON or CSV…"
            secondary="CSV columns: round, category, value, clue, answer, dd"
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFileMenu(null);
            builder.exportJson();
          }}
        >
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Export as JSON" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFileMenu(null);
            builder.exportCsv();
          }}
        >
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Export as CSV" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFileMenu(null);
            builder.downloadTemplate();
          }}
        >
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Download a CSV template" />
        </MenuItem>
        <Divider />
        {builder.hasPublishedLink ? (
          <MenuItem
            onClick={() => {
              setFileMenu(null);
              publish(true);
            }}
          >
            <ListItemIcon>
              <LinkIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Publish as a new link"
              secondary="The old link keeps the old version"
            />
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={() => {
            setFileMenu(null);
            setPending({
              title: "Start over?",
              body: (
                <Typography variant="body2">
                  This clears every clue in the draft. Export it first if you might want it
                  back.
                </Typography>
              ),
              confirmLabel: "Clear the draft",
              destructive: true,
              run: () => {
                builder.resetDraft();
                setPublishedFresh(null);
              },
            });
          }}
        >
          <ListItemIcon>
            <RestartIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Start over" />
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={Boolean(builder.pendingImport)}
        title={`Replace your draft with ${builder.pendingImport?.fileName ?? "this file"}?`}
        confirmLabel="Replace draft"
        destructive
        onCancel={builder.cancelImport}
        onConfirm={() => {
          if (builder.pendingImport) builder.acceptImport(builder.pendingImport);
        }}
      >
        <Typography variant="body2">
          The clues you&rsquo;ve written will be replaced. Export them first to keep a copy.
        </Typography>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.title ?? ""}
        confirmLabel={pending?.confirmLabel ?? "OK"}
        cancelLabel="Keep editing"
        destructive={pending?.destructive}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const run = pending?.run;
          setPending(null);
          run?.();
        }}
      >
        {pending?.body}
      </ConfirmDialog>
    </>
  );
}

function RoundTabLabel({ builder, round }: { builder: BuilderDraft; round: BoardRound }) {
  const clues = builder.draft.clues.filter((clue) => clue.round === round);
  const complete = clues.filter((clue) => clue.clue.trim() && clue.correctResponse.trim()).length;
  const hasError = builder.attempted && builder.errors.some((issue) => issue.round === round);
  return (
    <span>
      {roundNames[round].plain}{" "}
      <Box component="span" sx={{ opacity: 0.7, fontSize: "0.85em" }}>
        {complete}/{clues.length}
      </Box>
      {hasError ? (
        <Box component="span" sx={{ color: "error.main", ml: 0.5 }} aria-label="has problems">
          •
        </Box>
      ) : null}
    </span>
  );
}

function RoundPanel({ builder, round }: { builder: BuilderDraft; round: BoardRound }) {
  const columns = categoriesForRound(builder.draft, round);
  const dailyDoubleNote =
    round === "jeopardy"
      ? "one Daily Double"
      : round === "double-jeopardy"
        ? "up to two Daily Doubles"
        : "up to three Daily Doubles";
  return (
    <Stack spacing={2} role="tabpanel" aria-label={roundNames[round].plain}>
      <Typography variant="body2" color="text.secondary">
        Write a clue and its answer in each cell. This round can hide {dailyDoubleNote}: the
        player who finds one wagers on it alone. Empty cells show as blanks.
      </Typography>
      {columns.map((category, index) => (
        <CategoryCard
          key={category.id}
          category={category}
          position={index + 1}
          round={round}
          clues={builder.draft.clues.filter(
            (clue) => clue.categoryId === category.id && clue.round === round,
          )}
          fieldErrors={builder.fieldErrors}
          canRemove={columns.length > 1}
          canAddRow={
            builder.draft.clues.filter(
              (clue) => clue.categoryId === category.id && clue.round === round,
            ).length < builderLimits.cluesPerCategory
          }
          onRename={(name) => builder.updateCategoryName(category.id, name)}
          onChange={builder.updateClue}
          onCommitValue={builder.commitValue}
          onAddRow={() => builder.addRow(category.id, round)}
          onRemoveRow={builder.removeRow}
          onRemove={() => builder.removeCategory(category.id, round)}
        />
      ))}
      {columns.length < builderLimits.categoriesPerRound ? (
        <Button
          startIcon={<AddIcon />}
          onClick={() => builder.addCategory(round)}
          sx={{ alignSelf: "flex-start" }}
        >
          Add category
        </Button>
      ) : null}
      {columns.length === 0 ? (
        <Typography variant="body2">No categories in this round yet.</Typography>
      ) : null}
    </Stack>
  );
}

function FinalCard({ builder }: { builder: BuilderDraft }) {
  const final = builder.draft.finalClue;
  const field = (key: "category" | "clue" | "correctResponse", label: string, limit: number) => {
    const id = `bf-final-${key}`;
    const value = final?.[key] ?? "";
    const error = builder.fieldErrors.get(id);
    return (
      <TextField
        id={id}
        size="small"
        label={label}
        value={value}
        multiline={key === "clue"}
        maxRows={4}
        error={Boolean(error)}
        helperText={limitHelper(value, limit, error)}
        onChange={(event) => builder.updateFinal({ [key]: event.target.value })}
        slotProps={{ htmlInput: { maxLength: limit } }}
      />
    );
  };
  return (
    <Card variant="outlined" role="tabpanel" aria-label="Final Jeopardy">
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          One last clue everyone wagers on. Leave all three empty to end after the last round.
        </Typography>
        <Stack spacing={1.5}>
          {field("category", "Final Jeopardy category", builderLimits.category)}
          {field("clue", "Final Jeopardy clue", builderLimits.clue)}
          {field("correctResponse", "Final Jeopardy answer", builderLimits.response)}
        </Stack>
      </CardContent>
    </Card>
  );
}

