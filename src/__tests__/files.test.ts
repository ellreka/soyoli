import { strToU8, zipSync } from "fflate";

import { loadFiles, removeFile } from "@/features/books/fileStore";
import {
  importFiles,
  openSavedFile,
  savedFileBooks,
} from "@/features/books/import";

const mockDisk = new Map<string, Uint8Array | string>();
let mockPicked: { name: string; bytes: Uint8Array } | null = null;
let mockPickedFiles: { name: string; bytes: Uint8Array }[] | null = null;

jest.mock("expo-file-system", () => {
  const join = (parts: unknown[]) =>
    parts
      .map((part) =>
        typeof part === "string" ? part : (part as { uri: string }).uri,
      )
      .join("/");
  class Directory {
    uri: string;
    exists = true;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get name() {
      return this.uri.split("/").at(-1)!;
    }
    get exists() {
      return mockDisk.has(this.uri);
    }
    create() {
      mockDisk.set(this.uri, "");
    }
    writeSync(content: Uint8Array | string) {
      mockDisk.set(this.uri, content);
    }
    textSync() {
      return mockDisk.get(this.uri) as string;
    }
    bytes() {
      return Promise.resolve(mockDisk.get(this.uri) as Uint8Array);
    }
    delete() {
      mockDisk.delete(this.uri);
    }
    static pickFileAsync() {
      if (!mockPicked && !mockPickedFiles) {
        return Promise.resolve({ canceled: true, result: null });
      }
      return Promise.resolve({
        canceled: false,
        result: (mockPickedFiles ?? [mockPicked!]).map(({ name, bytes }) => ({
          name,
          bytes: () => Promise.resolve(bytes),
        })),
      });
    }
  }
  return { Directory, File, Paths: { document: "doc" } };
});

function epub(title: string, cover = false, metadata = ""): Uint8Array {
  const entries: Record<string, string> = {
    mimetype: "application/epub+zip",
    "META-INF/container.xml":
      '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>',
    "book.opf": `<package xmlns:dc="urn:dc"><metadata><dc:title>${title}</dc:title><dc:creator>著者</dc:creator>${metadata}</metadata>
      <manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/>
      ${cover ? '<item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>' : ""}</manifest>
      <spine><itemref idref="one"/></spine></package>`,
    "one.xhtml": "<html><body><h1>第一章</h1><p>本文。</p></body></html>",
    ...(cover ? { "cover.png": "png-bytes" } : {}),
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([path, value]) => [path, strToU8(value)]),
    ),
  );
}

function stored(): string[] {
  return [...mockDisk.keys()].filter((path) => path.startsWith("doc/books/"));
}

async function importFile() {
  const result = await importFiles();
  if (!result) {
    return null;
  }
  if (result.failed.length > 0) {
    throw new Error(result.failed[0].message);
  }
  return result.added[0];
}

beforeEach(() => {
  mockDisk.clear();
  mockPicked = null;
  mockPickedFiles = null;
});

it("keeps a mockPicked file on the device, with its cover as an image of its own", async () => {
  mockPicked = { name: "novel.epub", bytes: epub("取り込んだ本", true) };
  const book = await importFile();
  expect(book).toMatchObject({
    id: "novel.epub",
    title: "取り込んだ本",
    author: "著者",
    file: expect.stringMatching(/^[a-z0-9]+\.epub$/),
  });
  expect(book?.cover).toMatch(/^doc\/books\/[a-z0-9]+c\.png$/);
  expect(stored()).toHaveLength(2);
  expect(mockDisk.get("doc/files.json")).not.toContain("base64");
  expect(savedFileBooks()).toEqual([
    {
      id: "novel.epub",
      source: "file",
      title: "取り込んだ本",
      author: "著者",
      cover: book?.cover,
      file: book?.file,
      chapters: [],
    },
  ]);
  const opened = await openSavedFile("novel.epub");
  expect(opened.chapters.map((chapter) => chapter.title)).toEqual(["第一章"]);
  expect(opened.cover).toBe(book?.cover);
});

it("knows a file by its contents when its name does not say what it is", async () => {
  mockPicked = { name: "msf%3A31", bytes: epub("名前のない本") };
  const book = await importFile();
  expect(book?.id).toBe("名前のない本.epub");
  expect(book?.file).toMatch(/\.epub$/);
  expect((await openSavedFile("名前のない本.epub")).title).toBe("名前のない本");
});

