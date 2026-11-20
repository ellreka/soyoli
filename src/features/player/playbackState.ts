import type { Book } from "@/features/books/book";
import type { Paragraph, Position } from "@/features/books/paragraphs";
import type { SavedPlayback, SavedPosition } from "./storage";

export type PlaybackState = Position & {
  book: Book | null;
  chapters: Paragraph[][];
  playing: boolean;
};

export const nothingOpen: PlaybackState = {
  book: null,
  chapters: [],
  chapterIndex: 0,
  paragraphIndex: 0,
  playing: false,
};

export function restorePosition(
  book: Book,
  chapters: Paragraph[][],
  left: SavedPosition | undefined,
  legacy: SavedPlayback | null,
): Position {
  if (left) {
    const chapterIndex = book.chapters.findIndex(
      (chapter) => chapter.id === left.chapterId,
    );
    if (chapterIndex >= 0) {
      return {
        chapterIndex,
        paragraphIndex: chapters[chapterIndex][left.paragraphIndex]
          ? left.paragraphIndex
          : 0,
      };
    }
  }
  return legacy?.bookId === book.id &&
    chapters[legacy.chapterIndex]?.[legacy.paragraphIndex]
    ? {
        chapterIndex: legacy.chapterIndex,
        paragraphIndex: legacy.paragraphIndex,
      }
    : { chapterIndex: 0, paragraphIndex: 0 };
}

export function keepPosition(
  current: PlaybackState,
  book: Book,
  chapters: Paragraph[][],
  left: SavedPosition | undefined,
  askedFor: string | undefined,
): Position & { playing: boolean } {
  const currentId = current.book?.chapters[current.chapterIndex]?.id;
  const found = book.chapters.findIndex(
    (chapter) => chapter.id === (askedFor ?? currentId),
  );
  const chapterIndex =
    found >= 0
      ? found
      : Math.min(current.chapterIndex, Math.max(0, book.chapters.length - 1));
  const chapterId = book.chapters[chapterIndex]?.id;
  const saved =
    left?.chapterId === chapterId &&
    chapters[chapterIndex]?.[left.paragraphIndex]
      ? left.paragraphIndex
      : null;
  if (found >= 0 && chapterId !== currentId) {
    return { chapterIndex, paragraphIndex: saved ?? 0, playing: false };
  }
  const arrived =
    !current.chapters[current.chapterIndex]?.length && saved !== null;
  const paragraphIndex = arrived ? saved : current.paragraphIndex;
  return {
    chapterIndex,
    paragraphIndex:
      paragraphIndex === 0 || chapters[chapterIndex]?.[paragraphIndex]
        ? paragraphIndex
        : 0,
    playing: current.playing,
  };
}
