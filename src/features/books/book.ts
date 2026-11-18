// ファイルも Web 小説も、この形式になる。リーダーはどちらの出どころも知らない。
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

/** ファイルのページの連なり。0 始まり。 */
export type PageRange = { from: number; count: number };

export type Chapter = {
  id: string;
  title: string;
  /** Web 小説の話の元ページ。ファイルの章にはない。 */
  url?: string;
  /**
   * この章にあたるファイルのページ。章を開いたときに本文をそこから読む
   * 場合（PDF）に入る。
   */
  pages?: PageRange;
  content: ContentNode[];
};

/**
 * 章がまだ本文を待っているかどうか: まだ取得していない Web 小説の話か、
 * まだ読んでいないファイルのページ。
 */
export function awaitsText(chapter: Chapter | undefined): boolean {
  return (
    chapter?.content.length === 0 &&
    (Boolean(chapter.url) || chapter.pages !== undefined)
  );
}

/** Web 小説を読むサイト（それぞれが `web/sites` の 1 項目）。 */
export const webSources = ["narou", "kakuyomu", "hameln"] as const;
export type WebSource = (typeof webSources)[number];

export function isWebSource(value: unknown): value is WebSource {
  return webSources.some((source) => source === value);
}

/** 作品の出どころ: 取り込んだファイル（EPUB、PDF）か、サイト。 */
export type BookSource = "file" | WebSource;

/** サイトの正式な名前: どこでも短くしない。 */
export const sourceLabels: Record<BookSource, string> = {
  file: "ファイル",
  narou: "小説家になろう",
  kakuyomu: "カクヨム",
  hameln: "ハーメルン",
};

/**
 * ファイルが自分で名乗っているシリーズ: 同じ作品の別の巻をまとめるための
 * もの。書名からは推測しない。
 */
export type BookSeries = {
  name: string;
  /** シリーズの中での順番（巻）。ファイルに書かれていなければない。 */
  position?: number;
};

/** ディスクから読み戻したシリーズ。形が違えば undefined。 */
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
  /** ファイルにシリーズの情報がある作品に入る（EPUB）。 */
  series?: BookSeries;
  /** Web 小説の元ページ。ファイル由来の作品にはない。 */
  url?: string;
  /**
   * 端末に保存した作品に入る: ストアの中でのファイルの名前。開くまでは
   * 章を持たない。
   */
  file?: string;
  chapters: Chapter[];
};

/**
 * 画面に出す、作品の出どころの名前。小説家になろうの名前は出さない: 運営
 * 会社の商標ガイドラインは、事前の承諾のない商標の使用を原則として禁じて
 * いる（<https://hinaproject.co.jp/company/trademark/>）。その作品は、名前の
 * 代わりにアドレスで見分けられる。
 */
export function sourceName(source: BookSource): string | undefined {
  return source === "narou" ? undefined : sourceLabels[source];
}

/** 端末に保存したファイルではなく、サイトから読む作品。 */
export function isWebNovel(book: Book): book is Book & { source: WebSource } {
  return book.source !== "file";
}
