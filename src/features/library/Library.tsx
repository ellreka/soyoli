import { createContext, useCallback, useContext, type ReactNode } from "react";

import { isWebNovel, type Book } from "@/features/books/book";
import { removeFile } from "@/features/books/fileStore";
import { openSavedFile, savedFileBooks } from "@/features/books/import";
import type { HistoryItem } from "./history";
import { createStore, useStore } from "@/lib/store";
import { loadLibrary, saveLibrary } from "./libraryStorage";
import {
  inOrder,
  loadShelfOrder,
  saveShelfOrder,
  type ShelfEntry,
} from "./shelfOrder";
import {
  fromSavedWorks,
  mergeWorks,
  toSavedWorks,
  withRead,
  type History,
  type LastRead,
  type Works,
} from "./savedWorks";

interface LibraryState {
  books: Book[];
  bookmarked: string[];
  lastRead: LastRead;
  history: History;
  opened: Record<string, number>;
  revision: number;
}

interface LibraryValue extends LibraryState {
  shelf: Book[];
  reload: () => void;
  addBook: (book: Book) => void;
  isBookmarked: (bookId: string) => boolean;
  setBookmarked: (book: Book, on: boolean) => void;
  markRead: (bookId: string, chapterId: string) => void;
  bookById: (bookId: string) => Book | undefined;
  loadFile: (bookId: string) => Promise<Book>;
  removeFileBook: (bookId: string) => void;
  recent: HistoryItem[];
  markOpened: (bookId: string) => void;
  removeHistory: (bookId: string) => void;
  clearHistory: () => void;
  mergeSaved: (incoming: Works, openId?: string | null) => void;
}

const LibraryContext = createContext<LibraryValue | null>(null);

function upsert(books: Book[], book: Book): Book[] {
  return books.some((item) => item.id === book.id)
    ? books.map((item) => (item.id === book.id ? book : item))
    : [book, ...books];
}

function toFront(books: Book[], bookId: string): Book[] {
  const book = books.find((item) => item.id === bookId);
  return !book || books[0] === book
    ? books
    : [book, ...books.filter((item) => item !== book)];
}

function readNow(state: LibraryState, bookId: string): History {
  const book = state.books.find((item) => item.id === bookId);
  return book && isWebNovel(book)
    ? withRead(state.history, bookId, Date.now())
    : state.history;
}

function loadLibraryState(): LibraryState {
  const saved = fromSavedWorks(loadLibrary());
  const order = loadShelfOrder();
  return {
    ...saved,
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
}

function shelfOrder(state: LibraryState): ShelfEntry[] {
  return state.books.map((book): ShelfEntry => {
    const openedAt = state.opened[book.id];
    return openedAt === undefined ? { id: book.id } : { id: book.id, openedAt };
  });
}

function savesWorks(next: LibraryState, previous: LibraryState): boolean {
  return (
    next.books !== previous.books ||
    next.lastRead !== previous.lastRead ||
    next.bookmarked !== previous.bookmarked ||
    next.history !== previous.history
  );
}

function saveChanges(next: LibraryState, previous: LibraryState): void {
  if (savesWorks(next, previous)) {
    saveLibrary(
      toSavedWorks(next.books, next.lastRead, next.bookmarked, next.history),
    );
  }
  const order = shelfOrder(next);
  if (JSON.stringify(order) !== JSON.stringify(shelfOrder(previous))) {
    saveShelfOrder(order);
  }
}

function withChapterRead(
  current: LibraryState,
  bookId: string,
  chapterId: string,
): LibraryState {
  return current.lastRead[bookId] === chapterId
    ? current
    : {
        ...current,
        lastRead: { ...current.lastRead, [bookId]: chapterId },
        history: readNow(current, bookId),
      };
}

function createLibraryStore() {
  const store = createStore(loadLibraryState(), saveChanges);
  return {
    ...store,
    markRead: (bookId: string, chapterId: string): void => {
      store.update((current) => withChapterRead(current, bookId, chapterId));
    },
    bookById: (bookId: string): Book | undefined =>
      store.get().books.find((book) => book.id === bookId),
  };
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState, store] = useStore(createLibraryStore);

  function reload() {
    const kept = savedFileBooks();
    setState((current) => {
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

  const loadFile = useCallback(
    async (bookId: string) => {
      const book = await openSavedFile(bookId);
      setState((current) => ({
        ...current,
        books: current.books.map((item) => (item.id === bookId ? book : item)),
      }));
      return book;
    },
    [setState],
  );

  function removeFileBook(bookId: string) {
    removeFile(bookId);
    setState((current) => ({
      ...current,
      books: current.books.filter((item) => item.id !== bookId),
    }));
  }

  const markOpened = useCallback(
    (bookId: string) => {
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
    },
    [setState],
  );

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

  function mergeSaved(incoming: Works, openId?: string | null) {
    setState((current) => ({
      ...current,
      ...mergeWorks(current, incoming, openId),
    }));
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
        markRead: store.markRead,
        bookById: store.bookById,
        loadFile,
        removeFileBook,
        recent,
        markOpened,
        removeHistory,
        clearHistory,
        mergeSaved,
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
