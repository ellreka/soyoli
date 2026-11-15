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
  /** 作品のトップページ（目次、または短編）にはない。 */
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

/**
 * 「作者：<a href="https://mypage…">名前</a>」のようなヘッダーから取る著者。
 * ヘッダーには名前の後ろにお知らせが付くことがあるので、プロフィールへの
 * リンクか、ヘッダー自身の文字の「作者：」より後ろだけを使う。
 */
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

/**
 * 連載の話（`/n0000aa/1/`）と短編（`/n0000aa/`）は、同じ `p-novel__body` の
 * マークアップを使う。連載の目次にはそれがない。
 */
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

  // なろうは `--rensaiheader` の修飾子を廃止した。連載のヘッダーは今では
  // 素の c-announce で、作者のマイページへのリンクで見分ける。古いページには
  // 修飾子が残っているので、両方の形に一致させる。
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
    // 今の連載のページは、話のタイトルを `--rensai` の見出しに持つ。
    // 短編は作品のタイトルを使い回す。
    title:
      textOf(findByClass(body, "p-novel__subtitle-episode")) ||
      (page.episodeId
        ? textOf(findByClass(document, "p-novel__title--rensai"))
        : "") ||
      workTitle,
    preface: preface ? toContent(preface.children, url) : [],
    body: toContent(main.children, url),
    afterword: afterword ? toContent(afterword.children, url) : [],
    previousUrl: pager("c-pager__item--before"),
    nextUrl: pager("c-pager__item--next"),
  };
}

/**
 * 連載の目次から取る話の一覧（今のマークアップ: `p-eplist`）。平らに扱う:
 * 章のグループ（`p-eplist__chapter-title`）は表示用で、リーダー用の本の章
 * ではない。ページャーの 前へ / 次へ のリンクが隣の目次ページを知らせる
 * ので、目次の窓は両方向の続きを出せる。
 */
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

/** 目次の 1 ページにある話の数。 */
const pageSize = 100;

/** 目次ページの URL のページ番号（`…/n0000aa/?p=3`。なければ 1）。 */
function tocPageOf(url: string): number {
  const page = Number(/[?&]p=(\d+)/.exec(url)?.[1]);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** ある番号の話が載っている目次ページ。 */
function pageOfEpisode(number: number): number {
  return Math.floor((number - 1) / pageSize) + 1;
}

/** 目次ページの URL なら true: 作品のページであって、話ではない。 */
function isTocPage(url: string | undefined): boolean {
  const page = url ? matchNarouPage(url) : null;
  return page !== null && page.episodeId === undefined;
}

/** まだ取得していない目次ページの代わりに置く行。 */
function isMarker(chapter: Chapter): boolean {
  return chapter.content.length === 0 && isTocPage(chapter.url);
}

/**
 * 作品の章が置かれる位置: 話はその番号で、まだ取得していない目次ページの
 * 行は、そのページの最初の話のすぐ前。
 */
function order(chapter: Chapter): number {
  return isMarker(chapter) && chapter.url
    ? (tocPageOf(chapter.url) - 1) * pageSize + 0.5
    : Number(chapter.id) || 0;
}

function sorted(chapters: Chapter[]): Chapter[] {
  return [...chapters].sort((a, b) => order(a) - order(b));
}

/** 章の中に、あるページ（はぐれた 1 話だけではなく）がすでに入っているかどうか。 */
function holdsPage(chapters: readonly Chapter[], page: number): boolean {
  const first = (page - 1) * pageSize;
  return (
    chapters.filter((chapter) => {
      const number = Number(chapter.id);
      return number > first && number <= first + pageSize;
    }).length > 1
  );
}

/**
 * 取得した 1 ページは、最大 100 話の窓 1 つ分: 本にまだ入っていない隣の
 * ページは、それを取得する行として出す。
 */
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
  // その話のページをすでに行が覆っていれば、何も足さない。
  chainNext(chapters, next) {
    const page = pageOfEpisode(Number(next.id));
    const covered = chapters.some(
      (chapter) =>
        isMarker(chapter) && chapter.url && tocPageOf(chapter.url) === page,
    );
    return covered ? chapters : sorted([...chapters, next]);
  },
};

/** 目次ページごとに書き方を 1 つにする。ページを URL で比べられるように。 */
function tocPageUrl(like: string, workId: string, page: number): string {
  const origin =
    /^https:\/\/[^/]+/.exec(like)?.[0] ?? "https://ncode.syosetu.com";
  return `${origin}/${workId}/?p=${page}`;
}

/**
 * 小説家になろうと、その成人向けサイト（ノクターン、ムーンライト、
 * ミッドナイト: すべて `novel18.` にある）。マークアップも作品コードも
 * 共通。目次はページ分けされ、1 ページに 100 話。
 *
 * アイコンは持たせない（`listing` がないので、表紙にもミニプレーヤーにも
 * 出ない）。名前も画面に出さない（`books/book.ts` の `sourceName`）。運営
 * 会社の商標ガイドラインは、事前の承諾のない商標の使用を原則として禁じて
 * いる: <https://hinaproject.co.jp/company/trademark/>
 */
export const narou: WebSite = {
  id: "narou",
  mayBeEpisode: (url) => matchNarouPage(url) !== null,
  parseEpisode: (html, url) => parseNarouEpisode(parseHtml(html), url),
  episodeIdOf: (url) => matchNarouPage(url)?.episodeId,
  tocUrlOf(episodeUrl) {
    const page = matchNarouPage(episodeUrl);
    const number = Number(page?.episodeId);
    // 短編には番号がなく、一覧もない。
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
  // 成人向けサイトは一般向けと作品コードを共有する: 作品を 2 つのどちらで
  // 読んだかは、話のアドレスそのものが示す。
  workPageOf(episodeUrl) {
    const work =
      /^(https:\/\/(?:ncode|novel18)\.syosetu\.com\/n\d{4}[a-z]+)(?:\/|$)/i.exec(
        episodeUrl,
      );
    return work ? `${work[1]}/` : null;
  },
  pagedToc,
};
