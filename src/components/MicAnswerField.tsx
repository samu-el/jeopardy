"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import MicIcon from "@mui/icons-material/MicNoneOutlined";
import MicOffIcon from "@mui/icons-material/MicOffOutlined";
import {
  cancelSpeech,
  describeSpeechRecognitionError,
  isSpeechRecognitionSupported,
  speechRecognitionUnsupportedMessage,
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
  /** Extra attributes for the `<input>` itself (keyboard hints and the like). */
  htmlInputProps?: Record<string, string | number | boolean | undefined>;
}

/** Support never changes while the page is open. */
const subscribeNever = () => () => {};

const listeningText = "Listening… speak now";

const visuallyHidden = {
  position: "absolute",
  // Strings: MUI reads a bare 1 as 100%.
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

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
  htmlInputProps,
}: MicAnswerFieldProps) {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const sessionRef = useRef<SpeechRecognitionSession | null>(null);
  /** Set when the player pressed Stop: whatever was heard stays for review. */
  const stoppedByUserRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Resolved after mount: the server has no SpeechRecognition to ask about,
  // and guessing there would mismatch the client's first render.
  const supported = useSyncExternalStore<boolean | null>(
    subscribeNever,
    isSpeechRecognitionSupported,
    () => null,
  );

  useEffect(() => {
    return () => {
      stoppedByUserRef.current = true;
      sessionRef.current?.abort();
    };
  }, []);

  const toggleMic = useCallback(() => {
    if (!supported || disabled || blocked) return;
    if (listening) {
      // Abort, not stop: stop() makes the recogniser deliver a final result,
      // which would send a half-spoken answer. The words heard so far stay in
      // the field to check and send by hand.
      stoppedByUserRef.current = true;
      sessionRef.current?.abort();
      sessionRef.current = null;
      setListening(false);
      setStatus({
        text: "Stopped. Check your answer, then press Enter.",
        error: false,
      });
      inputRef.current?.focus();
      return;
    }
    // The microphone hears the speakers: stop the host mid-sentence rather
    // than transcribing the readout back into the answer.
    cancelSpeech();
    stoppedByUserRef.current = false;
    setListening(true);
    setStatus({ text: listeningText, error: false });
    sessionRef.current = startSpeechRecognition({
      onInterim: (text) => {
        if (!stoppedByUserRef.current) onChange(text);
      },
      onFinal: (text) => {
        onChange(text);
        setListening(false);
        sessionRef.current = null;
        if (stoppedByUserRef.current) return;
        setStatus(null);
        onSubmit(text);
      },
      onError: (code) => {
        setListening(false);
        sessionRef.current = null;
        const info = describeSpeechRecognitionError(code);
        if (!info) return;
        setStatus({ text: info.message, error: true });
        if (info.blocked) setBlocked(true);
      },
      onEnd: () => {
        sessionRef.current = null;
        setListening(false);
        setStatus((current) => (current?.text === listeningText ? null : current));
      },
    });
    if (!sessionRef.current) {
      setListening(false);
      setStatus((current) =>
        current?.error
          ? current
          : { text: "Couldn't start the microphone.", error: true },
      );
    }
  }, [supported, disabled, blocked, listening, onChange, onSubmit]);

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

  const micTitle =
    supported === false
      ? speechRecognitionUnsupportedMessage
      : blocked
        ? "Microphone blocked: allow it in the address bar"
        : listening
          ? "Stop listening"
          : "Answer by voice (Alt+M)";

  const micButton =
    supported === null ? null : (
      <InputAdornment position="end">
        <Tooltip title={micTitle}>
          {/* A span so the tooltip still explains a disabled mic. */}
          <Box component="span" sx={{ display: "inline-flex" }}>
            <IconButton
              onClick={toggleMic}
              edge="end"
              size="small"
              color={listening ? "error" : "default"}
              disabled={disabled || !supported || blocked}
              data-testid="mic-toggle"
              aria-label={
                !supported
                  ? speechRecognitionUnsupportedMessage
                  : listening
                    ? "Stop listening"
                    : "Answer by voice"
              }
              aria-pressed={listening}
              sx={
                listening
                  ? {
                      boxShadow: "0 0 0 2px currentColor",
                      "@media (prefers-reduced-motion: no-preference)": {
                        animation: "mic-pulse 1.2s ease-in-out infinite",
                      },
                      "@keyframes mic-pulse": {
                        "0%, 100%": { boxShadow: "0 0 0 2px currentColor" },
                        "50%": { boxShadow: "0 0 0 6px transparent" },
                      },
                    }
                  : undefined
              }
            >
              {listening ? <MicOffIcon /> : <MicIcon />}
            </IconButton>
          </Box>
        </Tooltip>
      </InputAdornment>
    );

  return (
    <Box sx={{ position: "relative", width: fullWidth ? "100%" : undefined }}>
      <TextField
        fullWidth={fullWidth}
        size={size}
        label={label}
        placeholder={listening ? listeningText : placeholder}
        value={value}
        onChange={(event) => {
          if (status && !listening) setStatus(null);
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
        inputRef={inputRef}
        autoFocus={autoFocus}
        disabled={disabled}
        error={Boolean(status?.error)}
        helperText={status?.text}
        slotProps={{
          // Hung below the field rather than inside the flow, so a message
          // never pushes the answer strip around mid-clue.
          formHelperText: {
            "data-testid": "mic-status",
            sx: {
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              mx: 0,
              mt: 0.25,
              zIndex: 1,
              lineHeight: 1.25,
            },
          } as Record<string, unknown>,
          htmlInput: htmlInputProps,
          input: { endAdornment: micButton },
        }}
      />
      {/* Announced once, whatever the helper text is doing visually. */}
      <Box component="span" role="status" aria-live="polite" sx={visuallyHidden}>
        {status?.text ?? ""}
      </Box>
    </Box>
  );
}
