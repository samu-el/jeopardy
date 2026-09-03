"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import MicIcon from "@mui/icons-material/MicNoneOutlined";
import MicOffIcon from "@mui/icons-material/MicOffOutlined";
import {
  cancelSpeech,
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  type SpeechRecognitionSession,
} from "@/lib/ai";

interface MicAnswerFieldProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Called with the text to send. Dictation passes its transcript directly:
   * the parent's `value` hasn't re-rendered yet when speech finishes, so
   * reading it from state there would submit the previous answer.
   */
  onSubmit: (text?: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: "small" | "medium";
  fullWidth?: boolean;
  autoFocus?: boolean;
}

export function MicAnswerField({
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  disabled,
  size = "small",
  fullWidth = true,
  autoFocus,
}: MicAnswerFieldProps) {
  const [listening, setListening] = useState(false);
  const sessionRef = useRef<SpeechRecognitionSession | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const supported = isSpeechRecognitionSupported();

  useEffect(() => {
    return () => {
      sessionRef.current?.abort();
    };
  }, []);

  const toggleMic = useCallback(() => {
    if (!supported || disabled) return;
    if (listening) {
      sessionRef.current?.stop();
      sessionRef.current = null;
      setListening(false);
      return;
    }
    // The microphone hears the speakers: stop the host mid-sentence rather
    // than transcribing the readout back into the answer.
    cancelSpeech();
    setListening(true);
    sessionRef.current = startSpeechRecognition({
      onInterim: (text) => onChange(text),
      onFinal: (text) => {
        onChange(text);
        setListening(false);
        sessionRef.current = null;
        onSubmit(text);
      },
      onError: () => {
        setListening(false);
        sessionRef.current = null;
      },
      onEnd: () => {
        sessionRef.current = null;
        setListening(false);
      },
    });
  }, [supported, disabled, listening, onChange, onSubmit]);

  // Alt+M works from inside the field, where the answer is being typed.
  useEffect(() => {
    if (!supported) return;
    function onKey(event: KeyboardEvent) {
      if (!event.altKey || event.key.toLowerCase() !== "m") return;
      event.preventDefault();
      toggleMic();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [supported, toggleMic]);

  return (
    <TextField
      fullWidth={fullWidth}
      size={size}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
      }}
      inputRef={inputRef}
      autoFocus={autoFocus}
      disabled={disabled}
      slotProps={{
        input: {
          endAdornment: supported ? (
            <InputAdornment position="end">
              <Tooltip title={listening ? "Stop listening" : "Answer by voice (Alt+M)"}>
                <IconButton
                  onClick={toggleMic}
                  edge="end"
                  size="small"
                  color={listening ? "error" : "default"}
                  disabled={disabled}
                  data-testid="mic-toggle"
                  aria-label={listening ? "Stop listening" : "Answer by voice"}
                  aria-pressed={listening}
                >
                  {listening ? <MicOffIcon /> : <MicIcon />}
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  );
}
