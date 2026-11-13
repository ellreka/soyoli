import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { isWebNovel, type Book } from "@/features/books/book";
import { removeFile } from "@/features/books/fileStore";
import { openSavedFile, savedFileBooks } from "@/features/books/import";
import type { HistoryItem } from "./history";
import { loadLibrary, saveLibrary } from "./libraryStorage";
import {
  inOrder,
  loadShelfOrder,
  saveShelfOrder,
  type ShelfEntry,
} from "./shelfOrder";
import {
  fromSavedWorks,
  toSavedWorks,
  withRead,
  type History,
  type LastRead,
} from "./savedWorks";

interface LibraryState {
  /** このセッションで知っているすべての作品。最近開いたものが先。 */
  books: Book[];
  /** 読者が本棚に入れた Web 小説の id。 */
  bookmarked: string[];
  /** 各 Web 小説で最後に読んだ話。 */
  lastRead: LastRead;
  /** 各 Web 小説を最後に読んだ時刻。本棚にあるかどうかは問わない。 */
  history: History;
  /**
   * どちらの種類でも、各作品を最後にビューアーで開いた時刻（ms）。履歴とは
   * 別: 作品を履歴から消しても、これは残る。
   */
  opened: Record<string, number>;
  /** 読み込み直すたびに増える。これをキーにした画像は読み込み直される。 */
  revision: number;
}

interface LibraryValue extends LibraryState {
  /** 本棚に出るもの: ファイル由来の作品と、ブックマークした Web 小説。 */
  shelf: Book[];
  /**
   * 端末に保存されているもの — ファイル由来の作品とそのタイトル・表紙 — を
   * 読み直す。本棚が実際の中身を見せていないとき（表紙が出なかったなど）の
   * ためのもの。
   */
  reload: () => void;
  /**
   * このセッションに作品を追加する、または置き換える。ファイルはすぐ本棚に
   * 入る。Web 小説は本棚になくても読め、ブックマークして初めて本棚に入る。
   * 新しい作品は先頭に来る。置き換えた作品（本文が届いた）は今の位置のまま:
   * 作品を動かすのは、開く操作だけ。
   */
  addBook: (book: Book) => void;
  isBookmarked: (bookId: string) => boolean;
  /**
   * Web 小説を本棚に入れる、または外す。ブックマークした作品は、メタ情報と
   * 最後に読んだ話を起動をまたいで覚えておく。
   */
  setBookmarked: (book: Book, on: boolean) => void;
  /** 読者が今いる話を記録する。 */
  markRead: (bookId: string, chapterId: string) => void;
  /**
   * 端末に保存した作品の本文を読む。本棚は、開くまで本文なしで作品を持って
   * いる。読める状態の本で resolve する。
   */
  loadFile: (bookId: string) => Promise<Book>;
  /** 端末に保存した作品を、ファイルごと削除する。 */
  removeFileBook: (bookId: string) => void;
  /**
   * 読んだ Web 小説。新しい順で、作品ごとに 1 行。読み直すと先頭に来る。
   */
  recent: HistoryItem[];
  /**
   * 作品を今ビューアーで開いたことを記録する: 本棚の先頭に来て、Web 小説
   * なら履歴の先頭にも来る。
   */
  markOpened: (bookId: string) => void;
  /** 作品を履歴から消す。本棚とその位置は残る。 */
  removeHistory: (bookId: string) => void;
  clearHistory: () => void;
}

const LibraryContext = createContext<LibraryValue | null>(null);

/** 作品を今ある位置に、新しければ先頭に入れる。 */
function upsert(books: Book[], book: Book): Book[] {
  return books.some((item) => item.id === book.id)
    ? books.map((item) => (item.id === book.id ? book : item))
    : [book, ...books];
}

/** 作品を先頭へ移す。すでに先頭なら同じ配列を返す。 */
function toFront(books: Book[], bookId: string): Book[] {
  const book = books.find((item) => item.id === bookId);
  return !book || books[0] === book
    ? books
    : [book, ...books.filter((item) => item !== book)];
}

