import {
  importFiles,
  openSavedFile,
  savedFileBooks,
} from "@/features/books/import";
import { checkPdfText, openPdf, readPdfPages } from "@/features/books/pdf";
import { pdfParagraphs } from "@/features/books/pdfText";

const mockDisk = new Map<string, Uint8Array | string>();
let mockPicked: { name: string; bytes: Uint8Array } | null = null;
/** ネイティブのリーダーから見た PDF: 各ページの文字、または失敗。 */
let mockPdf: { title?: string; author?: string; pages: string[] } | Error = {
  pages: [],
};

/** ネイティブ側が描いた最初のページ: base64 の JPEG、または ""。 */
let mockCover = "";

jest.mock("../../modules/pdf-text/src/PdfTextModule", () => ({
  __esModule: true,
  default: {
    info: jest.fn((uri: string) =>
      mockPdf instanceof Error
        ? Promise.reject(mockPdf)
        : Promise.resolve({
            uri,
            pages: mockPdf.pages.length,
            title: mockPdf.title ?? "",
            author: mockPdf.author ?? "",
          }),
    ),
    cover: jest.fn(() => Promise.resolve(mockCover)),
    texts: jest.fn((_uri: string, pages: number[]) =>
      mockPdf instanceof Error
        ? Promise.reject(mockPdf)
        : Promise.resolve(
            pages.map(
              (page) => (mockPdf as { pages: string[] }).pages[page] ?? "",
            ),
          ),
    ),
  },
}));

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
      if (!mockPicked) {
        return Promise.resolve({ canceled: true, result: null });
      }
      const { name, bytes } = mockPicked;
      return Promise.resolve({
        canceled: false,
        result: [{ name, bytes: () => Promise.resolve(bytes) }],
      });
    }
  }
  return { Directory, File, Paths: { document: "doc", cache: "cache" } };
});

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

/** ファイルを 1 つ取り込む: 入った作品を返し、入らなければその理由で投げる。 */
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
  mockPdf = { pages: [] };
  mockCover = "";
});

describe("pdfParagraphs", () => {
  it("puts lines wrapped by the page back together", () => {
    expect(
      pdfParagraphs([
        "　吾輩は猫である。名前はまだ無い。どこで生れ\nたかとんと見当がつかぬ。\n　何でも薄暗いじめじめした所でニャーニャー泣\nいていた事だけは記憶している。",
      ]),
    ).toEqual([
      "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。",
      "何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。",
    ]);
  });

  it("starts a paragraph after a line cut short, and at speech", () => {
    expect(
      pdfParagraphs([
        "第一章\n長い長い一行がここにあって右の端まで届いている。\n「そうか」\n「そうだ」\n長い長い一行がここにあって右の端まで届いていて\n次の行に続く。",
      ]),
    ).toEqual([
      "第一章",
      "長い長い一行がここにあって右の端まで届いている。",
      "「そうか」",
      "「そうだ」",
      "長い長い一行がここにあって右の端まで届いていて次の行に続く。",
    ]);
  });

  it("drops page numbers and running heads, and joins across a page break", () => {
    expect(
      pdfParagraphs([
        "坊っちゃん\n親譲りの無鉄砲で小供の時から損ばかりしている。小学校に\n1",
        "坊っちゃん\n居る時分学校の二階から飛び降りて一週間ほど腰を抜かした\n- 2 -",
        "坊っちゃん\n事がある。\n3",
      ]),
    ).toEqual([
      "親譲りの無鉄砲で小供の時から損ばかりしている。小学校に居る時分学校の二階から飛び降りて一週間ほど腰を抜かした事がある。",
    ]);
  });

  it("keeps a space between words in Latin letters", () => {
    expect(
      pdfParagraphs(["This line is wrapped by the page and\ngoes on here."]),
    ).toEqual(["This line is wrapped by the page and goes on here."]);
  });

  it("compares lines by the room they take, not by their number of letters", () => {
    // 英字や点線リーダーの行は、日本語で埋まった行の倍の文字数になる。
    // そのせいで、そうした行がすべて「短い」と判定されてはならない。
    const leaders = Array.from(
      { length: 6 },
      (_, index) => `1.${index} Section ${". ".repeat(28)}${index}`,
    );
    expect(
      pdfParagraphs([
        [
          ...leaders,
          "はじめに",
          "本書は、ブラウザにおける本格的な画面の入門書です。とは言っても、本書に現",
          "れる画面は一般的なアプリケーションではあまり現れないかもしれません。",
        ].join("\n"),
      ]).at(-1),
    ).toBe(
      "本書は、ブラウザにおける本格的な画面の入門書です。とは言っても、本書に現れる画面は一般的なアプリケーションではあまり現れないかもしれません。",
    );
  });

  it("gives nothing for pages without text", () => {
    expect(pdfParagraphs(["", "  \n"])).toEqual([]);
  });
});

