"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { useGameStore } from "@/lib/state/game-store";
import { ui } from "@/lib/foundation/jeopardy-style";
import { Chat } from "./Chat";
import { ConnectionBanner } from "./ConnectionBanner";
import { ResultsView } from "./ResultsView";
import { AvatarHostController } from "./AvatarHostController";
import { GameSurface } from "./GameSurface";
import { RoomToolbar } from "./RoomToolbar";
import { CustomGameBuilder } from "./CustomGameBuilder";
import { GamePicker } from "./GamePicker";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { Onboarding } from "./Onboarding";
import { TranscriptPane } from "./TranscriptPane";
import { ReplayView } from "./ReplayView";
import { RoomNotices } from "./RoomNotices";
import { LeaveRoomDialog } from "./LeaveRoomDialog";

export function Room() {
  const publicState = useGameStore((s) => s.publicState);
  const online = useGameStore((s) => s.online);
  const exitToLobby = useGameStore((s) => s.exitToLobby);
  const chatEnabled = useGameStore((s) => s.preferences.chatEnabled);
  const shortcutsEnabled = useGameStore(
    (s) => s.preferences.shortcutsEnabled !== false,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);

  useEffect(() => {
    if (!shortcutsEnabled) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (target?.isContentEditable) return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutsEnabled]);

  const showResults = publicState?.round === "complete";

  const toolbar = (
    <RoomToolbar
      onOpenPicker={() => setPickerOpen(true)}
      onOpenBuilder={() => setBuilderOpen(true)}
      onToggleShortcuts={() => setShortcutsOpen((value) => !value)}
      onToggleTranscript={() => setTranscriptOpen((value) => !value)}
      onOpenReplay={() => setReplayOpen(true)}
    />
  );

  // Mounted on both screens: the More menu offers them on the results
  // screen too, where "Replay last game" matters most.
  const dialogs = (
    <>
      <GamePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      <CustomGameBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <TranscriptPane open={transcriptOpen} onClose={() => setTranscriptOpen(false)} />
      <ReplayView open={replayOpen} onClose={() => setReplayOpen(false)} />
      <RoomNotices />
      <LeaveRoomDialog />
    </>
  );

  if (showResults && publicState) {
    return (
      <Box sx={{ minHeight: "100vh", background: ui.stage }}>
        <ConnectionBanner />
        <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, md: 3 } }}>
          {toolbar}
          {/* "Again" re-deals for the whole room, so it is the host's call;
              the store refuses it for anyone else. */}
          <ResultsView state={publicState} onPlayAgain={exitToLobby} />
        </Box>
        {dialogs}
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", background: ui.stage, overflowX: "hidden" }}>
      <ConnectionBanner />
      <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 1.5, md: 3 } }}>
        {toolbar}

        <AvatarHostController />

        <GameSurface />

        {chatEnabled && (publicState || online) ? (
          <Box sx={{ mt: 2 }}>
            <Chat />
          </Box>
        ) : null}
      </Box>

      {dialogs}
      <Onboarding />
    </Box>
  );
}
