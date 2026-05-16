"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import {
  baselineAvatarHostProfiles,
  baselineVoiceProfiles,
} from "@/lib/foundation/game-contracts";
import { useGameStore } from "@/lib/state/game-store";

export function SettingsPanel() {
  const preferences = useGameStore((s) => s.preferences);
  const setPreference = useGameStore((s) => s.setPreference);

  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="voice-profile">Voice</InputLabel>
              <Select
                labelId="voice-profile"
                label="Voice"
                value={preferences.voiceProfileId}
                onChange={(event) => setPreference("voiceProfileId", event.target.value)}
              >
                {baselineVoiceProfiles.map((voice) => (
                  <MenuItem key={voice.id} value={voice.id}>
                    {voice.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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
