import { isEmphasisReading, type Paragraph } from "@/features/books/paragraphs";
import {
  buildPattern,
  type DictionaryEntry,
} from "@/features/dictionary/entries";

/** 段落の文字の一部（オフセットで指す）と、そこで読まれるもの。 */
export interface Replacement {
  start: number;
  end: number;
  reading: string;
}

/**
 * コンパイル済みのパターン。フラグとソースごと。コンパイルできないものは
 * null。
 */
const patterns = new Map<string, RegExp | null>();

function compile(source: string, multiline: boolean): RegExp | null {
  // sticky: 一致は 1 つの位置で試す。プレーンな文字列と同じ。
  const flags = multiline ? "muy" : "uy";
  const key = `${flags}/${source}`;
  let pattern = patterns.get(key);
  if (pattern === undefined) {
    const built = buildPattern(source, flags);
    pattern = built instanceof Error ? null : built;
    patterns.set(key, pattern);
  }
  return pattern;
}

/**
 * 正規表現ルールの読みに、一致から `$` 参照を埋めたもの。
 * `String.prototype.replace` と同じ: `$$`、`$&`、`$1`–`$99`、`$<name>`。
 * 存在しないグループへの参照は、書かれたとおりに残す。
 */
export function expandReading(reading: string, match: RegExpExecArray): string {
  return reading.replace(
    /\$(?:(\$)|(&)|(\d\d?)|<([^>]*)>)/g,
    (whole, dollar?: string, all?: string, digits?: string, name?: string) => {
      if (dollar) {
        return "$";
      }
      if (all) {
        return match[0];
      }
      if (digits !== undefined) {
        // グループ 12 がなければ、"$12" はグループ 1 と文字 "2" になる。
        const two = Number(digits);
        if (two > 0 && two < match.length) {
          return match[two] ?? "";
        }
        const one = Number(digits[0]);
        if (digits.length === 2 && one > 0 && one < match.length) {
          return (match[one] ?? "") + digits.slice(1);
        }
        return whole;
      }
      const groups = match.groups;
      return groups && name !== undefined && name in groups
        ? (groups[name] ?? "")
        : whole;
    },
  );
}

/** `index` から一致が始まるとき、ルールが置き換えるもの。一致すれば。 */
function matchAt(
  entry: DictionaryEntry,
  text: string,
  index: number,
): Replacement | null {
  if (entry.off) {
    return null;
  }
  if (!entry.regex) {
    return text.startsWith(entry.surface, index)
      ? {
          start: index,
          end: index + entry.surface.length,
          reading: entry.reading,
        }
      : null;
  }
  const pattern = compile(entry.surface, entry.multiline === true);
  if (!pattern) {
    return null;
  }
  pattern.lastIndex = index;
  const match = pattern.exec(text);
  // 空の一致は何も置き換えず、その位置で進まなくなる。
  if (!match || match[0].length === 0) {
    return null;
  }
  return {
    start: index,
    end: index + match[0].length,
    reading: expandReading(entry.reading, match),
  };
}

/** 文字列の各部分を、ルールが取ったものとして印を付ける。1 か所につきルールは 1 つだけ。 */
function replacer(text: string) {
  const taken = Array.from({ length: text.length }, () => false);
  const replacements: Replacement[] = [];
  function free(start: number, end: number): boolean {
    for (let index = start; index < end; index += 1) {
      if (taken[index]) {
        return false;
      }
    }
    return true;
  }
  function take(start: number, end: number, reading: string): void {
    taken.fill(true, start, end);
    replacements.push({ start, end, reading });
  }
  /** 段落をまたいで照合するルール（またはそうでないルール）を適用する。 */
  function apply(
    entries: readonly DictionaryEntry[],
    multiline: boolean,
  ): void {
    const rules = entries.filter(
      (entry) => !entry.off && Boolean(entry.multiline) === multiline,
    );
    if (!rules.length) {
      return;
    }
    for (let index = 0; index < text.length; index += 1) {
      if (taken[index]) {
        continue;
      }
      let best: Replacement | null = null;
      for (const entry of rules) {
        const found = matchAt(entry, text, index);
        // 同じ長さなら、先に並んでいるルールが勝つ。
        if (
          found &&
          (!best || found.end > best.end) &&
          free(index, found.end)
        ) {
          best = found;
        }
      }
      if (best) {
        take(best.start, best.end, best.reading);
        index = best.end - 1;
      }
    }
  }
  return { replacements, free, take, apply };
}

function spansParagraphs(entries: readonly DictionaryEntry[]): boolean {
  return entries.some((entry) => entry.multiline && !entry.off);
}

