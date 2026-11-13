import { awaitsText, type Book } from "@/features/books/book";
import {
  setOf,
  type Dictionary,
  type DictionaryEntry,
} from "@/features/dictionary/entries";
import { activeSystemRules } from "@/features/dictionary/system";
import { activeBrackets, type BracketVoices } from "./brackets";
import { paragraphSegments, type Segment } from "./segments";
import {
  movePosition,
  type Position,
  type Paragraph,
} from "@/features/books/paragraphs";

/** 「辞書なし」を表す 1 つの配列。章ごとに計算したものを使い回せるようにするため。 */
const noEntries: readonly DictionaryEntry[] = [];

/** 段落の読み方を決めるもの: 辞書とカッコ。 */
export interface Reading {
  rules: Dictionary;
  brackets: BracketVoices;
}

/**
 * ある位置で読み上げられるもの。それぞれ 1 つの声で読む区間として返す —
 * 読むものが残らなかった段落では空。段落がないところでは undefined。
 */
export function spokenAt(
  { rules, brackets }: Reading,
  book: Book | null,
  chapters: Paragraph[][],
  position: Position,
): Segment[] | undefined {
  const paragraphs = chapters[position.chapterIndex];
  return paragraphs?.[position.paragraphIndex] === undefined
    ? undefined
    : paragraphSegments(
        paragraphs,
        position.paragraphIndex,
        activeBrackets(brackets),
        setOf(rules, book?.id)?.entries ?? noEntries,
        rules.common,
        activeSystemRules(rules.systemOff),
      );
}

/**
 * ある方向で次に読む段落: 辞書によって読むものがなくなった段落は飛ばす。
 */
export function moveToSpoken(
  reading: Reading,
  book: Book | null,
  chapters: Paragraph[][],
  from: Position,
  direction: -1 | 1,
): Position | null {
  const waiting = (index: number) => awaitsText(book?.chapters[index]);
  let next = movePosition(chapters, from, direction, "paragraph", waiting);
  while (next && spokenAt(reading, book, chapters, next)?.length === 0) {
    next = movePosition(chapters, next, direction, "paragraph", waiting);
  }
  return next;
}
