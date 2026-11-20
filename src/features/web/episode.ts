import {
  isWebNovel,
  type Book,
  type Chapter,
  type ContentNode,
} from "@/features/books/book";
import { siteById, siteOf, webSites } from "./sites";
import type { WebEpisode, WorkToc } from "./sites/site";

export type { TocEntry, WebEpisode, WorkToc } from "./sites/site";

// サイトのページが本になるまで。ここにあるものはサイトを区別しない:
// サイトごとの違いは `sites/` にある。

/**
 * `url` が話のページでありうるかどうか。WebView にページの HTML を求める
 * 前に使う、安い URL のチェック。決めるのは HTML（なろうの連載のトップ
 * ページは目次で、短編のトップページは物語そのもの。ハーメルンも同じ）。
 */
export function mayBeEpisodeUrl(url: string): boolean {
  return siteOf(url) !== undefined;
}

/** 話のページを解析する。サイトのほかのページなら null を返す。 */
export function parseEpisode(html: string, url: string): WebEpisode | null {
  return siteOf(url)?.parseEpisode(html, url) ?? null;
}

/**
 * `episodeUrl` の前後の話を一覧にしているページ。なろうは目次をページに
 * 分けるので、その話を含むページになる。カクヨムとハーメルンは作品ページが
 * 一覧全体を持つ。一覧のないページ（短編）では null。
 */
export function tocUrlOf(episodeUrl: string): string | null {
  return siteOf(episodeUrl)?.tocUrlOf(episodeUrl) ?? null;
}

/** 対応サイトの目次ページから取った、話の一覧。 */
export function parseToc(html: string, url: string): WorkToc {
  for (const site of webSites) {
    const toc = site.parseToc(html, url);
    if (toc) {
      return toc;
    }
  }
  return { entries: [] };
}

/**
 * ページ分けされた目次（なろう）のページのアドレスなら true: 話を並べる
 * ページであって、話ではない。
 */
export function isTocPageUrl(url: string | undefined): boolean {
  return (
    Boolean(url) && webSites.some((site) => site.pagedToc?.isTocPage(url ?? ""))
  );
}

/**
 * まだ取得していない目次ページの代わりに置く行: リーダーがそのページの
 * 話に展開する。それ自体は話ではない。
 */
export function isTocMarker(chapter: Chapter): boolean {
  return chapter.content.length === 0 && isTocPageUrl(chapter.url);
}

/**
 * 取得した目次を Web 小説に取り込む。本がすでに持っている話は本文を保つ。
 * それ以外は URL だけで本文なしで入り、読むときに読み込まれる。`tocUrl` は
 * 一覧の元になったページ。
 *
 * 一覧はふつう作品全体で、読む順に並んでいる。サイトがページ分けする場合
 * （なろう）は、本が持つページと、持っていないページの行を、サイトが
 * 並べる（`PagedToc`）。
 */
export function mergeToc(book: Book, toc: WorkToc, tocUrl?: string): Book {
  if (!toc.entries.length) {
    return book;
  }
  const known = new Map(
    book.chapters
      .filter((chapter) => !isTocMarker(chapter))
      .map((chapter) => [chapter.id, chapter]),
  );
  const listed = toc.entries.map((entry): Chapter => {
    const chapter = known.get(entry.id);
    // 読んだ話は、自分のページから取ったタイトルを保つ。「次の話」としてしか
    // 知らない話は、一覧のタイトルを使う。
    return chapter && chapter.content.length > 0
      ? chapter
      : {
          id: entry.id,
          title: entry.title !== "" ? entry.title : (chapter?.title ?? ""),
          url: entry.url,
          content: [],
        };
  });
  const listedIds = new Set(toc.entries.map((entry) => entry.id));
  // この一覧にないもの: ほかのページの話か、後から公開された話。
  const others = [...known.values()].filter(
    (chapter) => !listedIds.has(chapter.id),
  );
  const episodes = [...listed, ...others];
  const paged = siteById(book.source)?.pagedToc;
  return {
    ...book,
    chapters: paged
      ? paged.arrange(book.chapters, episodes, toc, tocUrl)
      : episodes,
    // ページ分けされた一覧は作品の一部だけ: 数は話のページから分かる。
    episodeCount: paged ? book.episodeCount : episodes.length,
  };
}

/** 章が作品の何話目か。全部の数は、分かっているときだけ。 */
export interface EpisodePosition {
  number: number;
  total?: number;
}

