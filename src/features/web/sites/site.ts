import type { Chapter, ContentNode, WebSource } from "@/features/books/book";

/** 作品の目次にある話 1 つ。 */
export interface TocEntry {
  id: string;
  title: string;
  url: string;
}

/** 取得した目次ページと、ページ分けされていればその隣のページ。 */
export interface WorkToc {
  entries: TocEntry[];
  /** サイトがページ分けする場合の、前の目次ページ（なろう: 1 ページ 100 話）。 */
  previousUrl?: string;
  /** サイトがページ分けする場合の、次の目次ページ。 */
  nextUrl?: string;
}

/** Web 小説の話のページ 1 つ。サイトのマークアップに依存しない形。 */
export interface WebEpisode {
  source: WebSource;
  url: string;
  workId: string;
  workTitle: string;
  author: string;
  episodeId: string;
  /** その話が属する章の見出し。あれば。 */
  chapterTitle?: string;
  title: string;
  preface: ContentNode[];
  body: ContentNode[];
  afterword: ContentNode[];
  /** 作品の話の一覧。取れるときは、ページと一緒に取得する。 */
  toc?: WorkToc;
  previousUrl?: string;
  nextUrl?: string;
}

/** ホームに並べるサイトについて、ホームが見せるもの。 */
export interface SiteListing {
  /** トップページ。 */
  url: string;
  rankingUrl: string;
  /** サイト自身のアイコン。サイトのページが宣言しているもの。 */
  iconUrl: string;
}

/**
 * 目次が何ページにもわたるサイト用。本は、取得したページと、取得して
 * いない隣のページごとの行を持つ: その行は、ページのアドレスだけで本文の
 * ない章で、リーダーがそのページの話に展開する。
 */
export interface PagedToc {
  /** アドレスが一覧のページ（話ではない）かどうか。 */
  isTocPage: (url: string) => boolean;
  /**
   * 一覧の 1 ページを取り込んだ後の本の章: 読む順の `episodes` と、まだ
   * 取得していないページの行。`current` は本が持っていたもの、`tocUrl` は
   * 一覧の元になったページ。
   */
  arrange: (
    current: readonly Chapter[],
    episodes: Chapter[],
    toc: WorkToc,
    tocUrl: string | undefined,
  ) => Chapter[];
  /** `next`（まだ章の中にない話）にたどり着けるようにした章。 */
  chainNext: (chapters: Chapter[], next: Chapter) => Chapter[];
}

/**
 * Web 小説を読むサイト: そのアドレスとマークアップについてアプリが知って
 * いることのすべて。アプリのほかの部分はこれを通すので、別のサイトから
 * 読めるようにするには、`sites/index.ts` にこれをもう 1 つ（と、
 * `books/book.ts` にその名前を）足すだけ。
 */
export interface WebSite {
  id: WebSource;
  /** ホームに並べるサイトに入れる。それ以外は、アドレスで開いたときに読める。 */
  listing?: SiteListing;
  /**
   * アドレスが話のものでありうるかどうか。ページを求める前にする安い
   * チェック。決めるのはページそのもの（連載のトップページは目次で、
   * 短編のトップページは物語）。
   */
  mayBeEpisode: (url: string) => boolean;
  /** ページにある話。サイトのほかのページなら null。 */
  parseEpisode: (html: string, url: string) => WebEpisode | null;
  /** アドレスが指す話の id。話を指している場合。 */
  episodeIdOf: (url: string) => string | undefined;
  /**
   * ある話の前後の話を一覧にしているページ。なければ null（短編）。
   */
  tocUrlOf: (episodeUrl: string) => string | null;
  /** ページにある話の一覧。一覧のページでないアドレスなら null。 */
  parseToc: (html: string, url: string) => WorkToc | null;
  /**
   * サイト上の id から得た作品のページ（本の id は `<サイトの id>-<作品の
   * id>`）。そうした id でなければ null。
   */
  workUrl: (workId: string) => string | null;
  /**
   * 話のアドレスから得た作品のページ。話のアドレスのほうが作品の id より
   * 多くを語る場合（サイトのどのホストで読んだか）に実装する。
   */
  workPageOf?: (episodeUrl: string) => string | null;
  pagedToc?: PagedToc;
}
