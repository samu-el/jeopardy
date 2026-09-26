"use client";

import { useId, type ReactNode } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

/**
 * One yes-or-no question before something that can't be taken back: ending
 * a game in progress, replacing a draft, starting over.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      aria-labelledby={titleId}
      aria-describedby={children ? bodyId : undefined}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      {children ? <DialogContent id={bodyId}>{children}</DialogContent> : null}
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onCancel} autoFocus>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={destructive ? "error" : "primary"}
          onClick={onConfirm}
          data-testid="confirm-action"
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