/**
 * 読んでいる章が、作品の何話目か。ファイルの作品はすべての章を持つので、
 * 並びから数える。Web 小説は、目次か話のページから数が分かったときだけ:
 * 目次を取得する前の本は読んだ話しか持たず、並びは作品の順番ではない。
 * 分からなければ undefined。
 */
export function episodePosition(
  book: Book,
  chapterIndex: number,
): EpisodePosition | undefined {
  const chapter = book.chapters[chapterIndex];
  if (!chapter || isTocMarker(chapter)) {
    return undefined;
  }
  if (!isWebNovel(book)) {
    return { number: chapterIndex + 1, total: book.chapters.length };
  }
  const paged = siteById(book.source)?.pagedToc;
  if (paged) {
    const number = paged.numberOf(chapter);
    if (number === undefined) {
      return undefined;
    }
    const total = book.episodeCount;
    return total !== undefined && total >= number
      ? { number, total }
      : { number };
  }
  if (book.episodeCount === undefined) {
    return undefined;
  }
  const episodes = book.chapters.filter((item) => !isTocMarker(item));
  return {
    number: episodes.indexOf(chapter) + 1,
    // 目次の後に公開された話が、次の話としてつながっていることがある。
    total: Math.max(book.episodeCount, episodes.length),
  };
}

/**
 * 読み終えた話の次の話を本がまだ知らないとき（目次がない、または後から
 * 公開された話）に、そこへたどり着けるようにする: 読み込んでいない章として
 * 足す。目次の行がすでにそれを覆っていれば、何も足さない。
 */
export function chainNextEpisode(
  chapters: Chapter[],
  nextUrl: string | undefined,
): Chapter[] {
  if (!nextUrl || chapters.some((chapter) => chapter.url === nextUrl)) {
    return chapters;
  }
  const site = siteOf(nextUrl);
  const id = site?.episodeIdOf(nextUrl);
  if (!site || !id) {
    return chapters;
  }
  const next: Chapter = { id, title: "次の話", url: nextUrl, content: [] };
  return site.pagedToc
    ? site.pagedToc.chainNext(chapters, next)
    : [...chapters, next];
}

/** 前書き・本文・後書きの間に置く区切り: 段落がつながらないようにする。 */
const divider: ContentNode = { type: "element", tag: "hr", children: [] };

/**
 * リーダーが表示し、読み上げる形の話の本文: まずページのタイトルを見出しと
 * して、続いて本文。`authorNotes` なら、前書きを本文の前に、後書きを後ろに
 * 足す（あるものだけ）。
 */
export function episodeContent(
  episode: Pick<WebEpisode, "title" | "preface" | "body" | "afterword">,
  authorNotes = false,
): ContentNode[] {
  const title = episode.title.trim();
  const parts = authorNotes
    ? [episode.preface, episode.body, episode.afterword]
    : [episode.body];
  const heading: ContentNode[] = title
    ? [
        {
          type: "element",
          tag: "h1",
          children: [{ type: "text", text: title }],
        },
      ]
    : [];
  return [
    ...heading,
    ...parts
      .filter((part) => part.length > 0)
      .flatMap((part, index) => (index > 0 ? [divider, ...part] : part)),
  ];
}

/**
 * その話のためのリーダー用の本。前書きと後書きは、`authorNotes` のときだけ
 * 含める。目次を取得してあれば、本は一覧にある話すべてにわたる: ほかの話は
 * URL だけで本文がなく、リーダーが必要になったときに読み込む — 先に取得
 * するのは目次だけ。
 */
export function episodeToBook(
  episode: WebEpisode,
  toc: WorkToc = { entries: [] },
  authorNotes = false,
): Book {
  const tocTitle = toc.entries.find(
    (entry) => entry.id === episode.episodeId,
  )?.title;
  const book: Book = {
    id: `${episode.source}-${episode.workId}`,
    source: episode.source,
    title: episode.workTitle,
    author: episode.author,
    url: episode.url,
    episodeCount: episode.episodeCount,
    chapters: [
      {
        id: episode.episodeId,
        // 目次は、一覧に出ているとおりの名前で話を呼ぶ。
        title:
          tocTitle !== undefined && tocTitle !== "" ? tocTitle : episode.title,
        url: episode.url,
        content: episodeContent(episode, authorNotes),
      },
    ],
  };
  const merged = mergeToc(book, toc, tocUrlOf(episode.url) ?? undefined);
  return {
    ...merged,
    chapters: chainNextEpisode(merged.chapters, episode.nextUrl),
  };
}