/** 最後に計算した章。再生は段落を 1 つずつ順に尋ねてくる。 */
let lastChapter: {
  paragraphs: readonly Paragraph[];
  bookEntries: readonly DictionaryEntry[];
  commonEntries: readonly DictionaryEntry[];
  result: readonly (readonly Replacement[])[];
} | null = null;

/**
 * 段落をまたいで照合するルール（`multiline`）が章の中で決めるものを、
 * 段落ごとに返す — そうしたルールがなければ null。章の段落を改行で
 * つないだものに対して照合し、作品の辞書が全作品共通の辞書より先、
 * 長い一致が先。いくつかの段落にまたがる一致の読みは、それが始まる段落に
 * 入り、覆っている残りの部分は読まれない。
 */
export function chapterReplacements(
  paragraphs: readonly Paragraph[],
  bookEntries: readonly DictionaryEntry[],
  commonEntries: readonly DictionaryEntry[],
): readonly (readonly Replacement[])[] | null {
  if (!spansParagraphs(bookEntries) && !spansParagraphs(commonEntries)) {
    return null;
  }
  if (
    lastChapter?.paragraphs === paragraphs &&
    lastChapter.bookEntries === bookEntries &&
    lastChapter.commonEntries === commonEntries
  ) {
    return lastChapter.result;
  }
  const chapter = replacer(
    paragraphs.map((paragraph) => paragraph.text).join("\n"),
  );
  chapter.apply(bookEntries, true);
  chapter.apply(commonEntries, true);
  const result: Replacement[][] = paragraphs.map(() => []);
  const found = chapter.replacements.sort((a, b) => a.start - b.start);
  let cursor = 0;
  let offset = 0;
  for (const [index, paragraph] of paragraphs.entries()) {
    const end = offset + paragraph.text.length;
    // 後ろの段落で終わる一致は、その段落のためにカーソルにとどまる。
    while (cursor < found.length && found[cursor].start < end) {
      const item = found[cursor];
      const start = Math.max(item.start, offset);
      if (Math.min(item.end, end) > start) {
        result[index].push({
          start: start - offset,
          end: Math.min(item.end, end) - offset,
          // 読むのは一度だけ。一致が始まるところで。
          reading: item.start >= offset - 1 ? item.reading : "",
        });
      }
      if (item.end > end) {
        break;
      }
      cursor += 1;
    }
    offset = end + 1;
  }
  lastChapter = { paragraphs, bookEntries, commonEntries, result };
  return result;
}

/**
 * 段落について読み上げられるもの。ルールは次の順に適用され、あるルールが
 * 取った部分に、次のルールは手を付けない: 段落をまたいで照合するルールが
 * 決めたもの（`fixed`、`chapterReplacements` から）、作品の辞書のルール、
 * 本文に書かれたルビ、全作品共通のルール、最後にアプリ自身のルール
 * （`systemRules`）。1 組のルールの中では、プレーンな文字列でも正規表現
 * （表示される文字に対して照合し、ルビの読みは含めない）でも、長い一致が
 * 勝つ。表示される文字は決して変えない。
 */
export function speechFor(
  paragraph: Paragraph,
  bookEntries: readonly DictionaryEntry[],
  commonEntries: readonly DictionaryEntry[],
  systemEntries: readonly DictionaryEntry[] = [],
  fixed: readonly Replacement[] = [],
): string {
  if (
    !bookEntries.length &&
    !commonEntries.length &&
    !systemEntries.length &&
    !fixed.length
  ) {
    return paragraph.speech;
  }
  const text = paragraph.text;
  let speech = "";
  let cursor = 0;
  for (const item of paragraphReplacements(
    paragraph,
    bookEntries,
    commonEntries,
    systemEntries,
    fixed,
  )) {
    speech += text.slice(cursor, item.start) + item.reading;
    cursor = item.end;
  }
  return (speech + text.slice(cursor)).trim();
}

/** ルールとルビが置き換える段落の部分。本文の順。 */
export function paragraphReplacements(
  paragraph: Paragraph,
  bookEntries: readonly DictionaryEntry[],
  commonEntries: readonly DictionaryEntry[],
  systemEntries: readonly DictionaryEntry[],
  fixed: readonly Replacement[],
): Replacement[] {
  const { replacements, free, take, apply } = replacer(paragraph.text);
  for (const item of fixed) {
    take(item.start, item.end, item.reading);
  }
  apply(bookEntries, false);
  for (const annotation of paragraph.ruby ?? []) {
    const end = annotation.start + annotation.length;
    // ルビとして書かれた傍点は読みではない: 本文のほうを読む。
    if (!isEmphasisReading(annotation.reading) && free(annotation.start, end)) {
      take(annotation.start, end, annotation.reading);
    }
  }
  apply(commonEntries, false);
  apply(systemEntries, false);
  return replacements.sort((a, b) => a.start - b.start);
}