/** 作品を今読んだ後の履歴。ファイル由来の作品は履歴に入らない。 */
function readNow(state: LibraryState, bookId: string): History {
  const book = state.books.find((item) => item.id === bookId);
  return book && isWebNovel(book)
    ? withRead(state.history, bookId, Date.now())
    : state.history;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>(() => {
    const saved = fromSavedWorks(loadLibrary());
    const order = loadShelfOrder();
    return {
      ...saved,
      // ファイル由来の作品は本文なしで戻ってくる。`loadFile` を参照。
      books: inOrder(
        [...saved.books, ...savedFileBooks()],
        order.map((entry) => entry.id),
      ),
      opened: Object.fromEntries(
        order.flatMap(({ id, openedAt }) =>
          openedAt === undefined ? [] : [[id, openedAt]],
        ),
      ),
      revision: 0,
    };
  });
  // 本棚と履歴のどちらかが変わるか、読む位置が動くたびに、その Web 小説を
  // 書き戻す。
  useEffect(() => {
    saveLibrary(
      toSavedWorks(
        state.books,
        state.lastRead,
        state.bookmarked,
        state.history,
      ),
    );
  }, [state.books, state.lastRead, state.bookmarked, state.history]);
  // 順番そのもの。別に持つ: 両方の種類の作品にまたがるため。今ある作品の
  // 分だけで、削除された作品は時刻ごと消える。
  const order = useMemo(
    () =>
      JSON.stringify(
        state.books.map((book): ShelfEntry => {
          const openedAt = state.opened[book.id];
          return openedAt === undefined
            ? { id: book.id }
            : { id: book.id, openedAt };
        }),
      ),
    [state.books, state.opened],
  );
  useEffect(() => {
    // SAFETY: この文字列は、すぐ上でシリアライズした entries そのもの。
    saveShelfOrder(JSON.parse(order) as ShelfEntry[]);
  }, [order]);

  function reload() {
    const kept = savedFileBooks();
    setState((current) => {
      // 本棚にある順のまま: ファイル由来の作品は、本棚に見せる情報（タイトル、
      // 著者、表紙）を端末から取り直し、開いてあれば本文を保つ。端末に
      // 保存されなくなったものは消え、本棚がまだ知らなかったものは加わる。
      const books = current.books.flatMap((item) => {
        if (!item.file) {
          return [item];
        }
        const saved = kept.find((other) => other.id === item.id);
        return saved ? [{ ...item, ...saved, chapters: item.chapters }] : [];
      });
      const added = kept.filter(
        (saved) => !current.books.some((item) => item.id === saved.id),
      );
      return {
        ...current,
        books: [...added, ...books],
        revision: current.revision + 1,
      };
    });
  }

  function addBook(book: Book) {
    setState((current) => ({ ...current, books: upsert(current.books, book) }));
  }

  function isBookmarked(bookId: string): boolean {
    return state.bookmarked.includes(bookId);
  }

  function setBookmarked(book: Book, on: boolean) {
    setState((current) => {
      if (current.bookmarked.includes(book.id) === on) {
        return current;
      }
      return {
        ...current,
        // ブラウザからのブックマークが、ライブラリがその作品を知る最初の機会に
        // なることがある。すでに開いている作品は、読み込み済みの話を保つ。
        books:
          on && !current.books.some((item) => item.id === book.id)
            ? upsert(current.books, book)
            : current.books,
        bookmarked: on
          ? [...current.bookmarked, book.id]
          : current.bookmarked.filter((id) => id !== book.id),
      };
    });
  }

  function markRead(bookId: string, chapterId: string) {
    setState((current) =>
      current.lastRead[bookId] === chapterId
        ? current
        : {
            ...current,
            lastRead: { ...current.lastRead, [bookId]: chapterId },
            history: readNow(current, bookId),
          },
    );
  }

  // markOpened と同じく安定させる: effect がこれに依存している。
  const loadFile = useCallback(async (bookId: string) => {
    const book = await openSavedFile(bookId);
    setState((current) => ({
      ...current,
      // その場で置き換える: 本文を読むことは「最近開いた」の意味に入らない。
      books: current.books.map((item) => (item.id === bookId ? book : item)),
    }));
    return book;
  }, []);

  function removeFileBook(bookId: string) {
    removeFile(bookId);
    setState((current) => ({
      ...current,
      books: current.books.filter((item) => item.id !== bookId),
    }));
  }

  // 安定させる: ビューアーが、これに依存する effect から呼ぶ。
  const markOpened = useCallback((bookId: string) => {
    setState((current) => {
      if (!current.books.some((item) => item.id === bookId)) {
        return current;
      }
      return {
        ...current,
        history: readNow(current, bookId),
        books: toFront(current.books, bookId),
        opened: { ...current.opened, [bookId]: Date.now() },
      };
    });
  }, []);

  function removeHistory(bookId: string) {
    setState((current) => {
      if (!(bookId in current.history)) {
        return current;
      }
      return {
        ...current,
        history: Object.fromEntries(
          Object.entries(current.history).filter(([id]) => id !== bookId),
        ),
      };
    });
  }

  function clearHistory() {
    setState((current) => ({ ...current, history: {} }));
  }

  const recent = state.books
    .flatMap((book) => {
      const readAt = state.history[book.id];
      return readAt === undefined ? [] : [{ book, readAt }];
    })
    .sort((a, b) => b.readAt - a.readAt);

  const shelf = state.books.filter(
    (book) => !isWebNovel(book) || state.bookmarked.includes(book.id),
  );

  return (
    <LibraryContext
      value={{
        ...state,
        shelf,
        reload,
        addBook,
        isBookmarked,
        setBookmarked,
        markRead,
        loadFile,
        removeFileBook,
        recent,
        markOpened,
        removeHistory,
        clearHistory,
      }}
    >
      {children}
    </LibraryContext>
  );
}

export function useLibrary() {
  const library = useContext(LibraryContext);
  if (!library) {
    throw new Error("LibraryProviderが必要です。");
  }
  return library;
}
