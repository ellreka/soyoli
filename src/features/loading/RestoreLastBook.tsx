import { useEffect, useRef } from "react";

import { useLibrary } from "@/features/library/Library";
import { usePlayback } from "@/features/player/Playback";

/**
 * 最後に開いた本を、起動時にプレーヤーへ戻す。起動直後からミニプレーヤーで
 * 「続きから」を出せるようにするため。再生は一時停止のままで、保存された
 * 位置は openBook が戻す。Web 小説は最後に読んだ話で戻り、その本文は
 * チャプターローダーが取得する。
 */
export function RestoreLastBook(): null {
  const { books, loadFile } = useLibrary();
  const { state, lastBookId, openBook } = usePlayback();
  const done = useRef(false);

  useEffect(() => {
    // 本棚は一度に全部そろう: 1 回で足りる。
    if (done.current) {
      return;
    }
    done.current = true;
    if (state.book) {
      return;
    }
    const book = books.find((item) => item.id === lastBookId);
    if (book?.file && book.chapters.length === 0) {
      // 端末に保存した作品は、ファイルを読むまで本文がない。ファイルを
      // 読めなければ、続きを読むものが単にないだけ。
      loadFile(book.id).then(openBook, () => undefined);
    } else if (book) {
      openBook(book);
    }
  }, [books, state.book, lastBookId, openBook, loadFile]);

  return null;
}
