import { mayBeEpisodeUrl } from "@/features/web/episode";
import {
  isWebNovel,
  isWebSource,
  type Book,
  type Chapter,
  type WebSource,
} from "@/features/books/book";

export interface SavedWork {
  id: string;
  source: WebSource;
  title: string;
  author: string;
  episode: { id: string; title: string; url: string };
  readAt?: number;
  bookmarked?: false;
}

export type History = Record<string, number>;

export const historyLimit = 100;

export function withRead(
  history: History,
  bookId: string,
  time: number,
): History {
  const entries = Object.entries({ ...history, [bookId]: time })
    .sort((a, b) => b[1] - a[1])
    .slice(0, historyLimit);
  return Object.fromEntries(entries);
}

export type LastRead = Record<string, string>;

export interface Works {
  books: Book[];
  lastRead: LastRead;
  bookmarked: string[];
  history: History;
}

export function lastReadChapter(
  book: Book,
  lastRead: LastRead,
): Chapter | undefined {
  const marked = book.chapters.find((item) => item.id === lastRead[book.id]);
  if (marked?.url) {
    return marked;
  }
  return book.chapters.find((item) => item.url && item.url === book.url);
}

export function toSavedWorks(
  books: Book[],
  lastRead: LastRead,
  bookmarked: readonly string[],
  history: History = {},
): SavedWork[] {
  const works: SavedWork[] = [];
  for (const book of books) {
    const episode = lastReadChapter(book, lastRead);
    const onShelf = bookmarked.includes(book.id);
    const readAt = history[book.id];
    if (
      !isWebNovel(book) ||
      (!onShelf && readAt === undefined) ||
      !episode?.url
    ) {
      continue;
    }
    works.push({
      id: book.id,
      source: book.source,
      title: book.title,
      author: book.author,
      episode: { id: episode.id, title: episode.title, url: episode.url },
      ...(readAt === undefined ? {} : { readAt }),
      ...(onShelf ? {} : { bookmarked: false as const }),
    });
  }
  return works;
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function toSavedWork(value: unknown): SavedWork | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const { id, source, title, author, episode, readAt, bookmarked } =
    value as Record<string, unknown>;
  if (!episode || typeof episode !== "object") {
    return null;
  }
  const last = episode as Record<string, unknown>;
  if (
    !isText(id) ||
    !isWebSource(source) ||
    !isText(title) ||
    typeof author !== "string" ||
    !isText(last.id) ||
    !isText(last.title) ||
    !isText(last.url) ||
    !mayBeEpisodeUrl(last.url)
  ) {
    return null;
  }
  const read =
    typeof readAt === "number" && Number.isFinite(readAt) ? readAt : undefined;
  if (bookmarked === false && read === undefined) {
    return null;
  }
  return {
    id,
    source,
    title,
    author,
    episode: { id: last.id, title: last.title, url: last.url },
    ...(read === undefined ? {} : { readAt: read }),
    ...(bookmarked === false ? { bookmarked: false as const } : {}),
  };
}

export function fromSavedWorks(value: unknown): Works {
  const books: Book[] = [];
  const lastRead: LastRead = {};
  const bookmarked: string[] = [];
  const history: History = {};
  for (const item of Array.isArray(value) ? value : []) {
    const work = toSavedWork(item);
    if (!work || books.some((book) => book.id === work.id)) {
      continue;
    }
    books.push({
      id: work.id,
      source: work.source,
      title: work.title,
      author: work.author,
      url: work.episode.url,
      chapters: [{ ...work.episode, content: [] }],
    });
    lastRead[work.id] = work.episode.id;
    if (work.bookmarked !== false) {
      bookmarked.push(work.id);
    }
    if (work.readAt !== undefined) {
      history[work.id] = work.readAt;
    }
  }
  return { books, lastRead, bookmarked, history };
}

export function takesProgress(
  current: Works,
  incoming: Works,
  bookId: string,
  openId?: string | null,
): boolean {
  if (!current.books.some((book) => book.id === bookId)) {
    return true;
  }
  const readAt = incoming.history[bookId];
  return (
    bookId !== openId &&
    readAt !== undefined &&
    readAt > (current.history[bookId] ?? -Infinity)
  );
}

export function mergeWorks(
  current: Works,
  incoming: Works,
  openId?: string | null,
): Works {
  let books = current.books;
  const added: Book[] = [];
  const lastRead = { ...current.lastRead };
  const history = { ...current.history };
  const bookmarked = [...current.bookmarked];
  for (const book of incoming.books) {
    const known = current.books.find((item) => item.id === book.id);
    if (known && !isWebNovel(known)) {
      continue;
    }
    if (
      incoming.bookmarked.includes(book.id) &&
      !bookmarked.includes(book.id)
    ) {
      bookmarked.push(book.id);
    }
    if (!takesProgress(current, incoming, book.id, openId)) {
      continue;
    }
    const episode = incoming.lastRead[book.id];
    if (!known) {
      added.push(book);
    } else if (known.chapters.every((chapter) => !chapter.content.length)) {
      books = books.map((item) => (item === known ? book : item));
    } else if (!known.chapters.some((chapter) => chapter.id === episode)) {
      continue;
    }
    lastRead[book.id] = episode;
    const readAt = incoming.history[book.id];
    if (readAt !== undefined) {
      history[book.id] = readAt;
    }
  }
  return {
    books: [...added, ...books],
    lastRead,
    bookmarked,
    history: Object.fromEntries(
      Object.entries(history)
        .sort((a, b) => b[1] - a[1])
        .slice(0, historyLimit),
    ),
  };
}
