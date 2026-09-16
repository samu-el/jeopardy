"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { BuilderClue } from "@/lib/data";

/** A row of fields per clue, cheapest at the top, the way a column is built. */
export function CategoryCard({
  name,
  clues,
  onChange,
}: {
  name: string;
  clues: BuilderClue[];
  onChange: (id: string, patch: Partial<BuilderClue>) => void;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <Chip label={name || "Untitled"} color="primary" variant="outlined" />
        </Stack>
        <Stack spacing={1.5}>
          {[...clues]
            .sort((a, b) => a.value - b.value)
            .map((clue) => (
              <Box
                key={clue.id}
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: { xs: "1fr", md: "100px 1fr 1fr auto" },
                  alignItems: "center",
                }}
              >
                <TextField
                  size="small"
                  type="number"
                  label="$"
                  value={clue.value}
                  onChange={(event) =>
                    onChange(clue.id, { value: Number(event.target.value) || 0 })
                  }
                />
                <TextField
                  size="small"
                  label="Clue"
                  value={clue.clue}
                  onChange={(event) => onChange(clue.id, { clue: event.target.value })}
                />
                <TextField
                  size="small"
                  label="Answer"
                  value={clue.correctResponse}
                  onChange={(event) =>
                    onChange(clue.id, { correctResponse: event.target.value })
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={clue.dailyDouble}
                      onChange={(_, value) => onChange(clue.id, { dailyDouble: value })}
                    />
                  }
                  label="DD"
                />
              </Box>
            ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
