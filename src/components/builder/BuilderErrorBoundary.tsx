"use client";

import { Component, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

/**
 * The last line of defence: a draft the builder can't render takes down the
 * builder, not the page and the game running behind it.
 */
export class BuilderErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void; onReset: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <>
        <DialogTitle>Build a game</DialogTitle>
        <DialogContent dividers>
          <Alert severity="error" role="alert">
            The builder hit a problem with this draft. Starting over clears it; closing keeps it
            for later.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.props.onClose}>Close</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              this.props.onReset();
              this.setState({ failed: false });
            }}
          >
            Start over
          </Button>
        </DialogActions>
      </>
    );
  }
}
