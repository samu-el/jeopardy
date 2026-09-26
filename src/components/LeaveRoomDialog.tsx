"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useGameStore } from "@/lib/state/game-store";
import { selectCanHost } from "@/lib/state/selectors";

/** "Leave this game?" — asked before Home walks out of a game in progress. */
export function LeaveRoomDialog() {
  const open = useGameStore((s) => s.leaveConfirmOpen);
  const online = useGameStore((s) => s.online);
  const canHost = useGameStore(selectCanHost);
  const confirm = useGameStore((s) => s.confirmGoHome);
  const cancel = useGameStore((s) => s.cancelGoHome);

  const detail = !online
    ? "This game only lives in this tab. Leaving ends it."
    : canHost
      ? "You're hosting. Someone else in the room will take the chair, and your seat is given up."
      : "Your seat and score are given up. You can rejoin with the room code.";

  return (
    <Dialog
      open={open}
      onClose={cancel}
      aria-labelledby="leave-room-title"
      aria-describedby="leave-room-detail"
    >
      <DialogTitle id="leave-room-title">Leave this game?</DialogTitle>
      <DialogContent>
        <DialogContentText id="leave-room-detail">{detail}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={cancel} autoFocus>
          Stay
        </Button>
        <Button onClick={confirm} color="error" data-testid="confirm-leave">
          Leave
        </Button>
      </DialogActions>
    </Dialog>
  );
}
