import { isPitch } from "./voiceLimits";

/** 中身を専用の声で読めるカッコの種類。 */
export interface BracketKind {
  id: string;
  /** そのカッコがふつう何に使われるか。 */
  label: string;
  /** 設定に表示するカッコ。 */
  symbol: string;
  /** 開きと閉じの文字。全角と半角は同じ種類として扱う。 */
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

/** カッコ 1 種類の声。オフの間も保存し、オンに戻すと元どおりになる。 */
export interface BracketVoice {
  on: boolean;
  /** 端末の声。なければ端末の既定の声。 */
  voice?: string;
  pitch: number;
}

/** 声を与えたカッコ。ここにないものは、周りの文として読まれる。 */
export type BracketVoices = Partial<Record<BracketId, BracketVoice>>;

export function isBracketId(value: unknown): value is BracketId {
  return bracketKinds.some((kind) => kind.id === value);
}

/** 保存されたカッコの声。壊れたものは落とす。 */
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

/** 専用の声で読まれるカッコの種類。 */
export function activeBrackets(voices: BracketVoices): BracketKind[] {
  return bracketKinds.filter((kind) => voices[kind.id]?.on);
}
