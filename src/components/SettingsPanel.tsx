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
import Typography from "@mui/material/Typography";
import {
  baselineAvatarHostProfiles,
  baselineVoiceProfiles,
} from "@/lib/foundation/game-contracts";
import { useGameStore } from "@/lib/state/game-store";

export function SettingsPanel() {
  const preferences = useGameStore((s) => s.preferences);
  const setPreference = useGameStore((s) => s.setPreference);

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Voice & accessibility
          </Typography>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="voice-profile">Clue readout voice</InputLabel>
              <Select
                labelId="voice-profile"
                label="Clue readout voice"
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
              label="Sound effects and clue readout"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.captionsEnabled}
                  onChange={(_, value) => setPreference("captionsEnabled", value)}
                />
              }
              label="Captions and on-screen clue text (always-on for accessibility)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.reducedMotion}
                  onChange={(_, value) => setPreference("reducedMotion", value)}
                />
              }
              label="Reduced motion (calmer transitions)"
            />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Avatar AI host
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
            The avatar host adds light commentary and pacing reminders. It never reveals
            answers or private wagers early.
          </Typography>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="host-mode">Host mode</InputLabel>
              <Select
                labelId="host-mode"
                label="Host mode"
                value={preferences.avatarHostMode}
                onChange={(event) =>
                  setPreference(
                    "avatarHostMode",
                    event.target.value as typeof preferences.avatarHostMode,
                  )
                }
              >
                <MenuItem value="off">Off</MenuItem>
                <MenuItem value="voice-only">Voice only</MenuItem>
                <MenuItem value="avatar-and-voice">Avatar & voice</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="host-profile">Host persona</InputLabel>
              <Select
                labelId="host-profile"
                label="Host persona"
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
