"use client";

import { useEffect, useRef, useState } from "react";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import MicIcon from "@mui/icons-material/MicNoneOutlined";
import MicOffIcon from "@mui/icons-material/MicOffOutlined";
import {
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  type SpeechRecognitionSession,
} from "@/lib/ai";

interface MicAnswerFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
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
  const supported = isSpeechRecognitionSupported();

  useEffect(() => {
    return () => {
      sessionRef.current?.abort();
    };
  }, []);

  function toggleMic() {
    if (!supported) return;
    if (listening) {
      sessionRef.current?.stop();
      sessionRef.current = null;
      setListening(false);
      return;
    }
    setListening(true);
    sessionRef.current = startSpeechRecognition({
      onInterim: (text) => onChange(text),
      onFinal: (text) => {
        onChange(text);
        setListening(false);
        sessionRef.current = null;
        // Briefly defer so the value prop has updated for the submit path.
        setTimeout(() => onSubmit(), 50);
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
  }

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
      autoFocus={autoFocus}
      disabled={disabled}
      slotProps={{
        input: {
          endAdornment: supported ? (
            <InputAdornment position="end">
              <Tooltip title={listening ? "Stop" : "Voice"}>
                <IconButton
                  onClick={toggleMic}
                  edge="end"
                  size="small"
                  color={listening ? "error" : "default"}
                  disabled={disabled}
                  aria-label={listening ? "Stop listening" : "Use microphone"}
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
