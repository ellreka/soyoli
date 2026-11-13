import { useEffect, useRef, useState } from "react";

import type { Book } from "@/features/books/book";
import { useLibrary } from "@/features/library/Library";
import { usePlayback } from "@/features/player/Playback";

type Playback = ReturnType<typeof usePlayback>;

/**
 * 開いている本。1 回の render より長く続く処理のためのもの: 取得は、
 * リクエストを出したときではなく、答えが届いたときにこれを求める。
 */
export interface OpenBook {
  /**
   * 開いている本。`replace` で加えた変更を、最後の render より後のものも
   * 含めてすべて反映している。2 つの取得（話と目次）が続けて終わることが
   * ある: 2 つ目は、1 つ目が残したものの上に積む。
   */
  current: () => Book | null;
  /** 最後の render 時点のプレーヤー: 読者がいる場所と、その操作。 */
  playback: () => Playback;
  /**
   * 開いている本を、変更したコピーに置き換える: 章の本文が届いた、または
   * 目次の続きが届いた。
   *
   * 同じ本は 2 か所で持たれている。ライブラリ（本棚とビューアーが見せる
   * もの）とプレーヤー（読み上げるもの）。両方に同じコピーを渡さなければ
   * ならず、それをするのはここだけ。プレーヤーは、その中での読者の位置を
   * 保つ（`keepPosition`）。
   */
  replace: (book: Book) => void;
}

export function useOpenBook(): OpenBook {
  const playback = usePlayback();
  const { addBook } = useLibrary();
  const latest = useRef({ playback, addBook, book: playback.state.book });
  useEffect(() => {
    latest.current = { playback, addBook, book: playback.state.book };
  });
  // コンポーネントが生きている間ずっと同じオブジェクト: effect が依存できる。
  const [open] = useState<OpenBook>(() => ({
    current: () => latest.current.book,
    playback: () => latest.current.playback,
    replace(book) {
      latest.current.book = book;
      latest.current.addBook(book);
      latest.current.playback.openBook(book);
    },
  }));
  return open;
}
