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
  /** ページがあるサイト: 一般向けか、成人向け（`h.`）。 */
  origin: string;
  workId: string;
  /** 作品のトップページ（目次、または短編）にはない。 */
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

/** 作品のトップページ。すべての話が並ぶ。 */
function hamelnWorkUrl(page: HamelnPage): string {
  return `${page.origin}/novel/${page.workId}/`;
}

/**
 * 作品のページにあるリンクのアドレス。このサイトはリンクを作品のフォルダ
 * からの相対（`./4.html`、`./`）で書く。同じ作品の話へ行くものだけを残す。
 */
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

/** `links` の中で文字に `label` を含むリンクを、話のアドレスとして返す。 */
function pagerUrl(
  links: readonly HtmlElement[],
  label: string,
  page: HamelnPage,
): string | undefined {
  const link = links.find((item) => textOf(item).includes(label));
  return episodeLink(link?.attribs.href, page)?.url;
}

/**
 * 話のページ（`/novel/123/4.html`）、またはトップページが物語そのものに
 * なっている作品。本文は `#honbun` にあり、前書きと後書きはその隣の別の
 * 箱に入る。サイトはブラウザによって 2 つのレイアウトを返す: アプリ自身の
 * ブラウザにはスマートフォン向けが来て、もう一方は、コンピューターとして
 * ページを求めたときの見た目。どちらも読む:
 *
 * - 作品のタイトルは作品のフォルダ（`./`）へのリンクで、スマートフォンでは
 *   ページの見出しに、そうでなければ本文の上の行にある。
 * - 著者は、その隣にあるユーザーページへのリンク。
 * - 話のタイトルは、スマートフォンでは本文の箱の中の見出しで、そうで
 *   なければ本文の前の独立した行。
 */
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
  // 「作品名 - 話名 - ハーメルン」。作品のページでは話名がない。
  const titleParts = textOf(findTag(document, "title")).split(" - ");
  // ページャーの 目次 も作品のフォルダへ行く。
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
    // その上にある作品のタイトルではない。そちらは段落の中にある。
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

/** 一覧の中の話のタイトル: リンクの文字から日付を除いたもの。 */
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

/**
 * 作品のトップページから取る話の一覧: すべての話がその 1 ページにある。
 * それぞれが `episode-list__item` の中の `./4.html` へのリンク（スマート
 * フォン向けのレイアウト）か、それ自体が `episode-list__link` になっている。
 * 章の見出しは表示用なので含めない。
 */
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

/**
 * ハーメルンと、その成人向けサイト（`h.`）。作品の番号は一般向けと通しで
 * 振られる。作品のページにすべての話が並ぶ。
 */
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
    // トップページが物語そのものになっている作品には、一覧がない。
    return page?.episodeId ? hamelnWorkUrl(page) : null;
  },
  parseToc: (html, url) =>
    matchHamelnPage(url) ? parseHamelnToc(parseHtml(html), url) : null,
  workUrl: (workId) =>
    /^\d+$/.test(workId) ? `https://syosetu.org/novel/${workId}/` : null,
  // 作品が 2 つのサイトのどちらにあるかは、話のアドレスそのものが示す。
  workPageOf(episodeUrl) {
    const work = /^(https:\/\/(?:h\.)?syosetu\.org\/novel\/\d+)(?:\/|$)/i.exec(
      episodeUrl,
    );
    return work ? `${work[1]}/` : null;
  },
};
