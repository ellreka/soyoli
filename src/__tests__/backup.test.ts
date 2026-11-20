import {
  backupFileName,
  backupSummary,
  fromBackupFile,
  positionsToRestore,
  toBackupFile,
  withKnownVoices,
  type Backup,
} from "@/features/backup/backup";
import type { Book } from "@/features/books/book";
import {
  historyLimit,
  mergeWorks,
  type Works,
} from "@/features/library/savedWorks";

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
      content: text,
    },
    {
      id: "2",
      title: "第二話",
      url: "https://ncode.syosetu.com/n1234ab/2/",
      content: text,
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
const backup: Required<Backup> = {
  dictionary: {
    common: [{ surface: "一", reading: "いち" }],
    sets: [
      {
        id: "s1",
        name: "作品の辞書",
        entries: [{ surface: "本文", reading: "ほんもん" }],
      },
    ],
    assigned: { [web.id]: { setId: "s1", title: "Web作品" } },
  },
  settings: {
    rate: 1.5,
    pitch: 0.9,
    voice: "ja-voice",
    brackets: { kagi: { on: true, pitch: 1.2, voice: "other-voice" } },
    keepAwake: true,
    pageSound: false,
    autoNext: false,
    authorNotes: true,
  },
  works: {
    books: [web, epub],
    lastRead: { [web.id]: "2" },
    bookmarked: [web.id],
    history: { [web.id]: 2000 },
  },
  positions: {
    [web.id]: { chapterId: "2", paragraphIndex: 4 },
    [epub.id]: { chapterId: "one", paragraphIndex: 7 },
  },
};
const now = new Date(2026, 10, 14, 9, 30);

function throughFile(value: Required<Backup> = backup): Backup {
  return fromBackupFile(JSON.parse(JSON.stringify(toBackupFile(value, now))))!;
}

function works(update: Partial<Works> = {}): Works {
  return { books: [], lastRead: {}, bookmarked: [], history: {}, ...update };
}

it("names the file after the day it was written", () => {
  expect(backupFileName(now)).toBe("soyoli-backup-20261114.json");
  expect(backupFileName(new Date(2027, 0, 5))).toBe(
    "soyoli-backup-20270105.json",
  );
});

it("writes the dictionary, the voice settings and the web novels' metadata, never the text or a file", () => {
  const file = toBackupFile(backup, now);
  expect(file).toEqual({
    app: "soyoli",
    version: 1,
    exportedAt: now.toISOString(),
    dictionary: backup.dictionary,
    voice: backup.settings,
    works: [
      {
        id: web.id,
        source: "narou",
        title: "Web作品",
        author: "作者",
        episode: {
          id: "2",
          title: "第二話",
          url: "https://ncode.syosetu.com/n1234ab/2/",
        },
        readAt: 2000,
      },
    ],
    positions: { [web.id]: { chapterId: "2", paragraphIndex: 4 } },
  });
  expect(JSON.stringify(file)).not.toContain("本文。");
});

it("reads back what it wrote", () => {
  const read = throughFile();
  expect(read.dictionary).toEqual(backup.dictionary);
  expect(read.settings).toEqual(backup.settings);
  expect(read.works.books).toEqual([
    {
      id: web.id,
      source: "narou",
      title: "Web作品",
      author: "作者",
      url: "https://ncode.syosetu.com/n1234ab/2/",
      chapters: [{ ...web.chapters[1], content: [] }],
    },
  ]);
  expect(read.works.lastRead).toEqual({ [web.id]: "2" });
  expect(read.works.bookmarked).toEqual([web.id]);
  expect(read.works.history).toEqual({ [web.id]: 2000 });
  expect(read.positions).toEqual({
    [web.id]: { chapterId: "2", paragraphIndex: 4 },
  });
});

it("refuses a file that is not this app's backup", () => {
  expect(fromBackupFile(null)).toBeNull();
  expect(fromBackupFile("soyoli")).toBeNull();
  expect(fromBackupFile([])).toBeNull();
  expect(fromBackupFile({ common: [], sets: [] })).toBeNull();
  expect(fromBackupFile({ app: "other", version: 1 })).toBeNull();
});

it("drops what is broken in a file and leaves out the parts it does not have", () => {
  const read = fromBackupFile({
    app: "soyoli",
    version: 9,
    dictionary: {
      common: [
        { surface: "一", reading: "いち" },
        { surface: "", reading: 1 },
      ],
    },
    works: [
      { id: "broken" },
      {
        id: "x",
        source: "narou",
        title: "よそのページ",
        author: "",
        episode: { id: "1", title: "一", url: "https://example.com/1/" },
        readAt: 1,
      },
    ],
    positions: {
      [web.id]: { chapterId: "2", paragraphIndex: 4 },
      broken: { chapterId: 1 },
    },
  })!;
  expect(read.dictionary).toEqual({
    common: [{ surface: "一", reading: "いち" }],
    sets: [],
    assigned: {},
  });
  expect(read.settings).toBeUndefined();
  expect(read.works.books).toEqual([]);
  expect(read.positions).toEqual({});
  expect(backupSummary(read)).toBe(
    "読み方辞書（読み1件）は、バックアップの内容に置き換わります。",
  );
  expect(backupSummary(fromBackupFile({ app: "soyoli" })!)).toBe("");
});

it("falls back to defaults for settings out of range", () => {
  const read = fromBackupFile({
    app: "soyoli",
    voice: { rate: 99, pitch: "high", voice: 3, brackets: [], keepAwake: 1 },
  })!;
  expect(read.settings).toEqual({
    rate: 1,
    pitch: 1,
    voice: undefined,
    brackets: {},
    keepAwake: false,
    pageSound: true,
    autoNext: true,
    authorNotes: false,
  });
});

it("tells the reader what a backup will replace and add", () => {
  expect(backupSummary(throughFile())).toBe(
    "読み方辞書（読み2件）と音声設定は、バックアップの内容に置き換わります。\n" +
      "本棚と履歴には、バックアップのWeb小説1件が加わります。今ある作品は残ります。",
  );
});

it("reads with the device's default voice where this device lacks the backed-up voice", () => {
  expect(withKnownVoices(backup.settings, ["ja-voice"])).toEqual({
    ...backup.settings,
    brackets: { kagi: { on: true, pitch: 1.2 } },
  });
  const none = withKnownVoices(backup.settings, []);
  expect(none.voice).toBeUndefined();
  expect(none.rate).toBe(1.5);
  expect(withKnownVoices(backup.settings, ["ja-voice", "other-voice"])).toEqual(
    backup.settings,
  );
});

it("adds the backed-up web novels to a device that has none", () => {
  const read = throughFile();
  const merged = mergeWorks(works({ books: [epub] }), read.works);
  expect(merged.books.map((book) => book.id)).toEqual([web.id, epub.id]);
  expect(merged.bookmarked).toEqual([web.id]);
  expect(merged.lastRead).toEqual({ [web.id]: "2" });
  expect(merged.history).toEqual({ [web.id]: 2000 });
  expect(positionsToRestore(read, works({ books: [epub] }))).toEqual(
    read.positions,
  );
});

it("keeps the device's place in a work read more recently than the backup", () => {
  const read = throughFile();
  const current = works({
    books: [web],
    lastRead: { [web.id]: "1" },
    history: { [web.id]: 3000 },
  });
  const merged = mergeWorks(current, read.works);
  expect(merged.bookmarked).toEqual([web.id]);
  expect(merged.books).toEqual([web]);
  expect(merged.lastRead).toEqual({ [web.id]: "1" });
  expect(merged.history).toEqual({ [web.id]: 3000 });
  expect(positionsToRestore(read, current)).toEqual({});
});

it("takes the backup's place in a work the backup read later", () => {
  const read = throughFile();
  const current = works({
    books: [web],
    lastRead: { [web.id]: "1" },
    bookmarked: [web.id],
    history: { [web.id]: 1000 },
  });
  const merged = mergeWorks(current, read.works);
  expect(merged.books).toEqual([web]);
  expect(merged.bookmarked).toEqual([web.id]);
  expect(merged.lastRead).toEqual({ [web.id]: "2" });
  expect(merged.history).toEqual({ [web.id]: 2000 });
  expect(positionsToRestore(read, current)).toEqual(read.positions);
  expect(mergeWorks(current, read.works, web.id).lastRead).toEqual({
    [web.id]: "1",
  });
  expect(positionsToRestore(read, current, web.id)).toEqual({});
});

it("swaps in the backup's episode for a work the device holds without its text", () => {
  const read = throughFile();
  const stub: Book = {
    ...web,
    url: web.chapters[0].url,
    chapters: [{ ...web.chapters[0], content: [] }],
  };
  const merged = mergeWorks(
    works({ books: [stub], lastRead: { [web.id]: "1" } }),
    read.works,
  );
  expect(merged.books).toEqual(read.works.books);
  expect(merged.lastRead).toEqual({ [web.id]: "2" });
});

it("leaves a work alone when its loaded episodes do not include the backup's", () => {
  const read = throughFile();
  const partial: Book = { ...web, chapters: [web.chapters[0]] };
  const current = works({ books: [partial], lastRead: { [web.id]: "1" } });
  const merged = mergeWorks(current, read.works);
  expect(merged.books).toEqual([partial]);
  expect(merged.lastRead).toEqual({ [web.id]: "1" });
  expect(merged.history).toEqual({});
});

it("does not touch a file's work that happens to share an id", () => {
  const read = throughFile();
  const file: Book = { ...epub, id: web.id };
  const merged = mergeWorks(works({ books: [file] }), read.works);
  expect(merged).toEqual(works({ books: [file] }));
});

it("keeps the history within its limit after a merge", () => {
  const history = Object.fromEntries(
    Array.from({ length: historyLimit }, (_, index) => [
      `narou-n${index}`,
      5000 + index,
    ]),
  );
  const merged = mergeWorks(works({ history }), throughFile().works);
  expect(Object.keys(merged.history)).toHaveLength(historyLimit);
  expect(merged.history[web.id]).toBeUndefined();
  expect(merged.bookmarked).toEqual([web.id]);
});
