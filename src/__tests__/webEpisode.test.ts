import {
  hamelnEpisodeHtml,
  hamelnEpisodeUrl,
  hamelnPhoneEpisodeHtml,
  hamelnPhoneWorkHtml,
  hamelnWorkHtml,
  hamelnWorkUrl,
  kakuyomuEpisodeHtml,
  kakuyomuEpisodeUrl,
  narouEpisodeHtml,
  narouEpisodeUrl,
  narouShortHtml,
  narouShortUrl,
  narouTocHtml,
  pixivAdultEpisodeJson,
  pixivEpisodeDataUrl,
  pixivEpisodeJson,
  pixivEpisodeUrl,
  pixivSingleJson,
  pixivSingleUrl,
  pixivTocJson,
  pixivTocUrl,
} from "@/__fixtures__/webPages";
import type { Book, ContentNode } from "@/features/books/book";
import {
  episodeContent,
  episodeDataUrl,
  episodePosition,
  episodeToBook,
  mayBeEpisodeUrl,
  mergeToc,
  parseEpisode,
  parseToc,
  tocUrlOf,
} from "@/features/web/episode";
import { workPageOf, workUrlOf } from "@/features/web/sites";

function blocks(nodes: ContentNode[]): ContentNode[] {
  return nodes.filter((node) => node.type !== "text" || node.text.trim());
}

function text(value: string): ContentNode {
  return { type: "text", text: value };
}

function element(
  tag: Extract<ContentNode, { type: "element" }>["tag"],
  children: ContentNode[],
): ContentNode {
  return { type: "element", tag, children };
}

describe("narou", () => {
  it("parses a serial episode with headings, pager and sections", () => {
    const episode = parseEpisode(narouEpisodeHtml, narouEpisodeUrl);
    expect(episode).toMatchObject({
      source: "narou",
      url: narouEpisodeUrl,
      workId: "n1234ab",
      workTitle: "テスト作品",
      author: "作者名",
      episodeId: "2",
      chapterTitle: "第一章　始まり",
      title: "第二話　出会い",
      previousUrl: "https://ncode.syosetu.com/n1234ab/1/",
      nextUrl: "https://ncode.syosetu.com/n1234ab/3/",
    });
    expect(blocks(episode!.preface)).toEqual([
      element("p", [text("前書きです。")]),
    ]);
    expect(blocks(episode!.afterword)).toEqual([
      element("p", [text("後書きです。")]),
    ]);
  });

  it("keeps ruby, images and text while dropping scripts, links and styling", () => {
    const episode = parseEpisode(narouEpisodeHtml, narouEpisodeUrl);
    expect(blocks(episode!.body)).toEqual([
      element("p", [
        text("　"),
        element("ruby", [
          text("魔法"),
          element("rp", [text("(")]),
          element("rt", [text("まほう")]),
          element("rp", [text(")")]),
        ]),
        text("を使った。"),
      ]),
      element("p", [element("br", [])]),
      element("p", [
        {
          type: "image",
          uri: "https://example.mitemin.net/i1.png",
          alt: "挿絵",
        },
      ]),
      element("p", [text("<終>"), element("span", [text("赤")])]),
    ]);
  });

  it("parses a short story from the work's top page", () => {
    expect(parseEpisode(narouShortHtml, narouShortUrl)).toMatchObject({
      workId: "n5678cd",
      workTitle: "短編作品",
      author: "名無し",
      episodeId: "short",
      title: "短編作品",
      chapterTitle: undefined,
      previousUrl: undefined,
      nextUrl: undefined,
    });
  });

  it("returns null for a table of contents", () => {
    expect(
      parseEpisode(narouTocHtml, "https://ncode.syosetu.com/n1234ab/"),
    ).toBeNull();
  });
});

