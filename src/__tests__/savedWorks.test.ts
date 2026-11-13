import type { Book } from "@/features/books/book";
import { initial } from "@/features/library/BookCover";
import { dayLabel } from "@/features/library/history";
import {
  fromSavedWorks,
  historyLimit,
  lastReadChapter,
  toSavedWorks,
  withRead,
  type History,
} from "@/features/library/savedWorks";
import { isTocMarker } from "@/features/web/episode";

const text = [{ type: "text" as const, text: "本文。" }];
const web: Book = {
  id: "narou-n1234ab",
  source: "narou",
  title: "Web作品",
  author: "作者",
  url: "https://ncode.syosetu.com/n1234ab/2/",
  chapters: [
    {
      id: "1",
      title: "第一話",
      url: "https://ncode.syosetu.com/n1234ab/1/",
      content: [],
    },
    {
      id: "2",
      title: "第二話",
      url: "https://ncode.syosetu.com/n1234ab/2/",
      content: text,
    },
    {
      id: "https://ncode.syosetu.com/n1234ab/?p=2",
      title: "次の100話",
      url: "https://ncode.syosetu.com/n1234ab/?p=2",
      content: [],
    },
  ],
};
const epub: Book = {
  id: "sample-01",
  source: "file",
  title: "EPUB作品",
  author: "著者",
  chapters: [{ id: "one", title: "第一章", content: text }],
};

const marked = [web.id];

it("keeps only bookmarked web novels: their metadata and the last-read episode, never the text", () => {
  const saved = toSavedWorks([web, epub], { [web.id]: "1" }, [web.id, epub.id]);
  expect(saved).toEqual([
    {
      id: "narou-n1234ab",
      source: "narou",
      title: "Web作品",
      author: "作者",
      episode: {
        id: "1",
        title: "第一話",
        url: "https://ncode.syosetu.com/n1234ab/1/",
      },
    },
  ]);
  expect(JSON.stringify(saved)).not.toContain("本文。");
  // 読んだだけの Web 小説は書き込まれない。
  expect(toSavedWorks([web, epub], { [web.id]: "1" }, [])).toEqual([]);
});

it("falls back to the episode a work was added with until one is marked read", () => {
  expect(lastReadChapter(web, {})?.id).toBe("2");
  expect(lastReadChapter(web, { [web.id]: "gone" })?.id).toBe("2");
  expect(toSavedWorks([web], {}, marked)[0].episode.id).toBe("2");
  // 開き直す手がかりがない: その作品は一切書き込まれない。
  expect(toSavedWorks([{ ...web, url: undefined }], {}, marked)).toEqual([]);
});

it("tells a table-of-contents marker from an episode", () => {
  expect(isTocMarker(web.chapters[2])).toBe(true);
  // まだ取得していない話と、本文が入った後の短編。
  expect(isTocMarker(web.chapters[0])).toBe(false);
  expect(
    isTocMarker({
      id: "n9999zz",
      title: "短編",
      url: "https://ncode.syosetu.com/n9999zz/",
      content: text,
    }),
  ).toBe(false);
});

it("restores a saved work as a book holding only its last-read episode", () => {
  const saved = toSavedWorks([web], { [web.id]: "1" }, marked);
  // JSON を通す。ファイルから戻ってくるときと同じ。
  expect(fromSavedWorks(JSON.parse(JSON.stringify(saved)))).toEqual({
    books: [
      {
        id: "narou-n1234ab",
        source: "narou",
        title: "Web作品",
        author: "作者",
        url: "https://ncode.syosetu.com/n1234ab/1/",
        chapters: [
          {
            id: "1",
            title: "第一話",
            url: "https://ncode.syosetu.com/n1234ab/1/",
            content: [],
          },
        ],
      },
    ],
    lastRead: { "narou-n1234ab": "1" },
    // 履歴ができる前のファイル: 保存されていたものはすべてブックマーク済みだった。
    bookmarked: ["narou-n1234ab"],
    history: {},
  });
});

it("drops anything malformed, duplicated, or pointing outside the supported sites", () => {
  const [work] = toSavedWorks([web], {}, marked);
  const restored = fromSavedWorks([
    work,
    { ...work },
    { ...work, id: "other", source: "file" },
    { ...work, id: "other", title: "" },
    { ...work, id: "other", episode: undefined },
    {
      ...work,
      id: "other",
      episode: { ...work.episode, url: "https://example.com/n1234ab/2/" },
    },
    { ...work, id: "other", episode: { ...work.episode, url: "file:///etc" } },
    null,
    "narou",
  ]);
  expect(restored.books.map((book) => book.id)).toEqual(["narou-n1234ab"]);
  const nothing = { books: [], lastRead: {}, bookmarked: [], history: {} };
  expect(fromSavedWorks(null)).toEqual(nothing);
  expect(fromSavedWorks({ id: "x" })).toEqual(nothing);
});

it("keeps a work read but not bookmarked for the history, and tells the two apart when restoring", () => {
  const history = { [web.id]: 1_700_000_000_000 };
  const saved = toSavedWorks([web, epub], { [web.id]: "1" }, [], history);
  expect(saved).toEqual([
    expect.objectContaining({
      id: web.id,
      readAt: 1_700_000_000_000,
      bookmarked: false,
    }),
  ]);
  expect(fromSavedWorks(JSON.parse(JSON.stringify(saved)))).toMatchObject({
    bookmarked: [],
    history,
  });
  // 本棚にあり、読んでもいる: 1 つのエントリが両方を持つ。
  const both = toSavedWorks([web], {}, marked, history);
  expect(both[0]).not.toHaveProperty("bookmarked");
  expect(fromSavedWorks(both)).toMatchObject({ bookmarked: marked, history });
  // どちらのためにも残さないものは落とす。数値でない時刻も同じ。
  expect(
    fromSavedWorks([{ ...both[0], readAt: undefined, bookmarked: false }])
      .books,
  ).toEqual([]);
  expect(fromSavedWorks([{ ...both[0], readAt: "today" }]).history).toEqual({});
});

it("moves a work read again to the front and drops the oldest past the limit", () => {
  let history: History = {};
  for (let index = 0; index < historyLimit; index += 1) {
    history = withRead(history, `work-${index}`, index + 1);
  }
  expect(Object.keys(history)).toHaveLength(historyLimit);
  // 作品ごとに 1 行: 読み直しても時刻が動くだけ。
  history = withRead(history, "work-0", 1000);
  expect(Object.keys(history)).toHaveLength(historyLimit);
  expect(history["work-0"]).toBe(1000);
  // 新しい作品が、いちばん前に読んだものを押し出す。
  history = withRead(history, "new", 2000);
  expect(Object.keys(history)).toHaveLength(historyLimit);
  expect(history).not.toHaveProperty("work-1");
  expect(history).toHaveProperty("work-0");
});

it("labels the days of the history", () => {
  const now = new Date(2026, 10, 11, 9).getTime();
  expect(dayLabel(new Date(2026, 10, 11, 0, 1).getTime(), now)).toBe("今日");
  expect(dayLabel(new Date(2026, 10, 10, 23, 59).getTime(), now)).toBe("昨日");
  expect(dayLabel(new Date(2026, 10, 8).getTime(), now)).toBe("11月8日");
  expect(dayLabel(new Date(2025, 11, 31).getTime(), now)).toBe(
    "2025年12月31日",
  );
});

it("stands for a title with its first letter, past brackets and symbols", () => {
  expect(initial("病毒の王")).toBe("病");
  expect(initial("【書籍化】Ｒｅ：ゼロ")).toBe("書");
  expect(initial("「」…")).toBe("");
});
