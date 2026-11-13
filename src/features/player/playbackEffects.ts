import { useCallback, useEffect, useRef } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import type { Book } from "@/features/books/book";
import { playPageTurn } from "./pageSound";
import type { PlaybackState } from "./playbackState";
import type { PlaybackSettings } from "./settings";
import {
  savePlayback,
  savedPositions,
  type SavedPlayback,
  type SavedPosition,
} from "./storage";

const keepAwakeTag = "reading-aloud";

/**
 * 読者が各本を読みかけた位置。間にほかの本を読んだ後でも、本棚から開き
 * 直せばそこから再開できる。位置は開いている本の動きに追従し、最後の
 * 変更の少し後に、音声設定と一緒に保存される。
 */
export function useSavedPositions(
  state: PlaybackState,
  settings: PlaybackSettings,
  /** 前回のセッションが残したもの: 出発点になる位置。 */
  saved: SavedPlayback | null,
): () => Record<string, SavedPosition> {
  const positions = useRef<Record<string, SavedPosition> | null>(null);
  const positionsOf = useCallback((): Record<string, SavedPosition> => {
    positions.current ??= savedPositions(saved);
    return positions.current;
  }, [saved]);
  // 開いている本の中の位置を、動くたびに覚える。
  useEffect(() => {
    const chapter = state.book?.chapters[state.chapterIndex];
    if (!state.book || !chapter) {
      return;
    }
    const known = positionsOf()[state.book.id];
    // まだ取得中の話には段落がない: その話のために保存されている位置は
    // 再開する場所であって、先頭で上書きするものではない。
    if (
      known?.chapterId === chapter.id &&
      !state.chapters[state.chapterIndex]?.length
    ) {
      return;
    }
    positionsOf()[state.book.id] = {
      chapterId: chapter.id,
      paragraphIndex: state.paragraphIndex,
    };
  }, [
    state.book,
    state.chapters,
    state.chapterIndex,
    state.paragraphIndex,
    positionsOf,
  ]);
  // 読む位置と音声設定を、デバウンスして永続化する。
  useEffect(() => {
    const pending = setTimeout(() => {
      savePlayback({
        bookId: state.book?.id ?? null,
        chapterIndex: state.chapterIndex,
        paragraphIndex: state.paragraphIndex,
        positions: positionsOf(),
        ...settings,
      });
    }, 1000);
    return () => {
      clearTimeout(pending);
    };
  }, [
    state.book,
    state.chapterIndex,
    state.paragraphIndex,
    settings,
    positionsOf,
  ]);
  return positionsOf;
}

/**
 * 同じ本の後ろの章へ読み進めると、ページをめくる音がする。数えるのは
 * その移動だけで、返された関数を呼ぶことでそれを伝える: ほかの理由で
 * 位置が変わったとき（起動時に本を読みかけの位置へ戻す、読者自身の移動、
 * 目次、シークバー）は鳴らない。
 */
export function usePageTurn(
  book: Book | null,
  chapterIndex: number,
  enabled: boolean,
): () => void {
  const stepped = useRef(false);
  const markStepped = useCallback(() => {
    stepped.current = true;
  }, []);
  const turned = useRef<{ book: Book | null; chapterIndex: number } | null>(
    null,
  );
  useEffect(() => {
    const before = turned.current;
    turned.current = { book, chapterIndex };
    const byStep = stepped.current;
    stepped.current = false;
    if (
      byStep &&
      enabled &&
      before?.book &&
      before.book.id === book?.id &&
      chapterIndex > before.chapterIndex
    ) {
      playPageTurn();
    }
  }, [book, chapterIndex, enabled]);
  return markStepped;
}

/**
 * `awake` の間、画面を点けたままにする。点けたままにするのは読み上げ中だけ:
 * 一時停止、スリープタイマー、本の終わりのどれでも、端末自身のタイムアウトに
 * 戻す。
 */
export function useKeepAwake(awake: boolean): void {
  useEffect(() => {
    if (!awake) {
      return;
    }
    const ignore = () => {
      /* ここでは使えない（一部のブラウザ）: 画面はいつもどおり消えるだけ。 */
    };
    activateKeepAwakeAsync(keepAwakeTag).catch(ignore);
    return () => {
      deactivateKeepAwake(keepAwakeTag).catch(ignore);
    };
  }, [awake]);
}
