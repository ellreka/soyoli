import {
  findAllByClass,
  findByClass,
  findById,
  findTag,
  absoluteUrl,
  parseHtml,
  textOf,
  toContent,
  type HtmlDocument,
} from "../html";
import type { WebEpisode, WebSite, WorkToc } from "./site";

interface KakuyomuEpisodePage {
  workId: string;
  episodeId: string;
}

const episodePattern =
  /^https:\/\/kakuyomu\.jp\/works\/(\d+)\/episodes\/(\d+)\/?(?:[?#]|$)/;

function matchKakuyomuEpisode(url: string): KakuyomuEpisodePage | null {
  const match = episodePattern.exec(url);
  return match ? { workId: match[1], episodeId: match[2] } : null;
}

const workPattern = /^https:\/\/kakuyomu\.jp\/works\/(\d+)\/?(?:[?#]|$)/;

function matchKakuyomuWork(url: string): string | null {
  return workPattern.exec(url)?.[1] ?? null;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null;
}

function follow(store: Json, pointer: unknown): Json | null {
  const key = isObject(pointer) ? pointer.__ref : undefined;
  const target = typeof key === "string" ? store[key] : undefined;
  return isObject(target) ? target : null;
}

// WORKAROUND: カクヨムの作品ページは一覧をクライアント側で、ハッシュ化されたクラス名で描く。元になるデータ（Next.js の `__NEXT_DATA__`）から読む。
function parseKakuyomuToc(html: string, url: string): WorkToc {
  const workId = matchKakuyomuWork(url);
  const json = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(
    html,
  )?.[1];
  if (!workId || !json) {
    return { entries: [] };
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { entries: [] };
  }
  const props = isObject(data) && isObject(data.props) ? data.props : null;
  const pageProps = props && isObject(props.pageProps) ? props.pageProps : null;
  const store = pageProps?.__APOLLO_STATE__;
  const work = isObject(store) ? store[`Work:${workId}`] : undefined;
  if (!isObject(store) || !isObject(work)) {
    return { entries: [] };
  }
  const sections = work.tableOfContentsV2 ?? work.tableOfContents;
  const entries: WorkToc["entries"] = [];
  for (const pointer of Array.isArray(sections) ? sections : []) {
    const episodes = follow(store, pointer)?.episodeUnions;
    for (const item of Array.isArray(episodes) ? episodes : []) {
      const episode = follow(store, item);
      const id = episode?.id;
      if (typeof id !== "string" || !/^\d+$/.test(id)) {
        continue;
      }
      entries.push({
        id,
        title: typeof episode?.title === "string" ? episode.title : "",
        url: `https://kakuyomu.jp/works/${workId}/episodes/${id}`,
      });
    }
  }
  return { entries };
}

function authorFromTitle(title: string): string {
  return /（([^（）]+)） - カクヨム$/.exec(title)?.[1]?.trim() ?? "";
}

function parseKakuyomuEpisode(
  document: HtmlDocument,
  url: string,
): WebEpisode | null {
  const page = matchKakuyomuEpisode(url);
  const body = findByClass(document, "widget-episodeBody");
  const breadcrumbs = findById(
    document,
    "worksEpisodesEpisodeHeader-breadcrumbs",
  );
  const workTitle =
    textOf(breadcrumbs && findTag(breadcrumbs, "h1")) ||
    textOf(findById(document, "contentMain-header-workTitle"));
  if (!page || !body || !workTitle) {
    return null;
  }
  const pager = (id: string) =>
    absoluteUrl(findById(document, id)?.attribs.href, url);

  return {
    source: "kakuyomu",
    url,
    workId: page.workId,
    workTitle,
    author:
      textOf(findById(document, "contentMain-header-author")) ||
      authorFromTitle(textOf(findTag(document, "title"))),
    episodeId: page.episodeId,
    chapterTitle:
      textOf(findAllByClass(document, "chapterTitle").at(-1)) || undefined,
    title: textOf(findByClass(document, "widget-episodeTitle")) || workTitle,
    preface: [],
    body: toContent(body.children, url),
    afterword: [],
    previousUrl: pager("contentMain-readPreviousEpisode"),
    nextUrl: pager("contentMain-readNextEpisode"),
  };
}

function workUrl(workId: string): string {
  return `https://kakuyomu.jp/works/${workId}`;
}

export const kakuyomu: WebSite = {
  id: "kakuyomu",
  listing: {
    url: "https://kakuyomu.jp/",
    rankingUrl: "https://kakuyomu.jp/rankings/all/weekly",
    iconUrl: "https://kakuyomu.jp/images/brand/favicons/app-256.png",
  },
  mayBeEpisode: (url) => matchKakuyomuEpisode(url) !== null,
  parseEpisode: (html, url) => parseKakuyomuEpisode(parseHtml(html), url),
  episodeIdOf: (url) => matchKakuyomuEpisode(url)?.episodeId,
  tocUrlOf(episodeUrl) {
    const page = matchKakuyomuEpisode(episodeUrl);
    return page ? workUrl(page.workId) : null;
  },
  parseToc: (html, url) =>
    matchKakuyomuWork(url) ? parseKakuyomuToc(html, url) : null,
  workUrl: (workId) => (/^\d+$/.test(workId) ? workUrl(workId) : null),
};
