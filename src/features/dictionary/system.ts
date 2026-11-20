import type { DictionaryEntry } from "./entries";

export interface SystemRule extends DictionaryEntry {
  regex: true;
  id: string;
  description: string;
}

const ascii = "[!-~]";

export const systemRules: readonly SystemRule[] = [
  {
    id: "url",
    description: "URL",
    surface: `https?://${ascii}+`,
    reading: "URL省略",
    regex: true,
  },
  {
    id: "url-www",
    description: "URL（www. で始まるもの）",
    surface: `(?<!${ascii})www\\.${ascii}+`,
    reading: "URL省略",
    regex: true,
  },
  {
    id: "divider",
    description: "区切りの記号（◆◇◆、＊＊＊ など）",
    surface: "(?:[◆◇■□◎★☆＊*＃#♦♢][ 　]*){3,}",
    reading: "",
    regex: true,
  },
  {
    id: "dash",
    description: "罫線・ダッシュの連続（――）",
    surface: "[―─━]{2,}",
    reading: "、",
    regex: true,
  },
  {
    id: "placeholder",
    description: "伏せ字（〇〇、○○）",
    surface:
      "(?<![一二三四五六七八九十百千〇0-9０-９])(?:〇{2,}|○{2,})(?![一二三四五六七八九十百千〇0-9０-９年月日])",
    reading: "まるまる",
    regex: true,
  },
  {
    id: "laugh",
    description: "笑いの「ｗｗｗ」",
    surface:
      "(?<![A-Za-zＡ-Ｚａ-ｚ0-9０-９.])[wｗ]{2,}(?![A-Za-zＡ-Ｚａ-ｚ0-9０-９.])",
    reading: "わら",
    regex: true,
  },
];

export function activeSystemRules(
  off: readonly string[] | undefined,
): readonly SystemRule[] {
  return off?.length
    ? systemRules.filter((rule) => !off.includes(rule.id))
    : systemRules;
}
