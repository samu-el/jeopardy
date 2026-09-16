"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import VolumeUpIcon from "@mui/icons-material/VolumeUpOutlined";
import { baselineAvatarHostProfiles } from "@/lib/ai/profiles";
import { createVoiceAdapter, voicePersonas, type DiscoveredVoice } from "@/lib/ai";
import { useGameStore, type UiPreferences } from "@/lib/state/game-store";

const voiceAdapter = typeof window === "undefined" ? null : createVoiceAdapter();

/** Everything in here is one switch or one menu, so it is written as a list. */
const toggles: { key: keyof UiPreferences; label: string }[] = [
  { key: "soundEnabled", label: "Sound" },
  { key: "subtitlesEnabled", label: "Subtitles" },
  { key: "chatEnabled", label: "Chat" },
  { key: "reducedMotion", label: "Reduced motion" },
];

const buzzWindows = [
  { value: 5, label: "5 seconds — show pace" },
  { value: 6, label: "6 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 20, label: "20 seconds — relaxed" },
];

const hostModes = [
  { value: "off", label: "Off" },
  { value: "voice-only", label: "Voice" },
  { value: "avatar-and-voice", label: "Avatar" },
];

export function SettingsPanel() {
  const preferences = useGameStore((s) => s.preferences);
  const setPreference = useGameStore((s) => s.setPreference);
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

  return (
    <Stack spacing={2}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Choice
            id="voice-profile"
            label="Voice"
            value={preferences.voiceProfileId}
            onChange={(value) => setPreference("voiceProfileId", value)}
            renderValue={(value) =>
              voiceOptions.find((option) => option.id === value)?.label ?? "Default"
            }
          >
            {voiceOptions.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                <ListItemText primary={option.label} secondary={option.sub} />
                {option.quality === "premium" ? (
                  <Chip size="small" label="HD" color="secondary" sx={{ ml: 1 }} />
                ) : null}
              </MenuItem>
            ))}
          </Choice>
          <Tooltip title="Preview">
            <IconButton
              onClick={() =>
                voiceAdapter?.speak({
                  text: "This is your Jeopardy host. Welcome to the game.",
                  voiceProfileId: preferences.voiceProfileId,
                })
              }
            >
              <VolumeUpIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack spacing={0}>
          {toggles.map(({ key, label }) => (
            <FormControlLabel
              key={key}
              label={label}
              control={
                <Switch
                  checked={Boolean(preferences[key])}
                  onChange={(_, value) => setPreference(key, value)}
                />
              }
            />
          ))}
        </Stack>

        <Choice
          id="buzz-window"
          label="Buzz window"
          value={preferences.buzzWindowSeconds}
          onChange={(value) => setPreference("buzzWindowSeconds", Number(value))}
        >
          {buzzWindows.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Choice>
      </Stack>

      <Divider />

      <Stack spacing={1.5}>
        <Choice
          id="host-mode"
          label="Host"
          value={preferences.avatarHostMode}
          onChange={(value) =>
            setPreference("avatarHostMode", value as UiPreferences["avatarHostMode"])
          }
        >
          {hostModes.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Choice>

        <Choice
          id="host-profile"
          label="Persona"
          value={preferences.avatarHostProfileId}
          onChange={(value) => setPreference("avatarHostProfileId", value)}
        >
          {baselineAvatarHostProfiles.map((profile) => (
            <MenuItem key={profile.id} value={profile.id}>
              {profile.label}
            </MenuItem>
          ))}
        </Choice>
      </Stack>
    </Stack>
  );
}

/** A labelled menu. Five of these, spelled out, was most of this panel. */
function Choice({
  id,
  label,
  value,
  onChange,
  renderValue,
  children,
}: {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  renderValue?: (value: string) => ReactNode;
  children: ReactNode;
}) {
  return (
    <FormControl fullWidth size="small">
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
