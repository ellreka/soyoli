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
} from "@/__fixtures__/webPages";
import type { Book, ContentNode } from "@/features/books/book";
import {
  episodeContent,
  episodeToBook,
  mayBeEpisodeUrl,
  mergeToc,
  parseEpisode,
  parseToc,
  tocUrlOf,
} from "@/features/web/episode";
import { workPageOf, workUrlOf } from "@/features/web/sites";

/** 段落の間にある改行だけのテキストノードを落とす。 */
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
    // 前書きと後書きは本文とは別に持つ。
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
    // 一覧のタイトルは、その下に書かれた日付を含まない。
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
    // 一覧のある作品ページは、話ではない。
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
      chapters: [
        {
          id: "2",
          title: "第二話　出会い",
          url: narouEpisodeUrl,
          // ページのタイトルが本文の先頭に来るので、表示も読み上げもされる。
          content: episodeContent("第二話　出会い", episode.body),
        },
        // 目次がなくても、ページの「次へ」リンクで次の話にたどり着ける。
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
      // ページャーの 次へ リンクが、次の目次ページを知らせる。
      previousUrl: undefined,
      nextUrl: "https://ncode.syosetu.com/n1234ab/?p=2",
    });
    // 話のページは目次ではない。
    expect(parseToc(narouTocHtml, kakuyomuEpisodeUrl)).toEqual({
      entries: [],
    });
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
      // 開いた話は、解析した内容を目次のタイトルの下に保つ。
      {
        id: "2",
        title: "第二話　出会い",
        url: narouEpisodeUrl,
        // ページのタイトルが本文の先頭に来るので、表示も読み上げもされる。
        content: episodeContent("第二話　出会い", episode.body),
      },
      {
        id: "3",
        title: "第三話",
        url: "https://ncode.syosetu.com/n1234ab/3/",
        content: [],
      },
      // 目次の続きには、窓の端からだけでなく、どこからでもたどり着ける。
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
    ).toEqual([
      "1:第一話",
      "2:第二話　出会い",
      // 話の「次へ」リンクは、一覧が知っていた範囲の先まで届く。
      "3:次の話",
    ]);
  });
});

describe("table of contents", () => {
  const kakuyomuWorkUrl = "https://kakuyomu.jp/works/1000000000000000001";
  // 作品ページは、一覧を描く元になるデータを一緒に送ってくる。
  const store = {
    "Work:1000000000000000001": {
      id: "1000000000000000001",
      title: "テスト作品",
      tableOfContentsV2: [
        { __ref: "TableOfContentsChapter:1" },
        { __ref: "TableOfContentsChapter:2" },
      ],
    },
    // 隣に並ぶ作品（関連作品）が紛れ込んではならない。
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
    // なろうは 100 話ごとにページを分ける: その話を含むページ。
    expect(tocUrlOf("https://ncode.syosetu.com/n1234ab/2/")).toBe(
      "https://ncode.syosetu.com/n1234ab/?p=1",
    );
    expect(tocUrlOf("https://ncode.syosetu.com/n1234ab/250/")).toBe(
      "https://ncode.syosetu.com/n1234ab/?p=3",
    );
    // カクヨム: 作品ページが一覧全体を持つ。
    expect(tocUrlOf(kakuyomuEpisodeUrl)).toBe(kakuyomuWorkUrl);
    // 短編には一覧がない。
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
    // データのないページ、データの壊れたページは、何も並べない。
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
    // 起動後の本棚にあるのは、最後に読んだ話だけ。
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
    // 読んでいる話は本文を保つ。
    expect(
      third.chapters.find((chapter) => chapter.id === "250")?.content,
    ).toBe(loaded);
    // 前のページを取得すると、その行が置き換わる。後ろのページはすでに
    // 本に入っているので、行は付かない。
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
