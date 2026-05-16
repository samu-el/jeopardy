"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
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
import { baselineAvatarHostProfiles } from "@/lib/foundation/game-contracts";
import {
  createVoiceAdapter,
  voicePersonas,
  type DiscoveredVoice,
} from "@/lib/ai";
import { useGameStore } from "@/lib/state/game-store";

const voiceAdapter = typeof window === "undefined" ? null : createVoiceAdapter();

export function SettingsPanel() {
  const preferences = useGameStore((s) => s.preferences);
  const setPreference = useGameStore((s) => s.setPreference);
  const [voices, setVoices] = useState<DiscoveredVoice[]>([]);

  useEffect(() => {
    if (!voiceAdapter) return;
    const update = () => setVoices(voiceAdapter.listDiscoveredVoices());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const options = useMemo(() => {
    const seen = new Set<string>();
    const personaItems = voicePersonas
      .map((persona) => {
        const matched = voices.find(persona.predicate);
        if (!matched || seen.has(matched.id)) return null;
        seen.add(matched.id);
        return {
          id: persona.id,
          label: persona.label,
          sub: matched.label,
          quality: matched.quality,
        };
      })
      .filter(Boolean) as { id: string; label: string; sub: string; quality: DiscoveredVoice["quality"] }[];
    const remaining = voices
      .filter((voice) => !seen.has(voice.id))
      .map((voice) => ({
        id: voice.id,
        label: voice.label,
        sub: voice.locale,
        quality: voice.quality,
      }));
    return [...personaItems, ...remaining];
  }, [voices]);

  function preview() {
    voiceAdapter?.speak({
      text: "This is your Jeopardy host. Welcome to the game.",
      voiceProfileId: preferences.voiceProfileId,
    });
  }

  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <FormControl fullWidth size="small">
                <InputLabel id="voice-profile">Voice</InputLabel>
                <Select
                  labelId="voice-profile"
                  label="Voice"
                  value={preferences.voiceProfileId}
                  onChange={(event) => setPreference("voiceProfileId", event.target.value)}
                  renderValue={(value) =>
                    options.find((opt) => opt.id === value)?.label ?? "Default"
                  }
                >
                  {options.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      <ListItemText primary={option.label} secondary={option.sub} />
                      {option.quality === "premium" ? (
                        <Chip size="small" label="HD" color="secondary" sx={{ ml: 1 }} />
                      ) : null}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Tooltip title="Preview">
                <IconButton onClick={preview}>
                  <VolumeUpIcon />
                </IconButton>
              </Tooltip>
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.soundEnabled}
                  onChange={(_, value) => setPreference("soundEnabled", value)}
                />
              }
              label="Sound"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.captionsEnabled}
                  onChange={(_, value) => setPreference("captionsEnabled", value)}
                />
              }
              label="Captions"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.reducedMotion}
                  onChange={(_, value) => setPreference("reducedMotion", value)}
                />
              }
              label="Reduced motion"
            />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="host-mode">Host</InputLabel>
              <Select
                labelId="host-mode"
                label="Host"
                value={preferences.avatarHostMode}
                onChange={(event) =>
                  setPreference(
                    "avatarHostMode",
                    event.target.value as typeof preferences.avatarHostMode,
                  )
                }
              >
                <MenuItem value="off">Off</MenuItem>
                <MenuItem value="voice-only">Voice</MenuItem>
                <MenuItem value="avatar-and-voice">Avatar</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="host-profile">Persona</InputLabel>
              <Select
                labelId="host-profile"
                label="Persona"
                value={preferences.avatarHostProfileId}
                onChange={(event) =>
                  setPreference("avatarHostProfileId", event.target.value)
                }
              >
                {baselineAvatarHostProfiles.map((profile) => (
                  <MenuItem key={profile.id} value={profile.id}>
                    {profile.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
