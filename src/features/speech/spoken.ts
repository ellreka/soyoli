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

const noEntries: readonly DictionaryEntry[] = [];

export interface Reading {
  rules: Dictionary;
  brackets: BracketVoices;
}

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
