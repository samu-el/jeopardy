// Minimal Web Speech Recognition wrapper. Uses the (still vendor-prefixed)
// SpeechRecognition API which is free, runs in-browser, and works in
// Chromium-based browsers and Safari.

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
  length: number;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionError extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionError) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isSpeechRecognitionSupported() {
  return Boolean(getConstructor());
}

export interface SpeechRecognitionSession {
  stop: () => void;
  abort: () => void;
}

export interface SpeechRecognitionOptions {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
  lang?: string;
}

export function startSpeechRecognition(
  options: SpeechRecognitionOptions,
): SpeechRecognitionSession | null {
  const Ctor = getConstructor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = options.lang ?? "en-US";

  recognition.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interimText += result[0].transcript;
      }
    }
    if (interimText && options.onInterim) {
      options.onInterim(interimText.trim());
    }
    if (finalText) {
      options.onFinal(finalText.trim());
    }
  };
  recognition.onerror = (event) => {
    options.onError?.(event.error ?? "speech-error");
  };
  recognition.onend = () => {
    options.onEnd?.();
  };

  try {
    recognition.start();
  } catch (error) {
    options.onError?.(String((error as Error)?.message ?? error));
    return null;
  }

  return {
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  };
}

export interface SpeechRecognitionErrorInfo {
  /** Short, plain-language line for helper text and the live region. */
  message: string;
  /** The microphone can't be used until the player changes a setting. */
  blocked: boolean;
}

/**
 * What a recognition error code means to the player. Pure; the codes are the
 * Web Speech API's (`not-allowed`, `no-speech`, `network`, ...). A user-
 * initiated `aborted` is not an error and maps to no message.
 */
export function describeSpeechRecognitionError(
  code: string | undefined,
): SpeechRecognitionErrorInfo | null {
  switch (code) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return {
        message: "Microphone blocked. Allow it in the address bar, then try again.",
        blocked: true,
      };
    case "audio-capture":
      return { message: "No microphone found. Check it's plugged in.", blocked: false };
    case "no-speech":
      return { message: "Didn't catch that. Tap the mic and try again.", blocked: false };
    case "network":
      return {
        message: "Voice answers need a connection. Type your answer instead.",
        blocked: false,
      };
    case "language-not-supported":
      return { message: "Voice answers aren't available in this language.", blocked: true };
    default:
      return { message: "Voice input stopped. Type your answer or try again.", blocked: false };
  }
}

/** Shown in place of the mic where the browser has no speech recognition. */
export const speechRecognitionUnsupportedMessage = "Voice answers need Chrome, Edge or Safari";
