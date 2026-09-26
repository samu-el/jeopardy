"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import PlayCircleIcon from "@mui/icons-material/PlayCircleOutlined";
import { baselineAvatarHostProfiles } from "@/lib/ai/profiles";
import { createVoiceAdapter, voicePersonas, type DiscoveredVoice } from "@/lib/ai";
import { useGameStore, type UiPreferences } from "@/lib/state/game-store";
import { useOsPrefersReducedMotion } from "./use-reduced-motion";
import { useRoomRole } from "./use-room-role";

const voiceAdapter = typeof window === "undefined" ? null : createVoiceAdapter();

type ToggleKey = "soundEnabled" | "subtitlesEnabled" | "chatEnabled" | "reducedMotion";

const buzzWindows = [
  { value: 5, label: "5 seconds — show pace" },
  { value: 6, label: "6 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 20, label: "20 seconds — relaxed" },
];

/**
 * The host modes on offer. Nothing draws an avatar yet — "Avatar" behaved
 * exactly like "Voice" — so it is listed as coming rather than offered.
 */
const hostModes: { value: UiPreferences["avatarHostMode"]; label: string; disabled?: boolean }[] = [
  { value: "off", label: "Off" },
  { value: "voice-only", label: "Voice" },
  { value: "avatar-and-voice", label: "Avatar (coming soon)", disabled: true },
];

/**
 * What each control does, and what it depends on, said next to it: the old
 * panel showed "Host: Voice" over a host that couldn't speak because Sound
 * was off, and nothing said why.
 */
export function SettingsPanel() {
  const preferences = useGameStore((s) => s.preferences);
  const setPreference = useGameStore((s) => s.setPreference);
  const { isRoomHost } = useRoomRole();
  const osReducedMotion = useOsPrefersReducedMotion();
  const voices = useDiscoveredVoices();

  // The browser hands out its voices late and in its own order, so the
  // personas claim the ones they recognise first and the rest follow.
  const voiceOptions = useMemo(() => {
    const claimed = new Set<string>();
    const personas = voicePersonas.flatMap((persona) => {
      const match = voices.find(persona.predicate);
      if (!match || claimed.has(match.id)) return [];
      claimed.add(match.id);
      return [{ id: persona.id, label: persona.label, sub: match.label, quality: match.quality }];
    });
    return [
      ...personas,
      ...voices
        .filter((voice) => !claimed.has(voice.id))
        .map((voice) => ({
          id: voice.id,
          label: voice.label,
          sub: voice.locale,
          quality: voice.quality,
        })),
    ];
  }, [voices]);

  const hostOff = preferences.avatarHostMode === "off";
  const muted = !preferences.soundEnabled;

  const hostHelp = hostOff
    ? "No readout and no host lines. Clues are only shown."
    : muted
      ? preferences.subtitlesEnabled
        ? "Sound is off: the host's lines are printed but not spoken."
        : "Sound is off, so the host is silent. Turn Sound on to hear it, or Subtitles to read along."
      : "Reads each clue aloud and calls the game.";

  const toggles: { key: ToggleKey; label: string; help: string; disabled?: boolean; checked?: boolean }[] = [
    {
      key: "soundEnabled",
      label: "Sound",
      help: hostOff ? "Effects only: the host is off." : "The host's voice and the game's effects.",
    },
    {
      key: "subtitlesEnabled",
      label: "Subtitles",
      help: hostOff ? "Needs the host on." : "Prints what the host says.",
      disabled: hostOff,
    },
    { key: "chatEnabled", label: "Chat", help: "A chat box under the lecterns." },
    {
      key: "reducedMotion",
      label: "Reduced motion",
      help: osReducedMotion
        ? "On because your device asks for reduced motion."
        : "Skips the board and clue animations.",
      disabled: osReducedMotion,
      checked: osReducedMotion || preferences.reducedMotion,
    },
  ];

  const buzzValue = preferences.buzzWindowSeconds;
  const buzzOptions = buzzWindows.some((option) => option.value === buzzValue)
    ? buzzWindows
    : [...buzzWindows, { value: buzzValue, label: `${buzzValue} seconds` }].sort(
        (a, b) => a.value - b.value,
      );

  return (
    <Stack spacing={2}>
      <Stack spacing={1.5}>
        <Choice
          id="host-mode"
          label="Host"
          value={preferences.avatarHostMode}
          helper={hostHelp}
          warn={!hostOff && muted && !preferences.subtitlesEnabled}
          onChange={(value) =>
            setPreference("avatarHostMode", value as UiPreferences["avatarHostMode"])
          }
        >
          {hostModes.map((option) => (
            <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </MenuItem>
          ))}
        </Choice>

        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          <Choice
            id="voice-profile"
            label="Voice"
            value={preferences.voiceProfileId}
            disabled={hostOff}
            helper={hostOff ? "Turn the host on to choose a voice." : undefined}
            onChange={(value) => setPreference("voiceProfileId", value)}
            renderValue={(value) =>
              voiceOptions.find((option) => option.id === value)?.label ?? "Default"
            }
          >
            {voiceOptions.length === 0 ? (
              <MenuItem value={preferences.voiceProfileId} disabled>
                <ListItemText primary="Default" secondary="This browser lists no voices" />
              </MenuItem>
            ) : null}
            {voiceOptions.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                <ListItemText primary={option.label} secondary={option.sub} />
                {option.quality === "premium" ? (
                  <Chip size="small" label="HD" color="secondary" sx={{ ml: 1 }} />
                ) : null}
              </MenuItem>
            ))}
          </Choice>
          <Tooltip title="Hear this voice">
            <span>
              <IconButton
                aria-label="Hear this voice"
                disabled={hostOff}
                onClick={() =>
                  voiceAdapter?.speak({
                    text: "This is your Jeopardy host. Welcome to the game.",
                    voiceProfileId: preferences.voiceProfileId,
                    // Replace a preview still playing rather than queueing behind it.
                    interrupt: true,
                    rate: 0.92,
                  })
                }
              >
                <PlayCircleIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Choice
          id="host-profile"
          label="Persona"
          value={preferences.avatarHostProfileId}
          disabled={hostOff}
          helper={hostOff ? "Turn the host on to choose a persona." : "How the host talks between clues."}
          onChange={(value) => setPreference("avatarHostProfileId", value)}
        >
          {baselineAvatarHostProfiles.map((profile) => (
            <MenuItem key={profile.id} value={profile.id}>
              {profile.label}
            </MenuItem>
          ))}
        </Choice>
      </Stack>

      <Divider />

      <Stack spacing={0.5}>
        {toggles.map(({ key, label, help, disabled, checked }) => (
          <FormControlLabel
            key={key}
            disabled={disabled}
            sx={{ alignItems: "flex-start", ml: -1, "& .MuiSwitch-root": { mt: -0.5 } }}
            label={
              <Stack spacing={0}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {help}
                </Typography>
              </Stack>
            }
            control={
              <Switch
                checked={checked ?? Boolean(preferences[key])}
                onChange={(_, value) => setPreference(key, value)}
                slotProps={{ input: { "aria-label": label } }}
              />
            }
          />
        ))}
      </Stack>

      <Divider />

      {isRoomHost ? (
        <Choice
          id="buzz-window"
          label="Buzz window"
          value={buzzValue}
          helper="How long the buzzer stays open after the clue is read."
          onChange={(value) => setPreference("buzzWindowSeconds", Number(value))}
        >
          {buzzOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Choice>
      ) : (
        // A guest's choice would change nothing: the room keeps the host's.
        <Stack spacing={0.25}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Buzz window
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Set by the host for everyone in the room.
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}

/** A labelled menu, with a line under it saying what it does. */
function Choice({
  id,
  label,
  value,
  onChange,
  renderValue,
  helper,
  warn,
  disabled,
  children,
}: {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  renderValue?: (value: string) => ReactNode;
  helper?: string;
  warn?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const helperId = `${id}-help`;
  return (
    <FormControl fullWidth size="small" disabled={disabled}>
      <InputLabel id={id}>{label}</InputLabel>
      <Select
        labelId={id}
        label={label}
        value={value}
        onChange={(event) => onChange(String(event.target.value))}
        renderValue={renderValue ? (raw) => renderValue(String(raw)) : undefined}
        aria-describedby={helper ? helperId : undefined}
      >
        {children}
      </Select>
      {helper ? (
        <FormHelperText id={helperId} sx={warn ? { color: "warning.main" } : undefined}>
          {helper}
        </FormHelperText>
      ) : null}
    </FormControl>
  );
}

/** The browser discovers voices asynchronously and keeps adding to the list. */
function useDiscoveredVoices(): DiscoveredVoice[] {
  const [voices, setVoices] = useState<DiscoveredVoice[]>([]);
  useEffect(() => {
    if (!voiceAdapter) return;
    const update = () => setVoices(voiceAdapter.listDiscoveredVoices());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  return voices;
}
