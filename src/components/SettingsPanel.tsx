"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import PlayCircleIcon from "@mui/icons-material/PlayCircleOutlined";
import { baselineAvatarHostProfiles } from "@/lib/ai/profiles";
import {
  buildVoiceOptions,
  createVoiceAdapter,
  previewVoice,
  type DiscoveredVoice,
} from "@/lib/ai";
import { useGameStore, type UiPreferences } from "@/lib/state/game-store";
import { AudioMixControls } from "./AudioMixControls";
import { useOsPrefersReducedMotion } from "./use-reduced-motion";
import { useRoomRole } from "./use-room-role";

const voiceAdapter = typeof window === "undefined" ? null : createVoiceAdapter();

type ToggleKey = "soundEnabled" | "subtitlesEnabled" | "chatEnabled" | "reducedMotion";

const buzzWindows = [
  { value: 5, label: "5 seconds" },
  { value: 6, label: "6 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 20, label: "20 seconds" },
];

const hostModes: { value: UiPreferences["avatarHostMode"]; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "voice-only", label: "Voice" },
  { value: "avatar-and-voice", label: "Avatar" },
];

/**
 * Labels only: what a control depends on shows as state, not prose. Choosing
 * a speaking host turns Sound on, a muted board says so with a key to fix it,
 * controls that can't apply are disabled, and a guest isn't shown the host's
 * room settings at all.
 */
export function SettingsPanel() {
  const preferences = useGameStore((s) => s.preferences);
  const setPreference = useGameStore((s) => s.setPreference);
  const { isRoomHost } = useRoomRole();
  const osReducedMotion = useOsPrefersReducedMotion();
  const voices = useDiscoveredVoices();

  // The browser hands out its voices late and in its own order, so the
  // personas claim the ones they recognise first and the rest follow. The
  // stored choice is always listed, with the voice it really uses.
  const voiceOptions = useMemo(
    () => buildVoiceOptions(voices, preferences.voiceProfileId),
    [voices, preferences.voiceProfileId],
  );

  const hostOff = preferences.avatarHostMode === "off";
  const muted = !preferences.soundEnabled;

  function chooseHostMode(mode: UiPreferences["avatarHostMode"]) {
    setPreference("avatarHostMode", mode);
    // Asking for a host that talks is asking to hear it.
    if (mode !== "off" && muted) setPreference("soundEnabled", true);
  }

  const toggles: {
    key: ToggleKey;
    label: string;
    disabled?: boolean;
    checked?: boolean;
  }[] = [
    { key: "soundEnabled", label: "Sound" },
    // Subtitles print the host's lines, so there are none without a host.
    { key: "subtitlesEnabled", label: "Subtitles", disabled: hostOff },
    { key: "chatEnabled", label: "Chat" },
    {
      key: "reducedMotion",
      label: "Reduced motion",
      // The device asked for it: shown on, and not ours to turn off.
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
      {muted ? (
        <Alert
          severity="warning"
          data-testid="sound-off-hint"
          action={
            <Button color="inherit" size="small" onClick={() => setPreference("soundEnabled", true)}>
              Turn on
            </Button>
          }
        >
          Sound is off
        </Alert>
      ) : null}

      <Stack spacing={1.5}>
        <Choice
          id="host-mode"
          label="Host"
          value={preferences.avatarHostMode}
          onChange={(value) => chooseHostMode(value as UiPreferences["avatarHostMode"])}
        >
          {hostModes.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Choice>

        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          <Choice
            id="voice-profile"
            label="Voice"
            value={preferences.voiceProfileId}
            onChange={(value) => setPreference("voiceProfileId", value)}
            renderValue={(value) =>
              voiceOptions.find((option) => option.id === value)?.label ?? "Browser default"
            }
          >
            {voiceOptions.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.label}
                {option.quality === "premium" ? (
                  <Chip size="small" label="HD" color="secondary" sx={{ ml: 1 }} />
                ) : null}
              </MenuItem>
            ))}
          </Choice>
          <Tooltip title="Hear this voice">
            <IconButton
              aria-label="Hear this voice"
              onClick={() =>
                previewVoice(voiceAdapter, preferences.voiceProfileId, preferences.speechRate)
              }
            >
              <PlayCircleIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Choice
          id="host-profile"
          label="Persona"
          value={preferences.avatarHostProfileId}
          disabled={hostOff}
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
        {toggles.map(({ key, label, disabled, checked }) => (
          <FormControlLabel
            key={key}
            disabled={disabled}
            sx={{ ml: -1 }}
            label={label}
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

      <AudioMixControls />

      {/* A guest's choice would change nothing: the room keeps the host's. */}
      {isRoomHost ? (
        <>
          <Divider />
          <Choice
            id="buzz-window"
            label="Buzz window"
            value={buzzValue}
            onChange={(value) => setPreference("buzzWindowSeconds", Number(value))}
          >
            {buzzOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Choice>
        </>
      ) : null}
    </Stack>
  );
}

/** A labelled menu. */
function Choice({
  id,
  label,
  value,
  onChange,
  renderValue,
  disabled,
  children,
}: {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  renderValue?: (value: string) => ReactNode;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <FormControl fullWidth size="small" disabled={disabled}>
      <InputLabel id={id}>{label}</InputLabel>
      <Select
        labelId={id}
        label={label}
        value={value}
        onChange={(event) => onChange(String(event.target.value))}
        renderValue={renderValue ? (raw) => renderValue(String(raw)) : undefined}
      >
        {children}
      </Select>
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