describe("kakuyomu", () => {
  it("parses an episode using breadcrumbs and the page title", () => {
    const episode = parseEpisode(kakuyomuEpisodeHtml, kakuyomuEpisodeUrl);
    expect(episode).toMatchObject({
      source: "kakuyomu",
      workId: "1000000000000000001",
      workTitle: "カクヨム作品",
      author: "書き手",
      episodeId: "1000000000000000020",
      chapterTitle: "第一章",
      title: "第2話　題",
      preface: [],
      afterword: [],
      previousUrl:
        "https://kakuyomu.jp/works/1000000000000000001/episodes/1000000000000000010",
      nextUrl:
        "https://kakuyomu.jp/works/1000000000000000001/episodes/1000000000000000030",
    });
  });

  it("unwraps rb inside ruby and keeps emphasis", () => {
    const episode = parseEpisode(kakuyomuEpisodeHtml, kakuyomuEpisodeUrl);
    expect(blocks(episode!.body)).toEqual([
      element("p", [
        element("ruby", [
          text("漢字"),
          element("rp", [text("（")]),
          element("rt", [text("かんじ")]),
          element("rp", [text("）")]),
        ]),
        text("を読む。"),
      ]),
      element("p", [element("br", [])]),
      element("p", [
        element("em", [
          element("span", [text("傍")]),
          element("span", [text("点")]),
        ]),
      ]),
    ]);
  });
});

describe("hameln", () => {
  it("parses an episode: the work and author from the line above the text", () => {
    const episode = parseEpisode(hamelnEpisodeHtml, hamelnEpisodeUrl);
    expect(episode).toMatchObject({
      source: "hameln",
      workId: "123456",
      workTitle: "ハーメルン作品",
      author: "書き手",
      episodeId: "2",
      title: "第二話　題",
      previousUrl: "https://syosetu.org/novel/123456/1.html",
      nextUrl: "https://syosetu.org/novel/123456/3.html",
    });
    expect(blocks(episode!.preface)[0]).toEqual(text("前書きです。"));
    expect(blocks(episode!.afterword)).toContainEqual(text("後書きです。"));
    expect(blocks(episode!.body)).toEqual([
      element("p", [text("　最初の段落。")]),
      element("p", [text("　")]),
      element("p", [
        text("「"),
        element("ruby", [
          text("漢字"),
          element("rp", [text("(")]),
          element("rt", [text("かんじ")]),
          element("rp", [text(")")]),
        ]),
        text("を読む」"),
      ]),
    ]);
  });

  it("reads the layout the site serves to a phone, as the app's browser gets it", () => {
    expect(
      parseEpisode(hamelnPhoneEpisodeHtml, hamelnEpisodeUrl),
    ).toMatchObject({
      source: "hameln",
      workId: "123456",
      workTitle: "ハーメルン作品",
      author: "書き手",
      episodeId: "2",
      title: "第二話　題",
      previousUrl: "https://syosetu.org/novel/123456/1.html",
      nextUrl: "https://syosetu.org/novel/123456/3.html",
    });
    expect(parseToc(hamelnPhoneWorkHtml, hamelnWorkUrl)).toEqual(
      parseToc(hamelnWorkHtml, hamelnWorkUrl),
    );
  });

  it("has no next episode on the last page, where the link is a cross", () => {
    const last = hamelnEpisodeHtml.replace(
      '<a href="./3.html">次の話 &gt;&gt;</a>',
      '<a href="#">×</a>',
    );
    const episode = parseEpisode(last, hamelnEpisodeUrl);
    expect(episode?.nextUrl).toBeUndefined();
    expect(episode?.previousUrl).toBe(
      "https://syosetu.org/novel/123456/1.html",
    );
  });

  it("reads the whole episode list from the work's page", () => {
    expect(tocUrlOf(hamelnEpisodeUrl)).toBe(hamelnWorkUrl);
    expect(parseToc(hamelnWorkHtml, hamelnWorkUrl)).toEqual({
      entries: [
        { id: "1", title: "第一話　始まり", url: `${hamelnWorkUrl}1.html` },
        { id: "2", title: "第二話　題", url: `${hamelnWorkUrl}2.html` },
        { id: "3", title: "第三話　続き", url: `${hamelnWorkUrl}3.html` },
      ],
    });
    expect(parseEpisode(hamelnWorkHtml, hamelnWorkUrl)).toBeNull();
  });

  it("makes a book of the listed episodes, with the text of the one read", () => {
    const episode = parseEpisode(hamelnEpisodeHtml, hamelnEpisodeUrl)!;
    const book = episodeToBook(
      episode,
      parseToc(hamelnWorkHtml, hamelnWorkUrl),
    );
    expect(book).toMatchObject({ id: "hameln-123456", source: "hameln" });
    expect(book.chapters.map((chapter) => chapter.id)).toEqual(["1", "2", "3"]);
    expect(book.chapters[1].content.length).toBeGreaterThan(0);
    expect(book.chapters[2]).toMatchObject({
      url: `${hamelnWorkUrl}3.html`,
      content: [],
    });
  });

  it("finds a work's page from its id, keeping the site it was read on", () => {
    expect(workUrlOf("hameln-123456")).toBe(hamelnWorkUrl);
    expect(
      workPageOf("hameln-123456", "https://h.syosetu.org/novel/123456/2.html"),
    ).toBe("https://h.syosetu.org/novel/123456/");
  });
});

