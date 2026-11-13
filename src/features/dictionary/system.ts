import type { DictionaryEntry } from "./entries";

/** 組み込みのルール: 必ず正規表現で、何のためのものかが付く。 */
export interface SystemRule extends DictionaryEntry {
  regex: true;
  /** 変わらない名前。利用者がルールをオフにした選択を、この名前で保存する。 */
  id: string;
  /** 必ず付ける: パターンだけでは、ルールが何のためのものか分からない。 */
  description: string;
}

/** 文章を囲むだけの文字: 英字・数字・かなを含まない。 */
const ascii = "[!-~]";

/**
 * アプリが最初から持っているルール。全作品に、利用者自身のルール（必ず
 * そちらが勝つ）の後で適用される。どれも設定でオフにできる。直すのは、
 * 音声エンジンが文脈に関係なくうまく読めないもの: マークアップのような
 * 文字列と記号。文脈で変わる読み（一日: ついたち / いちにち）はここでは
 * 推測せず、エンジンと利用者の辞書に任せる。
 *
 * 空の読みは「読まない」。読むものが残らなかった段落は飛ばされる。
 */
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
    // 〇 は漢数字のゼロでもある（二〇二四年）ので、数字の隣では対象にしない。
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

/** オフにしたルールの id を受け取り、適用される組み込みルールを返す。 */
export function activeSystemRules(
  off: readonly string[] | undefined,
): readonly SystemRule[] {
  return off?.length
    ? systemRules.filter((rule) => !off.includes(rule.id))
    : systemRules;
}
