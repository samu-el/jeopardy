"use client";

import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { defaultAudioMix, speechRateRange } from "@/lib/ai";
import { useGameStore, type UiPreferences } from "@/lib/state/game-store";

type LevelKey = "voiceVolume" | "effectsVolume" | "musicVolume";

const levels: { key: LevelKey; label: string; fallback: number }[] = [
  { key: "voiceVolume", label: "Voice volume", fallback: defaultAudioMix.voice },
  { key: "effectsVolume", label: "Effects volume", fallback: defaultAudioMix.effects },
  { key: "musicVolume", label: "Music volume", fallback: defaultAudioMix.music },
];

/**
 * A level each for the host's voice, the stings and the Final Jeopardy
 * music, plus the reading speed. The Sound switch still mutes everything.
 */
export function AudioMixControls() {
  const preferences = useGameStore((s) => s.preferences);
  const setPreference = useGameStore((s) => s.setPreference);
  const disabled = !preferences.soundEnabled;

  return (
    <Stack spacing={0.5} data-testid="audio-mix">
      {levels.map(({ key, label, fallback }) => (
        <LabelledSlider
          key={key}
          id={`mix-${key}`}
          label={label}
          value={Math.round((preferences[key] ?? fallback) * 100)}
          min={0}
          max={100}
          step={5}
          disabled={disabled}
          format={(value) => `${value}%`}
          onChange={(value) => setPreference(key, (value / 100) as UiPreferences[LevelKey])}
        />
      ))}
      <LabelledSlider
        id="mix-speech-rate"
        label="Reading speed"
        value={preferences.speechRate ?? 1}
        min={speechRateRange.min}
        max={speechRateRange.max}
        step={0.05}
        format={(value) => `${value.toFixed(2)}×`}
        onChange={(value) => setPreference("speechRate", value)}
      />
    </Stack>
  );
}

function LabelledSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  disabled,
  format,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Typography id={id} variant="body2">
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {format(value)}
        </Typography>
      </Stack>
      <Slider
        size="small"
        aria-labelledby={id}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        getAriaValueText={format}
        onChange={(_, next) => onChange(Array.isArray(next) ? next[0] : next)}
      />
    </Box>
  );
}
