"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { useGameStore } from "@/lib/state/game-store";
import { Chat } from "./Chat";
import { ConnectionBanner } from "./ConnectionBanner";
import { ResultsView } from "./ResultsView";
import { AvatarHostController } from "./AvatarHostController";
import { GameSurface } from "./GameSurface";
import { RoomToolbar } from "./RoomToolbar";
import { CustomGameBuilder } from "./CustomGameBuilder";
import { EpisodeBrowser } from "./EpisodeBrowser";
import { GamePicker } from "./GamePicker";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { Onboarding } from "./Onboarding";
import { TranscriptPane } from "./TranscriptPane";
import { ReplayView } from "./ReplayView";

export function Room() {
  const publicState = useGameStore((s) => s.publicState);
  const online = useGameStore((s) => s.online);
  const exitToLobby = useGameStore((s) => s.exitToLobby);
  const chatEnabled = useGameStore((s) => s.preferences.chatEnabled);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showResults = publicState?.round === "complete";

  const toolbar = (
    <RoomToolbar
      onOpenPicker={() => setPickerOpen(true)}
      onOpenBrowser={() => setBrowserOpen(true)}
      onOpenBuilder={() => setBuilderOpen(true)}
      onToggleShortcuts={() => setShortcutsOpen((value) => !value)}
      onToggleTranscript={() => setTranscriptOpen((value) => !value)}
      onOpenReplay={() => setReplayOpen(true)}
    />
  );

  if (showResults && publicState) {
    return (
      <Box sx={{ minHeight: "100vh", background: "#000" }}>
        <ConnectionBanner />
        <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, md: 3 } }}>
          {toolbar}
          <ResultsView state={publicState} onPlayAgain={exitToLobby} onExit={exitToLobby} />
        </Box>
        <GamePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
        <EpisodeBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "#000", overflowX: "hidden" }}>
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

      <GamePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      <EpisodeBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
      <CustomGameBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <TranscriptPane open={transcriptOpen} onClose={() => setTranscriptOpen(false)} />
      <ReplayView open={replayOpen} onClose={() => setReplayOpen(false)} />
      <Onboarding />
    </Box>
  );
}

/** Local avatar choices, used for seats the room state doesn't carry yet. */