describe("episode pages", () => {
  it.each([
    ["https://ncode.syosetu.com/n1234ab/2/", true],
    ["https://novel18.syosetu.com/n1234ab/2/", true],
    ["https://ncode.syosetu.com/n1234ab/", true],
    ["https://ncode.syosetu.com/n1234ab/2/?p=1#L3", true],
    [kakuyomuEpisodeUrl, true],
    [hamelnEpisodeUrl, true],
    ["https://h.syosetu.org/novel/123456/2.html", true],
    [hamelnWorkUrl, true],
    [pixivEpisodeUrl, true],
    ["https://www.pixiv.net/en/novel/show.php?id=2002#2", true],
    ["https://www.pixiv.net/novel/series/77", false],
    ["https://www.pixiv.net/novel/unlisted/abcDEF123", false],
    ["https://www.pixiv.net/artworks/2002", false],
    ["https://syosetu.org/", false],
    ["https://syosetu.org/?mode=rank", false],
    ["https://syosetu.org/user/1234/", false],
    ["https://syosetu.com/", false],
    ["https://ncode.syosetu.com/novelview/infotop/ncode/n1234ab/", false],
    ["https://kakuyomu.jp/works/1000000000000000001", false],
    ["http://ncode.syosetu.com/n1234ab/2/", false],
    ["https://ncode.syosetu.com.example.com/n1234ab/2/", false],
  ])("treats %s as an episode URL: %s", (url, expected) => {
    expect(mayBeEpisodeUrl(url)).toBe(expected);
  });

  it("ignores HTML from other sites", () => {
    expect(
      parseEpisode(narouEpisodeHtml, "https://example.com/n1234ab/2/"),
    ).toBeNull();
  });

  it("rejects oversized pages", () => {
    expect(() =>
      parseEpisode("a".repeat(5 * 1024 * 1024 + 1), narouEpisodeUrl),
    ).toThrow("ページが大きすぎて読み込めません。");
  });

  it("builds a one-episode book for the reader without preface or afterword", () => {
    const episode = parseEpisode(narouEpisodeHtml, narouEpisodeUrl)!;
    expect(episodeToBook(episode)).toEqual({
      id: "narou-n1234ab",
      source: "narou",
      title: "テスト作品",
      author: "作者名",
      url: narouEpisodeUrl,
      episodeCount: 3,
      chapters: [
        {
          id: "2",
          title: "第二話　出会い",
          url: narouEpisodeUrl,
          content: episodeContent(episode),
        },
        {
          id: "3",
          title: "次の話",
          url: "https://ncode.syosetu.com/n1234ab/3/",
          content: [],
        },
      ],
    });
  });

  it("extracts the episode list and the continuation from a work's TOC page", () => {
    expect(
      parseToc(narouTocHtml, "https://ncode.syosetu.com/n1234ab/"),
    ).toEqual({
      entries: [
        {
          id: "1",
          title: "第一話",
          url: "https://ncode.syosetu.com/n1234ab/1/",
        },
        {
          id: "2",
          title: "第二話　出会い",
          url: "https://ncode.syosetu.com/n1234ab/2/",
        },
        {
          id: "3",
          title: "第三話",
          url: "https://ncode.syosetu.com/n1234ab/3/",
        },
      ],
      previousUrl: undefined,
      nextUrl: "https://ncode.syosetu.com/n1234ab/?p=2",
    });
    expect(parseToc(narouTocHtml, kakuyomuEpisodeUrl)).toEqual({
      entries: [],
    });
  });

  it("puts the preface before the text and the afterword after it when asked", () => {
    const episode = parseEpisode(narouEpisodeHtml, narouEpisodeUrl)!;
    const hr = { type: "element", tag: "hr", children: [] };
    expect(episodeContent(episode, true)).toEqual([
      episodeContent(episode)[0],
      ...episode.preface,
      hr,
      ...episode.body,
      hr,
      ...episode.afterword,
    ]);
    const plain = { ...episode, preface: [], afterword: [] };
    expect(episodeContent(plain, true)).toEqual(episodeContent(episode));
    expect(episodeToBook(episode, undefined, true).chapters[0].content).toEqual(
      episodeContent(episode, true),
    );
  });

  it("builds a whole-work book whose other episodes load on demand", () => {
    const episode = parseEpisode(narouEpisodeHtml, narouEpisodeUrl)!;
    const toc = parseToc(narouTocHtml, "https://ncode.syosetu.com/n1234ab/");
    const book = episodeToBook(episode, toc);
    expect(book.chapters).toEqual([
      {
        id: "1",
        title: "第一話",
        url: "https://ncode.syosetu.com/n1234ab/1/",
        content: [],
      },
      {
        id: "2",
        title: "第二話　出会い",
        url: narouEpisodeUrl,
        content: episodeContent(episode),
      },
      {
        id: "3",
        title: "第三話",
        url: "https://ncode.syosetu.com/n1234ab/3/",
        content: [],
      },
      {
        id: "https://ncode.syosetu.com/n1234ab/?p=2",
        title: "次の100話",
        url: "https://ncode.syosetu.com/n1234ab/?p=2",
        content: [],
      },
    ]);
  });

  it("appends an episode that the fetched TOC does not list", () => {
    const episode = parseEpisode(narouEpisodeHtml, narouEpisodeUrl)!;
    const book = episodeToBook(episode, {
      entries: [
        {
          id: "1",
          title: "第一話",
          url: "https://ncode.syosetu.com/n1234ab/1/",
        },
      ],
    });
    expect(
      book.chapters.map((chapter) => `${chapter.id}:${chapter.title}`),
    ).toEqual(["1:第一話", "2:第二話　出会い", "3:次の話"]);
  });
});

