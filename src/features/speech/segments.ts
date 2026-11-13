import type { Paragraph } from "@/features/books/paragraphs";
import type { DictionaryEntry } from "@/features/dictionary/entries";
import type { BracketKind } from "./brackets";
import {
  chapterReplacements,
  paragraphReplacements,
  speechFor,
  type Replacement,
} from "./replacements";

/** 1 つの声で読む、段落の区間。 */
export interface Segment {
  speech: string;
  /** その区間が入っているカッコ。そのカッコに専用の声がある場合。 */
  bracket?: string;
}

/**
 * 専用の声を持つカッコが、文字列の中で開く位置と閉じる位置。カッコとして
 * 数えるのは、同じ段落の中で閉じているものだけ — 顔文字の単独の "(" は
 * 何も変えない — で、ルールやルビが置き換える部分の中にあるものは除く。
 */
function bracketMarks(
  text: string,
  replacements: readonly Replacement[],
  kinds: readonly BracketKind[],
): Map<number, string | null> {
  const opens = new Map<string, { id: string; close: string }>();
  for (const kind of kinds) {
    for (const [open, close] of kind.pairs) {
      opens.set(open, { id: kind.id, close });
    }
  }
  // 位置 → そこで開くカッコ。閉じる位置では null。
  const marks = new Map<number, string | null>();
  const open: { id: string; close: string; index: number }[] = [];
  let next = 0;
  for (let index = 0; index < text.length; index += 1) {
    const replaced = replacements[next];
    if (replaced && index >= replaced.start) {
      index = replaced.end - 1;
      next += 1;
      continue;
    }
    const character = text[index];
    let closes = open.length - 1;
    while (closes >= 0 && open[closes].close !== character) {
      closes -= 1;
    }
    if (closes >= 0) {
      // 内側で開いたまま閉じなかったものは、カッコではない。
      const [closed] = open.splice(closes);
      marks.set(closed.index, closed.id);
      marks.set(index, null);
      continue;
    }
    const opened = opens.get(character);
    if (opened) {
      open.push({ ...opened, index });
    }
  }
  return marks;
}

/**
 * 段落を、それぞれ 1 つの声で読む区間に分けたもの: 専用の声を持つカッコ
 * （`kinds`）の中身は独立した区間になり、カッコの文字そのものは読まれない。
 * 声のないカッコの中や、カッコに入れ子になったカッコの中では、周りの声が
 * 続く。そうしたカッコがなければ、段落は 1 つの区間で、`speechFor` が
 * 読むとおりに読まれる。
 */
export function speechSegments(
  paragraph: Paragraph,
  kinds: readonly BracketKind[],
  bookEntries: readonly DictionaryEntry[],
  commonEntries: readonly DictionaryEntry[],
  systemEntries: readonly DictionaryEntry[] = [],
  fixed: readonly Replacement[] = [],
): Segment[] {
  const text = paragraph.text;
  const replacements = kinds.length
    ? paragraphReplacements(
        paragraph,
        bookEntries,
        commonEntries,
        systemEntries,
        fixed,
      )
    : [];
  const marks = bracketMarks(text, replacements, kinds);
  if (!marks.size) {
    const speech = speechFor(
      paragraph,
      bookEntries,
      commonEntries,
      systemEntries,
      fixed,
    );
    return speech ? [{ speech }] : [];
  }
  const segments: Segment[] = [];
  const inside: string[] = [];
  let speech = "";
  function close(): void {
    const bracket = inside[inside.length - 1] as string | undefined;
    const last = segments[segments.length - 1] as Segment | undefined;
    const spoken = speech.trim();
    speech = "";
    if (!spoken) {
      return;
    }
    // 同じ声の区間が、間に読むものを挟まずに続くなら、1 つにする。
    if (last && last.bracket === bracket) {
      last.speech += spoken;
    } else {
      segments.push({ speech: spoken, ...(bracket && { bracket }) });
    }
  }
  let next = 0;
  for (let index = 0; index < text.length; index += 1) {
    const replaced = replacements[next];
    if (replaced && index >= replaced.start) {
      speech += replaced.reading;
      index = replaced.end - 1;
      next += 1;
      continue;
    }
    const mark = marks.get(index);
    if (mark === undefined) {
      speech += text[index];
      continue;
    }
    close();
    if (mark === null) {
      inside.pop();
    } else {
      inside.push(mark);
    }
  }
  close();
  return segments;
}

/** 章の 1 段落を、すべてのルールを通して、読む区間に分けたもの。 */
export function paragraphSegments(
  paragraphs: readonly Paragraph[],
  index: number,
  kinds: readonly BracketKind[],
  bookEntries: readonly DictionaryEntry[],
  commonEntries: readonly DictionaryEntry[],
  systemEntries: readonly DictionaryEntry[] = [],
): Segment[] {
  return speechSegments(
    paragraphs[index],
    kinds,
    bookEntries,
    commonEntries,
    systemEntries,
    chapterReplacements(paragraphs, bookEntries, commonEntries)?.[index],
  );
}
