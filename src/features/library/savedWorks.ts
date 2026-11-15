import { mayBeEpisodeUrl } from "@/features/web/episode";
import {
  isWebNovel,
  isWebSource,
  type Book,
  type Chapter,
  type WebSource,
} from "@/features/books/book";

/**
 * 起動をまたいで Web 小説について保存するもの。本棚にあるものも、読書履歴に
 * あるものも同じ: メタ情報と最後に読んだ話で、本文は決して保存しない。
 * 話は、作品を開いたときに取得し直す。
 */
export interface SavedWork {
  id: string;
  source: WebSource;
  title: string;
  author: string;
  episode: { id: string; title: string; url: string };
  /** 作品を最後に読んだ時刻（ms）。履歴から消えると、なくなる。 */
  readAt?: number;
  /** 履歴のためだけに保存している作品では false と書く。 */
  bookmarked?: false;
}

/** 読書履歴の各作品を最後に読んだ時刻（ms）。本の id ごと。 */
export type History = Record<string, number>;

/** 履歴に入る作品の数。古いものから落ちる。 */
export const historyLimit = 100;

/** 作品を `time` に読んだことを加えた履歴。新しいものだけに切り詰める。 */
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

/** 最後に読んだ話の章 id。本の id ごと。 */
export type LastRead = Record<string, string>;

/** Web 小説と、それぞれについて覚えていること。 */
export interface Works {
  books: Book[];
  lastRead: LastRead;
  /** 本棚にある作品の id。履歴ができる前のファイルには、これしかない。 */
  bookmarked: string[];
  history: History;
}

/** Web 小説で最後に読んだ話。なければ、追加したときの話。 */
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

/**
 * 本棚か履歴にある Web 小説を、ディスクに書く形にしたもの。
 */
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
    // URL は開くときに取得される: 対応サイトのページだけを受け付ける。
    !isText(last.url) ||
    !mayBeEpisodeUrl(last.url)
  ) {
    return null;
  }
  const read =
    typeof readAt === "number" && Number.isFinite(readAt) ? readAt : undefined;
  // 本棚にも履歴にも残さないもの: 復元する理由がない。
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

/**
 * 保存した作品を本にする。どれも最後に読んだ話だけを持ち、本文はまだない。
 * ファイルの中の壊れたものは落とす。
 */
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

/**
 * 取り込む作品の読みかけ（最後に読んだ話とその中の位置）を採るかどうか。
 * 端末にない作品は採る。ある作品は、取り込む側のほうが後に読まれていれば
 * 採る。開いている作品（`openId`）は今読んでいるものなので、採らない。
 */
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

/**
 * 端末の作品に、バックアップの作品（`incoming`）を足したもの。端末にしか
 * ない作品は残る。両方にある作品は本棚に入り、読みかけは `takesProgress`
 * が選んだ側のものになる。
 */
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
    // 同じ id のファイル由来の作品: 別のものなので触らない。
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
      // まだ本文を持っていない: 取り込む側の話で置き換えても失うものがない。
      books = books.map((item) => (item === known ? book : item));
    } else if (!known.chapters.some((chapter) => chapter.id === episode)) {
      // 読み込み済みの話の中に、その話がない: 今のままにする。
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
