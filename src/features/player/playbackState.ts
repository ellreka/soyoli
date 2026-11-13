import type { Book } from "@/features/books/book";
import type { Paragraph, Position } from "@/features/books/paragraphs";
import type { SavedPlayback, SavedPosition } from "./storage";

/**
 * 読んでいるもの: 段落にした開いている本、その中で読者がいる場所、
 * 読み上げ中かどうか。どう読むかは別で、設定にある。
 */
export type PlaybackState = Position & {
  book: Book | null;
  /** 本の各章の段落。章のインデックスごと。 */
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

/**
 * 本を開く位置: 読者が読みかけた章と段落。まだ取得していない話は先頭で
 * 開き、その段落は本文が届いたときに反映される。
 */
export function restorePosition(
  book: Book,
  chapters: Paragraph[][],
  left: SavedPosition | undefined,
  /** 前回のセッションが残したもの。`positions` より前のファイル用。 */
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
  // 位置を本ごとに保存するようになる前に書かれたファイル。
  return legacy?.bookId === book.id &&
    chapters[legacy.chapterIndex]?.[legacy.paragraphIndex]
    ? {
        chapterIndex: legacy.chapterIndex,
        paragraphIndex: legacy.paragraphIndex,
      }
    : { chapterIndex: 0, paragraphIndex: 0 };
}

/**
 * 開いている間にオブジェクトが置き換えられた本の中での位置。読者は同じ章に
 * とどまる — 目次の続きを取り込むとインデックスがずれるので、id で探す —
 * か、指定された章へ移る。
 */
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
  // なくなった行（展開された「次の100話」の目印）は、インデックスを保つ。
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
    // 別の章で開いた: 意図した移動で、読み上げは止まる。
    return { chapterIndex, paragraphIndex: saved ?? 0, playing: false };
  }
  // 待っていた話の本文が届いた: その話のために保存されていた段落から
  // 再開する。
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
