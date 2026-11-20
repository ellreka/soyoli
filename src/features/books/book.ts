export const contentTags = [
  "p",
  "div",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ruby",
  "rt",
  "rp",
  "em",
  "strong",
  "b",
  "i",
  "br",
  "hr",
  "blockquote",
  "ul",
  "ol",
  "li",
  "sup",
  "sub",
] as const;

export type ContentNode =
  | { type: "text"; text: string }
  | { type: "image"; uri: string; alt: string }
  | {
      type: "element";
      tag: (typeof contentTags)[number];
      children: ContentNode[];
    };

export type PageRange = { from: number; count: number };

export type Chapter = {
  id: string;
  title: string;
  url?: string;
  pages?: PageRange;
  content: ContentNode[];
};

export function awaitsText(chapter: Chapter | undefined): boolean {
  return (
    chapter?.content.length === 0 &&
    (Boolean(chapter.url) || chapter.pages !== undefined)
  );
}

export function withLoadedPages(next: Book, open: Book): Book {
  return {
    ...next,
    chapters: next.chapters.map((chapter) => {
      const loaded = open.chapters.find((item) => item.id === chapter.id);
      return chapter.pages &&
        chapter.content.length === 0 &&
        loaded?.content.length &&
        loaded.pages?.from === chapter.pages.from &&
        loaded.pages.count === chapter.pages.count
        ? { ...chapter, content: loaded.content }
        : chapter;
    }),
  };
}

export const webSources = ["narou", "kakuyomu", "hameln"] as const;
export type WebSource = (typeof webSources)[number];

export function isWebSource(value: unknown): value is WebSource {
  return webSources.some((source) => source === value);
}

export type BookSource = "file" | WebSource;

export const sourceLabels: Record<BookSource, string> = {
  file: "ファイル",
  narou: "小説家になろう",
  kakuyomu: "カクヨム",
  hameln: "ハーメルン",
};

export type BookSeries = {
  name: string;
  position?: number;
};

export function toBookSeries(value: unknown): BookSeries | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const { name, position } = value as Record<string, unknown>;
  if (typeof name !== "string" || name.trim() === "") {
    return undefined;
  }
  return typeof position === "number" && Number.isFinite(position)
    ? { name, position }
    : { name };
}

export type Book = {
  id: string;
  source: BookSource;
  title: string;
  author: string;
  cover?: string;
  series?: BookSeries;
  url?: string;
  file?: string;
  chapters: Chapter[];
  episodeCount?: number;
};

export function sourceName(source: BookSource): string | undefined {
  return source === "narou" ? undefined : sourceLabels[source];
}

export function isWebNovel(book: Book): book is Book & { source: WebSource } {
  return book.source !== "file";
}
