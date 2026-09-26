"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import { useGameStore } from "@/lib/state/game-store";
import { usePersistedLobby } from "@/lib/state/use-persisted-lobby";
import { openSharedGame } from "@/lib/state/shared-game-link";
import { ui } from "@/lib/foundation/jeopardy-style";
import { reducedMotionAttribute } from "@/lib/foundation/motion";
import { appViewport } from "@/lib/foundation/viewport";
import { Landing } from "./Landing";
import { useWakeLock } from "./use-wake-lock";

/**
 * The first screen is Landing; the room and the television view are only
 * needed once a game is dealt or a `?display=1` link is opened, so they are
 * split out of the first-load bundle. The room chunk is fetched in the
 * background once the landing page is idle, so dealing a game does not wait
 * on the network.
 */
const loadRoom = () => import("./Room").then((m) => m.Room);
const Room = dynamic(loadRoom, { ssr: false, loading: () => <ShellPlaceholder /> });
const DisplayView = dynamic(() => import("./DisplayView").then((m) => m.DisplayView), {
  ssr: false,
  loading: () => <ShellPlaceholder />,
});

function ShellPlaceholder() {
  return <Box aria-busy="true" sx={{ minHeight: appViewport.contentHeight, background: ui.stage }} />;
}

export function AppShell() {
  usePersistedLobby();
  const screen = useGameStore((s) => s.screen);
  const displayMode = useGameStore((s) => s.displayMode);
  const reducedMotion = useGameStore((s) => s.preferences.reducedMotion);
  const setPendingRoomId = useGameStore((s) => s.setPendingRoomId);
  const loadPublishedGame = useGameStore((s) => s.loadPublishedGame);
  const joinAsDisplay = useGameStore((s) => s.joinAsDisplay);

  // A live game (or a television showing one) should not let the screen
  // sleep: a locked phone drops its socket mid-clue.
  useWakeLock(displayMode || screen === "play");

  // Mirror the in-app switch onto <html> so the global reduced-motion rule
  // (theme `MuiCssBaseline`) applies to every CSS animation, not only the
  // ones whose component reads the store.
  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) root.setAttribute(reducedMotionAttribute, "reduce");
    else root.removeAttribute(reducedMotionAttribute);
  }, [reducedMotion]);

  useEffect(() => {
    if (screen !== "landing") return;
    const prefetch = () => void loadRoom();
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(prefetch, 1500);
    return () => window.clearTimeout(handle);
  }, [screen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const gameId = params.get("game");
      if (gameId) {
        // A shared custom game: fetch it and deal it, the same as New Game.
        void openSharedGame(gameId, loadPublishedGame);
        return;
      }
      const roomId = params.get("room");
      if (!roomId) return;
      if (params.get("display") === "1") {
        // A television should show the board, not a form. Connect straight
        // away as a spectator rather than asking for a name first.
        void joinAsDisplay(roomId);
        return;
      }
      setPendingRoomId(roomId);
    } catch {
      // Ignore — URL parsing should never fail in normal usage
    }
  }, [joinAsDisplay, loadPublishedGame, setPendingRoomId]);

  let content;
  if (displayMode) content = <DisplayView />;
  else if (screen === "landing") content = <Landing />;
  else content = <Room />;

  // The one <main> landmark for every screen, padded clear of the notch,
  // the rounded corners and the home indicator on an installed iOS app
  // (`viewportFit: "cover"` in the root layout lets content reach them).
  return (
    <Box
      component="main"
      id="main-content"
      tabIndex={-1}
      sx={{
        minHeight: appViewport.minHeight,
        boxSizing: "border-box",
        paddingTop: appViewport.safeTop,
        paddingRight: appViewport.safeRight,
        paddingBottom: appViewport.safeBottom,
        paddingLeft: appViewport.safeLeft,
        background: ui.stage,
        outline: "none",
      }}
    >
      {content}
    </Box>
  );
}