it("replaces what was kept when a file of the same name is taken in again", async () => {
  mockPicked = { name: "novel.epub", bytes: epub("初版", true) };
  await importFile();
  mockPicked = { name: "novel.epub", bytes: epub("改訂版") };
  await importFile();
  expect(loadFiles().map((file) => file.title)).toEqual(["改訂版"]);
  expect(stored()).toHaveLength(1);
});

it("keeps the series a file names, and catches up on a work taken in before it did", async () => {
  const named =
    '<meta name="calibre:series" content="銀河の旅"/><meta name="calibre:series_index" content="2"/>';
  mockPicked = { name: "novel.epub", bytes: epub("星の海", false, named) };
  const series = { name: "銀河の旅", position: 2 };
  expect((await importFile())?.series).toEqual(series);
  expect(savedFileBooks()[0].series).toEqual(series);
  const index = JSON.parse(mockDisk.get("doc/files.json") as string) as {
    series?: unknown;
  }[];
  delete index[0].series;
  mockDisk.set("doc/files.json", JSON.stringify(index));
  expect(savedFileBooks()[0].series).toBeUndefined();
  expect((await openSavedFile("novel.epub")).series).toEqual(series);
  expect(savedFileBooks()[0].series).toEqual(series);
  mockDisk.set(
    "doc/files.json",
    JSON.stringify([{ ...index[0], series: { name: 3 } }]),
  );
  expect(loadFiles()[0].series).toBeUndefined();
});

it("takes in several files at once, and keeps the rest when one cannot be read", async () => {
  mockPickedFiles = [
    { name: "one.epub", bytes: epub("一冊目") },
    { name: "broken.epub", bytes: new Uint8Array([1, 2, 3]) },
    { name: "two.epub", bytes: epub("二冊目") },
  ];
  const progress: [number, number][] = [];
  const result = await importFiles((done, total) => {
    progress.push([done, total]);
  });
  expect(result?.added.map((book) => book.title)).toEqual(["一冊目", "二冊目"]);
  expect(result?.failed).toEqual([
    { name: "broken.epub", message: expect.any(String) },
  ]);
  expect(progress).toEqual([
    [0, 3],
    [1, 3],
    [2, 3],
  ]);
  expect(result?.added.every((book) => book.chapters.length === 0)).toBe(true);
  expect(
    savedFileBooks()
      .map((book) => book.title)
      .sort(),
  ).toEqual(["一冊目", "二冊目"]);
  expect((await openSavedFile("two.epub")).chapters).toHaveLength(1);
});

it("deletes a kept work's file and forgets it", async () => {
  mockPicked = { name: "novel.epub", bytes: epub("消す本", true) };
  await importFile();
  removeFile("novel.epub");
  expect(stored()).toEqual([]);
  expect(savedFileBooks()).toEqual([]);
  await expect(openSavedFile("novel.epub")).rejects.toThrow(
    "保存したファイルが見つかりません。",
  );
});

it("keeps nothing of a file it cannot read, or when the picker is closed", async () => {
  expect(await importFile()).toBeNull();
  mockPicked = { name: "notes.txt", bytes: strToU8("text") };
  await expect(importFile()).rejects.toThrow(
    "この形式のファイルには対応していません。",
  );
  mockPicked = { name: "broken.epub", bytes: new Uint8Array([1, 2, 3]) };
  await expect(importFile()).rejects.toThrow();
  expect(stored()).toEqual([]);
  expect(loadFiles()).toEqual([]);
});

it("drops index entries that are malformed or point outside the store", () => {
  mockDisk.set(
    "doc/files.json",
    JSON.stringify([
      { id: "a.epub", title: "正しい本", author: "著者", file: "abc.epub" },
      { id: "b.epub", title: "外を指す本", file: "../secret.epub" },
      { id: "c.epub", title: "", file: "abc.epub" },
      { id: "a.epub", title: "重複", file: "def.epub" },
      null,
    ]),
  );
  expect(loadFiles().map((file) => file.title)).toEqual(["正しい本"]);
});
