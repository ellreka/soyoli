import { DomUtils } from "htmlparser2";

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
  type HtmlElement,
} from "../html";
import type { WebEpisode, WebSite, WorkToc } from "./site";

interface HamelnPage {
  origin: string;
  workId: string;
  episodeId?: string;
}

const pagePattern =
  /^(https:\/\/(?:h\.)?syosetu\.org)\/novel\/(\d+)\/(?:(\d+)\.html)?(?:[?#]|$)/i;

function matchHamelnPage(url: string): HamelnPage | null {
  const match = pagePattern.exec(url);
  return match
    ? { origin: match[1].toLowerCase(), workId: match[2], episodeId: match[3] }
    : null;
}

function hamelnWorkUrl(page: HamelnPage): string {
  return `${page.origin}/novel/${page.workId}/`;
}

function episodeLink(
  href: string | undefined,
  page: HamelnPage,
): { id: string; url: string } | null {
  const target = href?.trim() ?? "";
  const relative = /^(?:\.\/)?(\d+)\.html$/.exec(target)?.[1];
  if (relative) {
    return { id: relative, url: `${hamelnWorkUrl(page)}${relative}.html` };
  }
  const linked = matchHamelnPage(absoluteUrl(target, page.origin) ?? "");
  return linked?.episodeId && linked.workId === page.workId
    ? {
        id: linked.episodeId,
        url: `${hamelnWorkUrl(page)}${linked.episodeId}.html`,
      }
    : null;
}

function isElement(node: HtmlElement["children"][number]): node is HtmlElement {
  return "attribs" in node;
}

function pagerUrl(
  links: readonly HtmlElement[],
  label: string,
  page: HamelnPage,
): string | undefined {
  const link = links.find((item) => textOf(item).includes(label));
  return episodeLink(link?.attribs.href, page)?.url;
}

// WORKAROUND: ハーメルンはブラウザによって 2 つのレイアウトを返す（アプリ内ブラウザにはスマートフォン向け）。作品と話のタイトルの場所が違うので、どちらも読む。
function parseHamelnEpisode(
  document: HtmlDocument,
  url: string,
): WebEpisode | null {
  const page = matchHamelnPage(url);
  const body = findById(document, "honbun");
  if (!page || !body) {
    return null;
  }
  const links = DomUtils.findAll(
    (item) => item.name === "a",
    document.children,
  );
  const titleParts = textOf(findTag(document, "title")).split(" - ");
  const workLink = links.find(
    (link) =>
      (link.attribs.href ?? "").trim() === "./" &&
      textOf(link).replace(/\s/g, "") !== "目次",
  );
  const workTitle =
    textOf(findById(document, "pagetitle")) ||
    textOf(workLink) ||
    textOf(
      DomUtils.findOne(
        (item) => item.attribs.itemprop === "name",
        document.children,
      ),
    ) ||
    (titleParts.length > 1 ? titleParts[0] : "");
  if (!workTitle) {
    return null;
  }
  const authorLink = links.find((link) =>
    /\/user\/\d+\/?$/.test(link.attribs.href ?? ""),
  );
  const box = body.parent && isElement(body.parent) ? body.parent : null;
  const entry = findById(document, "entry_box");
  const heading =
    (entry && findTag(entry, "h2")) ??
    box?.children.find(
      (node): node is HtmlElement =>
        isElement(node) && node.name === "span" && textOf(node) !== "",
    );
  const title =
    textOf(heading) ||
    (titleParts.length > 2 ? titleParts.slice(1, -1).join(" - ") : "") ||
    workTitle;
  const part = (id: string) => {
    const element = findById(document, id);
    return element ? toContent(element.children, url) : [];
  };
  const navigation = findByClass(document, "novelnavi");
  const pager = navigation
    ? DomUtils.findAll((item) => item.name === "a", navigation.children)
    : [];

  return {
    source: "hameln",
    url,
    workId: page.workId,
    workTitle,
    author: textOf(authorLink),
    episodeId: page.episodeId ?? "short",
    title,
    preface: part("maegaki"),
    body: toContent(body.children, url),
    afterword: part("atogaki"),
    previousUrl: pagerUrl(pager, "前の話", page),
    nextUrl: pagerUrl(pager, "次の話", page),
  };
}

function listedTitle(link: HtmlElement): string {
  const named = findByClass(link, "episode-list__title");
  if (named) {
    return textOf(named);
  }
  const first = link.children.find(
    (node): node is HtmlElement => isElement(node) && node.name === "span",
  );
  return textOf(first);
}

function parseHamelnToc(document: HtmlDocument, url: string): WorkToc {
  const page = matchHamelnPage(url);
  if (!page) {
    return { entries: [] };
  }
  const links = [
    ...findAllByClass(document, "episode-list__link"),
    ...findAllByClass(document, "episode-list__item").flatMap((item) => {
      const link = findTag(item, "a");
      return link ? [link] : [];
    }),
  ];
  const entries: WorkToc["entries"] = [];
  for (const link of links) {
    const episode = episodeLink(link.attribs.href, page);
    if (episode && !entries.some((entry) => entry.id === episode.id)) {
      entries.push({
        id: episode.id,
        title: listedTitle(link),
        url: episode.url,
      });
    }
  }
  return { entries };
}

export const hameln: WebSite = {
  id: "hameln",
  listing: {
    url: "https://syosetu.org/",
    rankingUrl: "https://syosetu.org/?mode=rank",
    iconUrl: "https://img.syosetu.org/image/apple-touch-icon-180x180.png",
  },
  mayBeEpisode: (url) => matchHamelnPage(url) !== null,
  parseEpisode: (html, url) => parseHamelnEpisode(parseHtml(html), url),
  episodeIdOf: (url) => matchHamelnPage(url)?.episodeId,
  tocUrlOf(episodeUrl) {
    const page = matchHamelnPage(episodeUrl);
    return page?.episodeId ? hamelnWorkUrl(page) : null;
  },
  parseToc: (html, url) =>
    matchHamelnPage(url) ? parseHamelnToc(parseHtml(html), url) : null,
  workUrl: (workId) =>
    /^\d+$/.test(workId) ? `https://syosetu.org/novel/${workId}/` : null,
  workPageOf(episodeUrl) {
    const work = /^(https:\/\/(?:h\.)?syosetu\.org\/novel\/\d+)(?:\/|$)/i.exec(
      episodeUrl,
    );
    return work ? `${work[1]}/` : null;
  },
};
