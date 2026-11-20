import {
  isWebNovel,
  type Book,
  type Chapter,
  type ContentNode,
} from "@/features/books/book";
import { siteById, siteOf, webSites } from "./sites";
import type { WebEpisode, WorkToc } from "./sites/site";

export type { TocEntry, WebEpisode, WorkToc } from "./sites/site";

export function mayBeEpisodeUrl(url: string): boolean {
  return siteOf(url) !== undefined;
}

export function parseEpisode(html: string, url: string): WebEpisode | null {
  return siteOf(url)?.parseEpisode(html, url) ?? null;
}

export function tocUrlOf(episodeUrl: string): string | null {
  return siteOf(episodeUrl)?.tocUrlOf(episodeUrl) ?? null;
}

export function parseToc(html: string, url: string): WorkToc {
  for (const site of webSites) {
    const toc = site.parseToc(html, url);
    if (toc) {
      return toc;
    }
  }
  return { entries: [] };
}

export function isTocPageUrl(url: string | undefined): boolean {
  return (
    Boolean(url) && webSites.some((site) => site.pagedToc?.isTocPage(url ?? ""))
  );
}

export function isTocMarker(chapter: Chapter): boolean {
  return chapter.content.length === 0 && isTocPageUrl(chapter.url);
}

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
    episodeCount: paged ? book.episodeCount : episodes.length,
  };
}

export interface EpisodePosition {
  number: number;
  total?: number;
}

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
    total: Math.max(book.episodeCount, episodes.length),
  };
}

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

const divider: ContentNode = { type: "element", tag: "hr", children: [] };

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
