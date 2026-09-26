"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/AddOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLessOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMoreOutlined";
import {
  builderLimits,
  parseClueValue,
  type BoardRound,
  type BuilderCategory,
  type BuilderClue,
} from "@/lib/data";
import { roundNames } from "@/lib/game";

/** Counter under a field once it gets near its limit; errors take its place. */
export function limitHelper(value: string, limit: number, error?: string) {
  if (error) return error;
  return value.length > limit * 0.8 ? `${value.length}/${limit}` : undefined;
}

/**
 * One column: its name, then a row of fields per clue in board order.
 * Rows stay where they are while typed in; a changed value re-sorts the
 * column when the field is left.
 */
export function CategoryCard({
  category,
  position,
  round,
  clues,
  fieldErrors,
  canRemove,
  canAddRow,
  onRename,
  onChange,
  onCommitValue,
  onAddRow,
  onRemoveRow,
  onRemove,
}: {
  category: BuilderCategory;
  position: number;
  round: BoardRound;
  clues: BuilderClue[];
  fieldErrors: Map<string, string>;
  canRemove: boolean;
  canAddRow: boolean;
  onRename: (name: string) => void;
  onChange: (id: string, patch: Partial<BuilderClue>) => void;
  onCommitValue: (id: string, value: number) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const roundName = roundNames[round].plain;
  const name = category.name.trim();
  const spoken = name || `${roundName} category ${position}`;
  const complete = clues.filter((clue) => clue.clue.trim() && clue.correctResponse.trim()).length;
  const nameId = `bf-cat-${category.id}`;
  const nameError = fieldErrors.get(nameId);

  return (
    <Card variant="outlined" component="section" aria-label={`${roundName}: ${spoken}`}>
      <CardContent>
        <Stack
          direction="row"
          useFlexGap
          spacing={1}
          sx={{ alignItems: "flex-start", flexWrap: "wrap", mb: expanded ? 2 : 0 }}
        >
          <TextField
            id={nameId}
            size="small"
            label={`Category ${position} name`}
            value={category.name}
            onChange={(event) => onRename(event.target.value)}
            error={Boolean(nameError)}
            helperText={limitHelper(category.name, builderLimits.category, nameError)}
            slotProps={{ htmlInput: { maxLength: builderLimits.category } }}
            sx={{ flex: "1 1 200px" }}
          />
          <Chip
            label={`${complete}/${clues.length}`}
            size="small"
            color={complete === clues.length && clues.length > 0 ? "success" : "default"}
            variant="outlined"
            aria-label={`${complete} of ${clues.length} clues written`}
            sx={{ mt: 1 }}
          />
          <Tooltip title={expanded ? "Collapse" : "Expand"}>
            <IconButton
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-label={`${expanded ? "Collapse" : "Expand"} ${spoken}`}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
          {canRemove ? (
            <Tooltip title="Remove category">
              <IconButton onClick={onRemove} aria-label={`Remove ${spoken}`}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
        <Collapse in={expanded} unmountOnExit>
          <Stack spacing={1.5}>
            {clues.map((clue) => (
              <ClueRow
                key={clue.id}
                clue={clue}
                where={`${spoken} $${clue.value}`}
                fieldErrors={fieldErrors}
                onChange={onChange}
                onCommitValue={onCommitValue}
                onRemove={() => onRemoveRow(clue.id)}
              />
            ))}
            {canAddRow ? (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={onAddRow}
                sx={{ alignSelf: "flex-start" }}
              >
                Add clue
              </Button>
            ) : null}
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
}

function ClueRow({
  clue,
  where,
  fieldErrors,
  onChange,
  onCommitValue,
  onRemove,
}: {
  clue: BuilderClue;
  where: string;
  fieldErrors: Map<string, string>;
  onChange: (id: string, patch: Partial<BuilderClue>) => void;
  onCommitValue: (id: string, value: number) => void;
  onRemove: () => void;
}) {
  const clueId = `bf-${clue.id}-clue`;
  const answerId = `bf-${clue.id}-correctResponse`;
  const clueError = fieldErrors.get(clueId);
  const answerError = fieldErrors.get(answerId);
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: { xs: "1fr auto", md: "110px 1fr 1fr auto auto" },
        alignItems: "start",
      }}
    >
      <ValueField
        id={`bf-${clue.id}-value`}
        value={clue.value}
        label={`${where} value`}
        error={fieldErrors.get(`bf-${clue.id}-value`)}
        onCommit={(value) => onCommitValue(clue.id, value)}
      />
      <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "flex-end" }}>
        <RemoveRow where={where} onRemove={onRemove} />
      </Box>
      <TextField
        id={clueId}
        size="small"
        label="Clue"
        multiline
        maxRows={4}
        value={clue.clue}
        onChange={(event) => onChange(clue.id, { clue: event.target.value })}
        error={Boolean(clueError)}
        helperText={limitHelper(clue.clue, builderLimits.clue, clueError)}
        slotProps={{
          htmlInput: { maxLength: builderLimits.clue, "aria-label": `${where} clue` },
        }}
        sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}
      />
      <TextField
        id={answerId}
        size="small"
        label="Answer"
        value={clue.correctResponse}
        onChange={(event) => onChange(clue.id, { correctResponse: event.target.value })}
        error={Boolean(answerError)}
        helperText={limitHelper(clue.correctResponse, builderLimits.response, answerError)}
        slotProps={{
          htmlInput: { maxLength: builderLimits.response, "aria-label": `${where} answer` },
        }}
        sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}
      />
      <Tooltip title="A Daily Double lets the player who finds it wager on the clue.">
        <FormControlLabel
          sx={{ mr: 0, gridColumn: { xs: "1 / -1", md: "auto" } }}
          control={
            <Checkbox
              checked={clue.dailyDouble}
              onChange={(_, value) => onChange(clue.id, { dailyDouble: value })}
              slotProps={{ input: { "aria-label": `${where} is a Daily Double` } }}
            />
          }
          label="Daily Double"
        />
      </Tooltip>
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <RemoveRow where={where} onRemove={onRemove} />
      </Box>
    </Box>
  );
}

function RemoveRow({ where, onRemove }: { where: string; onRemove: () => void }) {
  return (
    <Tooltip title="Remove clue">
      <IconButton size="small" onClick={onRemove} aria-label={`Remove ${where}`}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

/**
 * A dollar field that holds what's typed until it's left. Parsing on every
 * keystroke turned a cleared field into 0 and "1500" into "01500".
 */
function ValueField({
  id,
  value,
  label,
  error,
  onCommit,
}: {
  id: string;
  value: number;
  label: string;
  error?: string;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? String(value);
  const invalid = text !== null && text.trim() !== "" && parseClueValue(text) === undefined;
  return (
    <TextField
      id={id}
      size="small"
      label="Value"
      value={shown}
      error={invalid || Boolean(error)}
      helperText={invalid ? "Whole dollars" : error}
      onFocus={() => setText(String(value))}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const parsed = text === null ? undefined : parseClueValue(text);
        if (parsed !== undefined && parsed !== value) onCommit(parsed);
        setText(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
      slotProps={{
        input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
        htmlInput: { inputMode: "numeric", "aria-label": label, maxLength: 7 },
      }}
    />
  );
}
