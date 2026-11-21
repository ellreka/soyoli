import type { ContentNode } from "@/features/books/book";
import type { TocEntry, WebEpisode, WebSite, WorkToc } from "./site";

const origin = "https://www.pixiv.net";

const episodePattern =
  /^https:\/\/www\.pixiv\.net\/(?:en\/)?novel\/show\.php\?(?:[^#]*&)?id=(\d+)(?:[&#]|$)/;

const tocPattern =
  /^https:\/\/www\.pixiv\.net\/ajax\/novel\/series\/(\d+)\/content_titles$/;

const seriesWork = /^series-(\d+)$/;
const singleWork = /^novel-(\d+)$/;

function novelIdOf(url: string): string | null {
  return episodePattern.exec(url)?.[1] ?? null;
}

function episodeUrl(novelId: string): string {
  return `${origin}/novel/show.php?id=${novelId}`;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null;
}

function responseBody(text: string): unknown {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return undefined;
  }
  return isObject(data) && data.error === false ? data.body : undefined;
}

function textNode(text: string): ContentNode[] {
  return text ? [{ type: "text", text }] : [];
}

const inlineTag =
  /\[\[rb:(.+?)>(.+?)\]\]|\[\[jumpuri:(.+?)>.+?\]\]|\[(?:jump|pixivimage|uploadedimage):[^\]]*\]/g;

function inline(line: string): ContentNode[] {
  const nodes: ContentNode[] = [];
  let rest = 0;
  for (const match of line.matchAll(inlineTag)) {
    nodes.push(...textNode(line.slice(rest, match.index)));
    rest = match.index + match[0].length;
    const [, base, reading, linkTitle] = match;
    if (base !== undefined && reading !== undefined) {
      nodes.push({
        type: "element",
        tag: "ruby",
        children: [
          ...textNode(base.trim()),
          { type: "element", tag: "rt", children: textNode(reading.trim()) },
        ],
      });
    } else if (linkTitle !== undefined) {
      nodes.push(...textNode(linkTitle.trim()));
    }
  }
  return [...nodes, ...textNode(line.slice(rest))];
}

function lines(text: string): ContentNode[] {
  const body = text.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
  if (!body) {
    return [];
  }
  return body.split(/\r?\n/).map((line): ContentNode => {
    const children = inline(line);
    return {
      type: "element",
      tag: "p",
      children: children.length
        ? children
        : [{ type: "element", tag: "br", children: [] }],
    };
  });
}

const blockTag = /\[newpage\]|\[chapter:([^\]]*)\]/g;

export function pixivContent(text: string): ContentNode[] {
  const nodes: ContentNode[] = [];
  let rest = 0;
  for (const match of text.matchAll(blockTag)) {
    nodes.push(...lines(text.slice(rest, match.index)));
    rest = match.index + match[0].length;
    const heading = match[1];
    nodes.push(
      heading === undefined
        ? { type: "element", tag: "hr", children: [] }
        : { type: "element", tag: "h2", children: inline(heading.trim()) },
    );
  }
  return [...nodes, ...lines(text.slice(rest))];
}

interface SeriesPlace {
  workId: string;
  workTitle: string;
  previousUrl?: string;
  nextUrl?: string;
}

function neighbourUrl(value: unknown): string | undefined {
  return isObject(value) &&
    typeof value.id === "string" &&
    /^\d+$/.test(value.id) &&
    value.available !== false
    ? episodeUrl(value.id)
    : undefined;
}

function seriesPlace(value: unknown): SeriesPlace | null {
  if (!isObject(value) || typeof value.title !== "string") {
    return null;
  }
  const id = String(value.seriesId);
  if (!/^\d+$/.test(id)) {
    return null;
  }
  return {
    workId: `series-${id}`,
    workTitle: value.title,
    previousUrl: neighbourUrl(value.prev),
    nextUrl: neighbourUrl(value.next),
  };
}

function parsePixivEpisode(text: string, url: string): WebEpisode | null {
  const novelId = novelIdOf(url);
  const body = responseBody(text);
  if (!novelId || !isObject(body) || body.id !== novelId) {
    return null;
  }
  const { title, content, userName } = body;
  if (
    typeof title !== "string" ||
    typeof content !== "string" ||
    body.xRestrict !== 0
  ) {
    return null;
  }
  const series = seriesPlace(body.seriesNavData);
  return {
    source: "pixiv",
    url,
    workId: series?.workId ?? `novel-${novelId}`,
    workTitle: series?.workTitle ?? title,
    author: typeof userName === "string" ? userName : "",
    episodeId: novelId,
    title,
    preface: [],
    body: pixivContent(content),
    afterword: [],
    previousUrl: series?.previousUrl,
    nextUrl: series?.nextUrl,
  };
}

function parsePixivToc(text: string): WorkToc {
  const body = responseBody(text);
  const entries: TocEntry[] = [];
  for (const item of Array.isArray(body) ? body : []) {
    if (
      isObject(item) &&
      typeof item.id === "string" &&
      /^\d+$/.test(item.id) &&
      item.available !== false
    ) {
      entries.push({
        id: item.id,
        title: typeof item.title === "string" ? item.title : "",
        url: episodeUrl(item.id),
      });
    }
  }
  return { entries };
}

function workUrl(workId: string): string | null {
  const series = seriesWork.exec(workId)?.[1];
  if (series) {
    return `${origin}/novel/series/${series}`;
  }
  const novel = singleWork.exec(workId)?.[1];
  return novel ? episodeUrl(novel) : null;
}

// WORKAROUND: pixiv の話のページは本文をクライアント側で描き、HTML には入れない。ページが読んでいるのと同じ JSON（/ajax/novel/）から読む。
export const pixiv: WebSite = {
  id: "pixiv",
  listing: {
    url: `${origin}/novel/`,
    rankingUrl: `${origin}/novel/ranking.php`,
    iconUrl: "https://s.pximg.net/common/images/apple-touch-icon.png",
  },
  mayBeEpisode: (url) => novelIdOf(url) !== null,
  episodeDataUrl(url) {
    const novelId = novelIdOf(url);
    return novelId ? `${origin}/ajax/novel/${novelId}` : null;
  },
  parseEpisode: parsePixivEpisode,
  episodeIdOf: (url) => novelIdOf(url) ?? undefined,
  tocUrlOf(_episodeUrl, workId) {
    const series = workId ? seriesWork.exec(workId)?.[1] : undefined;
    return series
      ? `${origin}/ajax/novel/series/${series}/content_titles`
      : null;
  },
  parseToc: (text, url) => (tocPattern.test(url) ? parsePixivToc(text) : null),
  workUrl,
};
