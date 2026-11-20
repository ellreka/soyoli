import { DomUtils } from "htmlparser2";

import {
  findAllByClass,
  findByClass,
  findChild,
  hasClass,
  absoluteUrl,
  parseHtml,
  textOf,
  toContent,
  type HtmlDocument,
  type HtmlElement,
} from "../html";
import type { Chapter } from "@/features/books/book";
import type { PagedToc, WebEpisode, WebSite, WorkToc } from "./site";

interface NarouPage {
  workId: string;
  episodeId?: string;
}

const pagePattern =
  /^https:\/\/(?:ncode|novel18)\.syosetu\.com\/(n\d{4}[a-z]+)\/(?:(\d+)\/?)?(?:[?#]|$)/i;

function matchNarouPage(url: string): NarouPage | null {
  const match = pagePattern.exec(url);
  if (!match) {
    return null;
  }
  return { workId: match[1].toLowerCase(), episodeId: match[2] };
}

function authorOf(header: HtmlElement | null): string {
  if (!header) {
    return "";
  }
  const link = DomUtils.findOne(
    (element) =>
      (element.attribs.href ?? "").startsWith("https://mypage.syosetu.com/"),
    header.children,
    false,
  );
  if (link) {
    return textOf(link);
  }
  const text = header.children
    .filter((node) => node.type === "text")
    .map((node) => textOf(node))
    .join(" ");
  const index = text.indexOf("作者：");
  return index < 0 ? "" : text.slice(index + "作者：".length).trim();
}

function countOf(text: string): number | undefined {
  const count = Number(/^\s*\d+\s*\/\s*(\d+)\s*$/.exec(text)?.[1]);
  return Number.isInteger(count) && count > 0 ? count : undefined;
}

function parseNarouEpisode(
  document: HtmlDocument,
  url: string,
): WebEpisode | null {
  const page = matchNarouPage(url);
  const body = findByClass(document, "p-novel__body");
  if (!page || !body) {
    return null;
  }
  const texts = findAllByClass(body, "p-novel__text");
  const preface = texts.find((element) =>
    hasClass(element, "p-novel__text--preface"),
  );
  const afterword = texts.find((element) =>
    hasClass(element, "p-novel__text--afterword"),
  );
  const main = texts.find(
    (element) => element !== preface && element !== afterword,
  );
  if (!main) {
    return null;
  }

  // WORKAROUND: なろうは `--rensaiheader` の修飾子を廃止し、連載のヘッダーは素の c-announce になった。古いページには修飾子が残るので、両方の形に一致させる。
  const serialHeader =
    findByClass(document, "c-announce--rensaiheader") ??
    findAllByClass(document, "c-announce").find((element) =>
      DomUtils.findOne(
        (node) =>
          "attribs" in node &&
          (node.attribs.href ?? "").startsWith("https://mypage.syosetu.com/"),
        element.children,
        false,
      ),
    );
  const workTitle =
    textOf(serialHeader && findChild(serialHeader, "a")) ||
    textOf(findByClass(document, "p-novel__title"));
  if (!workTitle) {
    return null;
  }
  const pager = (name: string) =>
    absoluteUrl(findByClass(document, name)?.attribs.href, url);

  return {
    source: "narou",
    url,
    workId: page.workId,
    workTitle,
    author: authorOf(serialHeader ?? findByClass(document, "p-novel__author")),
    episodeId: page.episodeId ?? "short",
    chapterTitle:
      textOf(findByClass(body, "p-novel__subtitle-chapter")) ||
      textOf(serialHeader && findChild(serialHeader, "span")) ||
      undefined,
    title:
      textOf(findByClass(body, "p-novel__subtitle-episode")) ||
      (page.episodeId
        ? textOf(findByClass(document, "p-novel__title--rensai"))
        : "") ||
      workTitle,
    preface: preface ? toContent(preface.children, url) : [],
    body: toContent(main.children, url),
    afterword: afterword ? toContent(afterword.children, url) : [],
    episodeCount: countOf(textOf(findByClass(document, "p-novel__number"))),
    previousUrl: pager("c-pager__item--before"),
    nextUrl: pager("c-pager__item--next"),
  };
}

function parseNarouToc(document: HtmlDocument, url: string): WorkToc {
  const list = findByClass(document, "p-eplist");
  if (!list) {
    return { entries: [] };
  }
  const entries = findAllByClass(list, "p-eplist__subtitle").flatMap((link) => {
    const episodeUrl = absoluteUrl(link.attribs.href, url);
    const page = episodeUrl ? matchNarouPage(episodeUrl) : null;
    if (!episodeUrl || !page?.episodeId) {
      return [];
    }
    return [{ id: page.episodeId, title: textOf(link), url: episodeUrl }];
  });
  const pager = (name: string) =>
    absoluteUrl(findByClass(document, name)?.attribs.href, url);
  return {
    entries,
    previousUrl: pager("c-pager__item--before"),
    nextUrl: pager("c-pager__item--next"),
  };
}

const pageSize = 100;

function tocPageOf(url: string): number {
  const page = Number(/[?&]p=(\d+)/.exec(url)?.[1]);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function pageOfEpisode(number: number): number {
  return Math.floor((number - 1) / pageSize) + 1;
}

function isTocPage(url: string | undefined): boolean {
  const page = url ? matchNarouPage(url) : null;
  return page !== null && page.episodeId === undefined;
}

function isMarker(chapter: Chapter): boolean {
  return chapter.content.length === 0 && isTocPage(chapter.url);
}

function order(chapter: Chapter): number {
  return isMarker(chapter) && chapter.url
    ? (tocPageOf(chapter.url) - 1) * pageSize + 0.5
    : Number(chapter.id) || 0;
}

function sorted(chapters: Chapter[]): Chapter[] {
  return [...chapters].sort((a, b) => order(a) - order(b));
}

function holdsPage(chapters: readonly Chapter[], page: number): boolean {
  const first = (page - 1) * pageSize;
  return (
    chapters.filter((chapter) => {
      const number = Number(chapter.id);
      return number > first && number <= first + pageSize;
    }).length > 1
  );
}

const pagedToc: PagedToc = {
  isTocPage,
  arrange(current, episodes, toc, tocUrl) {
    const fetched = tocUrl ? tocPageOf(tocUrl) : null;
    const rows = current.filter(
      (chapter) =>
        isMarker(chapter) &&
        chapter.url &&
        tocPageOf(chapter.url) !== fetched &&
        !holdsPage(episodes, tocPageOf(chapter.url)),
    );
    for (const [url, title] of [
      [toc.previousUrl, "前の100話"],
      [toc.nextUrl, "次の100話"],
    ] as const) {
      if (
        url &&
        !rows.some((row) => row.url === url) &&
        !holdsPage(episodes, tocPageOf(url))
      ) {
        rows.push({ id: url, title, url, content: [] });
      }
    }
    return sorted([...episodes, ...rows]);
  },
  numberOf(chapter) {
    const number = Number(chapter.id);
    return !isMarker(chapter) && Number.isInteger(number) && number > 0
      ? number
      : undefined;
  },
  chainNext(chapters, next) {
    const page = pageOfEpisode(Number(next.id));
    const covered = chapters.some(
      (chapter) =>
        isMarker(chapter) && chapter.url && tocPageOf(chapter.url) === page,
    );
    return covered ? chapters : sorted([...chapters, next]);
  },
};

function tocPageUrl(like: string, workId: string, page: number): string {
  const origin =
    /^https:\/\/[^/]+/.exec(like)?.[0] ?? "https://ncode.syosetu.com";
  return `${origin}/${workId}/?p=${page}`;
}

export const narou: WebSite = {
  id: "narou",
  mayBeEpisode: (url) => matchNarouPage(url) !== null,
  parseEpisode: (html, url) => parseNarouEpisode(parseHtml(html), url),
  episodeIdOf: (url) => matchNarouPage(url)?.episodeId,
  tocUrlOf(episodeUrl) {
    const page = matchNarouPage(episodeUrl);
    const number = Number(page?.episodeId);
    return page && Number.isInteger(number) && number > 0
      ? tocPageUrl(episodeUrl, page.workId, pageOfEpisode(number))
      : null;
  },
  parseToc(html, url) {
    const page = matchNarouPage(url);
    if (!page) {
      return null;
    }
    const toc = parseNarouToc(parseHtml(html), url);
    const neighbour = (link: string | undefined) =>
      link && matchNarouPage(link)?.workId === page.workId
        ? tocPageUrl(link, page.workId, tocPageOf(link))
        : undefined;
    return {
      entries: toc.entries,
      previousUrl: neighbour(toc.previousUrl),
      nextUrl: neighbour(toc.nextUrl),
    };
  },
  workUrl: (workId) =>
    /^n\d{4}[a-z]+$/.test(workId)
      ? `https://ncode.syosetu.com/${workId}/`
      : null,
  workPageOf(episodeUrl) {
    const work =
      /^(https:\/\/(?:ncode|novel18)\.syosetu\.com\/n\d{4}[a-z]+)(?:\/|$)/i.exec(
        episodeUrl,
      );
    return work ? `${work[1]}/` : null;
  },
  pagedToc,
};
