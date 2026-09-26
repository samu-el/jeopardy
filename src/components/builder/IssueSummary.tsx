"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import type { GameDataIssue } from "@/lib/data";

const collapsedCount = 5;

/**
 * Problems listed where they'll be seen — at the top, not 2,800 pixels down —
 * each one a link to the field it's about.
 */
export function IssueList({
  issues,
  severity,
  title,
  onJump,
  onClose,
  testId,
}: {
  issues: GameDataIssue[];
  severity: "error" | "warning" | "info" | "success";
  title: string;
  onJump?: (issue: GameDataIssue) => void;
  onClose?: () => void;
  testId?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? issues : issues.slice(0, collapsedCount);
  return (
    <Alert
      severity={severity}
      onClose={onClose}
      data-testid={testId}
      role={severity === "error" ? "alert" : "status"}
    >
      <AlertTitle>{title}</AlertTitle>
      {issues.length > 0 ? (
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {shown.map((issue, index) => (
            <li key={`${issue.code}-${issue.clueId ?? issue.categoryId ?? ""}-${index}`}>
              {onJump && (issue.clueId || issue.categoryId || issue.field) ? (
                <Link
                  component="button"
                  type="button"
                  color="inherit"
                  onClick={() => onJump(issue)}
                  sx={{ textAlign: "left", verticalAlign: "baseline" }}
                >
                  {issue.message}
                </Link>
              ) : (
                issue.message
              )}
            </li>
          ))}
        </Box>
      ) : null}
      {issues.length > collapsedCount ? (
        <Button size="small" color="inherit" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Show fewer" : `Show all ${issues.length}`}
        </Button>
      ) : null}
    </Alert>
  );
}
