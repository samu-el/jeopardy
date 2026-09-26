import { describe, expect, it } from "vitest";
import {
  buildVoiceOptions,
  detectGender,
  discoverVoices,
  previewVoice,
  readoutRate,
  resolveVoice,
  type SpeakRequest,
  type VoiceAdapter,
} from "@/lib/ai";

function voices(names: string[], lang = "en-US") {
  return names.map(
    (name) =>
      ({
        name,
        lang: name.includes("UK") ? "en-GB" : lang,
        voiceURI: name,
        localService: !/Online|Google/.test(name),
        default: false,
      }) as SpeechSynthesisVoice,
  );
}

const chrome = discoverVoices(
  voices(["Google US English", "Google UK English Female", "Google UK English Male"]),
);
const edge = discoverVoices(
  voices([
    "Microsoft Andrew Online (Natural) - English (United States)",
    "Microsoft Emma Online (Natural) - English (United States)",
    "Microsoft Christopher Online (Natural) - English (United States)",
    "Microsoft Michelle Online (Natural) - English (United States)",
    "Microsoft David - English (United States)",
  ]),
);

describe("voice personas", () => {
  it("reads gender from common browser voice names", () => {
    expect(detectGender("Google UK English Male")).toBe("male");
    expect(detectGender("Google UK English Female")).toBe("female");
    expect(detectGender("Google US English")).toBe("female");
    for (const name of ["Andrew", "Christopher", "Davis", "Brandon", "Guy"]) {
      expect(detectGender(`Microsoft ${name} Online (Natural)`)).toBe("male");
    }
    for (const name of ["Emma", "Michelle", "Nora", "Natasha", "Aria", "Jenny"]) {
      expect(detectGender(`Microsoft ${name} Online (Natural)`)).toBe("female");
    }
    expect(detectGender("Fluffy Robot")).toBe("neutral");
  });

  it("never gives a female persona a male voice on Edge, nor the reverse", () => {
    expect(resolveVoice(edge, "female-natural").voice?.label).toBe("Emma");
    expect(resolveVoice(edge, "male-natural").voice?.gender).toBe("male");
    // The robotic SAPI David is last resort, behind the HD male voices.
    expect(resolveVoice(edge, "male-natural").voice?.label).not.toBe("David");
    for (const id of ["female-natural", "female-warm", "bright"]) {
      expect(resolveVoice(edge, id).voice?.gender, id).toBe("female");
    }
    for (const id of ["male-natural", "male-warm", "deep"]) {
      expect(resolveVoice(edge, id).voice?.gender, id).toBe("male");
    }
  });

  it("gives male personas the male Google voice on Chrome", () => {
    for (const id of ["male-natural", "male-warm", "deep"]) {
      expect(resolveVoice(chrome, id).voice?.label, id).toBe("Google UK English Male");
    }
    expect(resolveVoice(chrome, "female-natural").voice?.gender).toBe("female");
  });

  it("marks a fallback as inexact", () => {
    const resolved = resolveVoice(chrome, "deep");
    expect(resolved.exact).toBe(false);
    expect(resolved.persona?.label).toBe("Deep");
  });

  it("always offers Browser default and the selected id, naming the real voice", () => {
    const options = buildVoiceOptions(chrome, "female-natural");
    expect(options[0]).toMatchObject({ id: "browser-default", label: "Browser default" });
    expect(options[0].sub).toBe(chrome[0].label);
    const selected = options.find((option) => option.id === "female-natural");
    expect(selected).toBeDefined();
    // Whether Aria claims a voice or falls back, the menu says which one speaks.
    expect(selected?.sub).toContain(resolveVoice(chrome, "female-natural").voice?.label);

    const ids = options.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(buildVoiceOptions([], "female-natural").at(-1)).toMatchObject({
      id: "female-natural",
      unavailable: true,
    });
  });

  it("previews at the game's reading pace and restarts instead of queueing", () => {
    const requests: SpeakRequest[] = [];
    const adapter = {
      speak: (request: SpeakRequest) => void requests.push(request),
    } as unknown as VoiceAdapter;
    previewVoice(adapter, "female-natural", 1.1);
    previewVoice(adapter, "female-natural", 1.1);
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.interrupt).toBe(true);
      expect(request.rate).toBe(readoutRate(1.1));
    }
  });
});
