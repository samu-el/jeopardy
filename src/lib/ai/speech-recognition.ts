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