describe("table of contents", () => {
  const kakuyomuWorkUrl = "https://kakuyomu.jp/works/1000000000000000001";
  const store = {
    "Work:1000000000000000001": {
      id: "1000000000000000001",
      title: "テスト作品",
      tableOfContentsV2: [
        { __ref: "TableOfContentsChapter:1" },
        { __ref: "TableOfContentsChapter:2" },
      ],
    },
    "Work:9": { tableOfContentsV2: [{ __ref: "TableOfContentsChapter:9" }] },
    "TableOfContentsChapter:1": {
      chapter: { __ref: "Chapter:1" },
      episodeUnions: [
        { __ref: "Episode:1000000000000000010" },
        { __ref: "Episode:1000000000000000020" },
      ],
    },
    "TableOfContentsChapter:2": {
      chapter: null,
      episodeUnions: [
        { __ref: "Episode:1000000000000000030" },
        { __ref: "Episode:missing" },
      ],
    },
    "TableOfContentsChapter:9": { episodeUnions: [{ __ref: "Episode:999" }] },
    "Chapter:1": { title: "第一章" },
    "Episode:1000000000000000010": {
      id: "1000000000000000010",
      title: "第1話",
    },
    "Episode:1000000000000000020": {
      id: "1000000000000000020",
      title: "第2話",
    },
    "Episode:1000000000000000030": {
      id: "1000000000000000030",
      title: "第3話",
    },
    "Episode:999": { id: "999", title: "別作品" },
  };
  const kakuyomuWorkHtml =
    '<!DOCTYPE html><html><body><div id="__next"></div>' +
    '<script id="__NEXT_DATA__" type="application/json">' +
    JSON.stringify({ props: { pageProps: { __APOLLO_STATE__: store } } }) +
    "</script></body></html>";

  it("finds the page that lists the episodes around one", () => {
    expect(tocUrlOf("https://ncode.syosetu.com/n1234ab/2/")).toBe(
      "https://ncode.syosetu.com/n1234ab/?p=1",
    );
    expect(tocUrlOf("https://ncode.syosetu.com/n1234ab/250/")).toBe(
      "https://ncode.syosetu.com/n1234ab/?p=3",
    );
    expect(tocUrlOf(kakuyomuEpisodeUrl)).toBe(kakuyomuWorkUrl);
    expect(tocUrlOf(narouShortUrl)).toBeNull();
  });

  it("reads a kakuyomu work's whole episode list, in reading order", () => {
    expect(parseToc(kakuyomuWorkHtml, kakuyomuWorkUrl)).toEqual({
      entries: [
        {
          id: "1000000000000000010",
          title: "第1話",
          url: `${kakuyomuWorkUrl}/episodes/1000000000000000010`,
        },
        {
          id: "1000000000000000020",
          title: "第2話",
          url: `${kakuyomuWorkUrl}/episodes/1000000000000000020`,
        },
        {
          id: "1000000000000000030",
          title: "第3話",
          url: `${kakuyomuWorkUrl}/episodes/1000000000000000030`,
        },
      ],
    });
    expect(parseToc("<html></html>", kakuyomuWorkUrl)).toEqual({ entries: [] });
    expect(
      parseToc(
        '<script id="__NEXT_DATA__" type="application/json">{oops</script>',
        kakuyomuWorkUrl,
      ),
    ).toEqual({ entries: [] });
  });

  it("builds a kakuyomu book that spans the work, keeping the opened episode's text", () => {
    const episode = parseEpisode(kakuyomuEpisodeHtml, kakuyomuEpisodeUrl)!;
    const book = episodeToBook(
      episode,
      parseToc(kakuyomuWorkHtml, kakuyomuWorkUrl),
    );
    expect(book.chapters.map((chapter) => chapter.title)).toEqual([
      "第1話",
      "第2話",
      "第3話",
    ]);
    expect(book.chapters.map((chapter) => chapter.content.length > 0)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("merges narou pages around the episode being read, offering the neighbouring pages", () => {
    const entries = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, index) => ({
        id: String(from + index),
        title: `第${from + index}話`,
        url: `https://ncode.syosetu.com/n1234ab/${from + index}/`,
      }));
    const page = (number: number) =>
      `https://ncode.syosetu.com/n1234ab/?p=${number}`;
    const loaded: ContentNode[] = [text("本文。")];
    const restored: Book = {
      id: "narou-n1234ab",
      source: "narou",
      title: "テスト作品",
      author: "作者名",
      chapters: [
        {
          id: "250",
          title: "第250話",
          url: "https://ncode.syosetu.com/n1234ab/250/",
          content: loaded,
        },
      ],
    };
    const titles = (book: Book) =>
      book.chapters.map((chapter) => chapter.title);
    const third = mergeToc(
      restored,
      { entries: entries(201, 300), previousUrl: page(2), nextUrl: page(4) },
      page(3),
    );
    expect(titles(third)).toEqual([
      "前の100話",
      ...entries(201, 300).map((entry) => entry.title),
      "次の100話",
    ]);
    expect(
      third.chapters.find((chapter) => chapter.id === "250")?.content,
    ).toBe(loaded);
    const second = mergeToc(
      third,
      { entries: entries(101, 200), previousUrl: page(1), nextUrl: page(3) },
      page(2),
    );
    expect(titles(second)).toEqual([
      "前の100話",
      ...entries(101, 300).map((entry) => entry.title),
      "次の100話",
    ]);
    expect(second.chapters[0].url).toBe(page(1));
    expect(second.chapters.at(-1)?.url).toBe(page(4));
  });
});

describe("episode position", () => {
  const web = (
    source: Book["source"],
    ids: string[],
    episodeCount?: number,
  ): Book => ({
    id: `${source}-work`,
    source,
    title: "テスト作品",
    author: "作者名",
    episodeCount,
    chapters: ids.map((id) => ({
      id,
      title: `第${id}話`,
      url: id.startsWith("https://") ? id : `https://example.com/${id}/`,
      content: [],
    })),
  });

  it("counts a file's chapters by their order", () => {
    const book: Book = {
      id: "file-1",
      source: "file",
      title: "本",
      author: "",
      chapters: ["a", "b", "c"].map((id) => ({ id, title: id, content: [] })),
    };
    expect(episodePosition(book, 1)).toEqual({ number: 2, total: 3 });
    expect(episodePosition(book, 3)).toBeUndefined();
  });

  it("reads a narou episode's number from its id and the total from its page", () => {
    const episode = parseEpisode(narouEpisodeHtml, narouEpisodeUrl)!;
    expect(episode.episodeCount).toBe(3);
    const toc = parseToc(narouTocHtml, "https://ncode.syosetu.com/n1234ab/");
    const book = episodeToBook(episode, toc);
    const at = book.chapters.findIndex((chapter) => chapter.id === "2");
    expect(episodePosition(book, at)).toEqual({ number: 2, total: 3 });
    expect(episodePosition(book, book.chapters.length - 1)).toBeUndefined();
  });

  it("shows only the number of a narou episode until its total is known", () => {
    const book = web("narou", ["250"]);
    expect(episodePosition(book, 0)).toEqual({ number: 250 });
  });

  it("has no position for a narou short story", () => {
    const episode = parseEpisode(narouShortHtml, narouShortUrl)!;
    expect(episodePosition(episodeToBook(episode), 0)).toBeUndefined();
  });

  it("counts a whole-work TOC, but not a book that has only what was read", () => {
    const restored = web("kakuyomu", ["10", "20"]);
    expect(episodePosition(restored, 0)).toBeUndefined();
    const merged = mergeToc(restored, {
      entries: ["10", "20", "30"].map((id) => ({
        id,
        title: `第${id}話`,
        url: `https://example.com/${id}/`,
      })),
    });
    expect(episodePosition(merged, 1)).toEqual({ number: 2, total: 3 });
  });

  it("includes episodes published after the TOC was fetched", () => {
    const book = web("hameln", ["1", "2", "3"], 2);
    expect(episodePosition(book, 2)).toEqual({ number: 3, total: 3 });
  });
});

describe("pixiv", () => {
  it("reads an episode from the JSON the page itself loads, not from the page", () => {
    expect(episodeDataUrl(pixivEpisodeUrl)).toBe(pixivEpisodeDataUrl);
    expect(episodeDataUrl(narouEpisodeUrl)).toBe(narouEpisodeUrl);
    expect(parseEpisode(pixivEpisodeJson, pixivEpisodeUrl)).toMatchObject({
      source: "pixiv",
      url: pixivEpisodeUrl,
      workId: "series-77",
      workTitle: "テスト連作",
      author: "書き手",
      episodeId: "2002",
      title: "第二話　再会",
      previousUrl: "https://www.pixiv.net/novel/show.php?id=2001",
      nextUrl: "https://www.pixiv.net/novel/show.php?id=2003",
    });
  });

  it("turns pixiv's markup into paragraphs, ruby, headings and page breaks", () => {
    const episode = parseEpisode(pixivEpisodeJson, pixivEpisodeUrl);
    expect(episode!.body).toEqual([
      element("p", [
        text("　"),
        element("ruby", [text("魔法"), element("rt", [text("まほう")])]),
        text("を使った。"),
      ]),
      element("p", [element("br", [])]),
      element("p", [text("「待って」")]),
      element("hr", []),
      element("h2", [text("その夜")]),
      element("p", [text("続きはこちら")]),
      element("p", [text("終わり。")]),
    ]);
  });

  it("treats a novel outside a series as a work of one episode", () => {
    expect(parseEpisode(pixivSingleJson, pixivSingleUrl)).toMatchObject({
      workId: "novel-3003",
      workTitle: "読み切り",
      episodeId: "3003",
      previousUrl: undefined,
      nextUrl: undefined,
    });
    expect(tocUrlOf(pixivSingleUrl, "novel-3003")).toBeNull();
    expect(workUrlOf("pixiv-novel-3003")).toBe(pixivSingleUrl);
  });

  it("does not detect age-restricted novels yet", () => {
    expect(parseEpisode(pixivAdultEpisodeJson, pixivEpisodeUrl)).toBeNull();
  });

  it("rejects a response for another novel, an error and a page that is not JSON", () => {
    expect(parseEpisode(pixivSingleJson, pixivEpisodeUrl)).toBeNull();
    expect(
      parseEpisode(
        JSON.stringify({ error: true, message: "見つかりません", body: [] }),
        pixivEpisodeUrl,
      ),
    ).toBeNull();
    expect(
      parseEpisode("<html>Just a moment...</html>", pixivEpisodeUrl),
    ).toBeNull();
  });

  it("finds the series' table of contents from the work, since the episode URL does not name it", () => {
    expect(tocUrlOf(pixivEpisodeUrl)).toBeNull();
    expect(tocUrlOf(pixivEpisodeUrl, "series-77")).toBe(pixivTocUrl);
    expect(workUrlOf("pixiv-series-77")).toBe(
      "https://www.pixiv.net/novel/series/77",
    );
  });

  it("lists the available episodes of a series", () => {
    expect(parseToc(pixivTocJson, pixivTocUrl).entries).toEqual([
      {
        id: "2001",
        title: "第一話　始まり",
        url: "https://www.pixiv.net/novel/show.php?id=2001",
      },
      { id: "2002", title: "第二話　再会", url: pixivEpisodeUrl },
      {
        id: "2003",
        title: "第三話　別れ",
        url: "https://www.pixiv.net/novel/show.php?id=2003",
      },
    ]);
  });

  it("builds a book spanning the series with the open episode filled in", () => {
    const episode = parseEpisode(pixivEpisodeJson, pixivEpisodeUrl)!;
    const book = episodeToBook(episode, parseToc(pixivTocJson, pixivTocUrl));
    expect(book).toMatchObject({
      id: "pixiv-series-77",
      source: "pixiv",
      title: "テスト連作",
      episodeCount: 3,
    });
    expect(book.chapters.map((chapter) => chapter.id)).toEqual([
      "2001",
      "2002",
      "2003",
    ]);
    expect(book.chapters[1].content.length).toBeGreaterThan(0);
    expect(episodePosition(book, 1)).toEqual({ number: 2, total: 3 });
  });
});