describe("openPdf", () => {
  it("cuts the file into chapters of ten pages, without their text", async () => {
    mockPdf = {
      title: "題名",
      author: "著者",
      pages: Array.from({ length: 23 }, (_, index) => `${index}ページ目。`),
    };
    const book = await openPdf("file:///a.pdf", "a.pdf");
    expect(book).toMatchObject({ id: "a.pdf", title: "題名", author: "著者" });
    expect(book.chapters).toEqual([
      { id: "p1", title: "p.1–10", content: [], pages: { from: 0, count: 10 } },
      {
        id: "p11",
        title: "p.11–20",
        content: [],
        pages: { from: 10, count: 10 },
      },
      {
        id: "p21",
        title: "p.21–23",
        content: [],
        pages: { from: 20, count: 3 },
      },
    ]);
  });

  it("names a file without a title after the file", async () => {
    mockPdf = { pages: ["本文。"] };
    const book = await openPdf("file:///a.pdf", "論文.pdf");
    expect(book.title).toBe("論文");
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(["p.1"]);
  });

  it("says why a file with a password cannot be read", async () => {
    mockPdf = Object.assign(new Error("locked"), { code: "ERR_PDF_LOCKED" });
    await expect(openPdf("file:///a.pdf", "a.pdf")).rejects.toThrow(
      "パスワードが付いたファイルには対応していません。",
    );
  });
});

it("reads the text of a chapter's pages only", async () => {
  mockPdf = { pages: ["一ページ目。", "二ページ目の本文。", "三ページ目。"] };
  expect(await readPdfPages("file:///a.pdf", { from: 1, count: 1 })).toEqual([
    {
      type: "element",
      tag: "p",
      children: [{ type: "text", text: "二ページ目の本文。" }],
    },
  ]);
});

it("refuses a file whose pages are pictures", async () => {
  mockPdf = { pages: ["", " ", "", "", "", "", ""] };
  await expect(checkPdfText("file:///a.pdf")).rejects.toThrow(
    "このファイルには文字の情報がありません。",
  );
  mockPdf = { pages: ["", "", "", "", "", "", "最後のページにだけ本文。"] };
  await expect(checkPdfText("file:///a.pdf")).resolves.toBeUndefined();
});

it("takes a PDF in, keeps it on the device and opens it without its text", async () => {
  mockPdf = {
    title: "取り込んだ資料",
    pages: ["一ページ目の本文。", "二ページ目。"],
  };
  mockPicked = { name: "paper.pdf", bytes: pdfBytes };
  const book = await importFile();
  expect(book).toMatchObject({
    id: "paper.pdf",
    title: "取り込んだ資料",
    file: expect.stringMatching(/^[a-z0-9]+\.pdf$/),
  });
  // ネイティブのリーダー用に作ったコピーは消え、保存したファイルは残っている。
  expect(
    [...mockDisk.keys()].filter((path) => path.startsWith("cache")),
  ).toEqual([]);
  expect(mockDisk.get(`doc/books/${book?.file}`)).toBe(pdfBytes);
  expect(savedFileBooks()).toMatchObject([{ id: "paper.pdf", chapters: [] }]);
  const opened = await openSavedFile("paper.pdf");
  expect(opened.chapters).toEqual([
    { id: "p1", title: "p.1–2", content: [], pages: { from: 0, count: 2 } },
  ]);
});

it("knows a PDF by its contents, and keeps nothing of one it refuses", async () => {
  mockPdf = { title: "無題の資料", pages: ["本文。"] };
  mockPicked = { name: "document:1234", bytes: pdfBytes };
  expect(await importFile()).toMatchObject({ id: "無題の資料.pdf" });

  mockDisk.clear();
  mockPdf = { pages: ["", ""] };
  mockPicked = { name: "scan.pdf", bytes: pdfBytes };
  await expect(importFile()).rejects.toThrow("文字の情報がありません");
  expect([...mockDisk.keys()]).toEqual([]);
});

it("keeps the first page as the cover, an image of its own", async () => {
  mockPdf = { title: "表紙のある資料", pages: ["本文。"] };
  mockCover = btoa("jpeg-bytes");
  mockPicked = { name: "cover.pdf", bytes: pdfBytes };
  const book = await importFile();
  expect(book?.cover).toMatch(/^doc\/books\/[a-z0-9]+c\.jpeg$/);
  expect(mockDisk.get("doc/files.json")).not.toContain("base64");
  // 以後の表紙は保存した画像。ページを描き直すことはない。
  expect(savedFileBooks()[0].cover).toBe(book?.cover);
  expect((await openSavedFile("cover.pdf")).cover).toBe(book?.cover);
});

it("takes a PDF in without a cover when the page cannot be drawn", async () => {
  mockPdf = { pages: ["本文。"] };
  mockPicked = { name: "plain.pdf", bytes: pdfBytes };
  expect((await importFile())?.cover).toBeUndefined();
});
