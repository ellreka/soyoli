import type { Chapter, ContentNode, WebSource } from "@/features/books/book";

export interface TocEntry {
  id: string;
  title: string;
  url: string;
}

export interface WorkToc {
  entries: TocEntry[];
  previousUrl?: string;
  nextUrl?: string;
}

export interface WebEpisode {
  source: WebSource;
  url: string;
  workId: string;
  workTitle: string;
  author: string;
  episodeId: string;
  chapterTitle?: string;
  title: string;
  preface: ContentNode[];
  body: ContentNode[];
  afterword: ContentNode[];
  episodeCount?: number;
  toc?: WorkToc;
  previousUrl?: string;
  nextUrl?: string;
}

export interface SiteListing {
  url: string;
  rankingUrl: string;
  iconUrl: string;
}

export interface PagedToc {
  isTocPage: (url: string) => boolean;
  arrange: (
    current: readonly Chapter[],
    episodes: Chapter[],
    toc: WorkToc,
    tocUrl: string | undefined,
  ) => Chapter[];
  numberOf: (chapter: Chapter) => number | undefined;
  chainNext: (chapters: Chapter[], next: Chapter) => Chapter[];
}

export interface WebSite {
  id: WebSource;
  listing?: SiteListing;
  mayBeEpisode: (url: string) => boolean;
  episodeDataUrl?: (episodeUrl: string) => string | null;
  parseEpisode: (html: string, url: string) => WebEpisode | null;
  episodeIdOf: (url: string) => string | undefined;
  tocUrlOf: (episodeUrl: string, workId?: string) => string | null;
  parseToc: (html: string, url: string) => WorkToc | null;
  workUrl: (workId: string) => string | null;
  workPageOf?: (episodeUrl: string) => string | null;
  pagedToc?: PagedToc;
}
