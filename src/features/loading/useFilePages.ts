import { useEffect } from "react";

import type { Book } from "@/features/books/book";
import { fileUri } from "@/features/books/fileStore";
import { readPdfPages } from "@/features/books/pdf";
import { usePlayback } from "@/features/player/Playback";
import type { OpenBook } from "./useOpenBook";

/**
 * ページの連なりであるファイルの章（PDF）は、開くまで本文がない。再生が
 * そうした章に来たらページを読み、位置を保ったまま本文を差し込む — Web
 * 小説の話を取得するのと同じやり方で、同じくビューアーを閉じていても動く。
 * 読むには少し時間がかかる。結果は、そのときに開いているもの（`open`）に
 * 反映する。
 */
export function useFilePages(open: OpenBook): void {
  const playback = usePlayback();
  const book = playback.state.book;
  const chapter = book?.chapters[playback.state.chapterIndex];
  const waiting =
    book?.file && chapter?.pages && chapter.content.length === 0
      ? chapter
      : undefined;
  const bookId = book?.id;
  const file = book?.file;
  const chapterId = waiting?.id;
  const from = waiting?.pages?.from;
  const count = waiting?.pages?.count;

  useEffect(() => {
    if (!bookId || !file || !chapterId || from === undefined || !count) {
      return;
    }
    const request = new AbortController();
    /** 章の本文を入れる。内容がなければ、本文のない章として印を付ける。 */
    function apply(content: Book["chapters"][number]["content"]): void {
      const now = open.playback();
      const current = open.current();
      if (request.signal.aborted || !current || current.id !== bookId) {
        return;
      }
      const index = current.chapters.findIndex((item) => item.id === chapterId);
      const updated: Book = {
        ...current,
        chapters: current.chapters.map((item) =>
          item.id === chapterId
            ? // `pages` がなければ、空の章をもう一度待つことはない:
              // 画像だけのページのように、本文のない章として表示される。
              {
                ...item,
                content,
                pages: content.length ? item.pages : undefined,
              }
            : item,
        ),
      };
      open.replace(updated);
      if (content.length || !now.state.playing) {
        return;
      }
      // 読み上げがこのページを待っていたが、読むものがなかった: 先へ進む。
      // 本の終わりなら止まる。
      if (index >= 0 && index < current.chapters.length - 1) {
        now.step(1, "chapter");
      } else {
        now.pause();
      }
    }
    readPdfPages(fileUri(file), { from, count }).then(apply, () => {
      if (!request.signal.aborted) {
        open.playback().pause();
        apply([]);
      }
    });
    return () => {
      request.abort();
    };
  }, [bookId, file, chapterId, from, count, open]);
}
