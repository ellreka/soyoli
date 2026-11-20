import { isPitch } from "./voiceLimits";

export interface BracketKind {
  id: string;
  label: string;
  symbol: string;
  pairs: readonly (readonly [open: string, close: string])[];
}

export const bracketKinds = [
  { id: "kagi", label: "会話", symbol: "「」", pairs: [["「", "」"]] },
  { id: "double", label: "引用・強調", symbol: "『』", pairs: [["『", "』"]] },
  {
    id: "paren",
    label: "心の声",
    symbol: "（）",
    pairs: [
      ["（", "）"],
      ["(", ")"],
    ],
  },
  { id: "sumi", label: "見出しなど", symbol: "【】", pairs: [["【", "】"]] },
] as const satisfies readonly BracketKind[];

export type BracketId = (typeof bracketKinds)[number]["id"];

export interface BracketVoice {
  on: boolean;
  voice?: string;
  pitch: number;
}

export type BracketVoices = Partial<Record<BracketId, BracketVoice>>;

export function isBracketId(value: unknown): value is BracketId {
  return bracketKinds.some((kind) => kind.id === value);
}

export function toBracketVoices(value: unknown): BracketVoices {
  const result: BracketVoices = {};
  if (typeof value !== "object" || value === null) {
    return result;
  }
  for (const kind of bracketKinds) {
    const item = (value as Record<string, unknown>)[kind.id] as
      | Partial<BracketVoice>
      | null
      | undefined;
    if (item && typeof item === "object" && isPitch(item.pitch)) {
      result[kind.id] = {
        on: item.on === true,
        pitch: item.pitch,
        ...(typeof item.voice === "string" &&
          item.voice && { voice: item.voice }),
      };
    }
  }
  return result;
}

export function activeBrackets(voices: BracketVoices): BracketKind[] {
  return bracketKinds.filter((kind) => voices[kind.id]?.on);
}
