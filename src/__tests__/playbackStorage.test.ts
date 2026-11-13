import {
  loadPlayback,
  savePlayback,
  savedPositions,
} from "@/features/player/storage";

/** 偽の端末が持っているもの。パスごと。 */
const mockDisk = new Map<string, string>();

jest.mock("expo-file-system", () => {
  class File {
    uri: string;
    constructor(...parts: string[]) {
      this.uri = parts.join("/");
    }
    get exists() {
      return mockDisk.has(this.uri);
    }
    create() {
      mockDisk.set(this.uri, "");
    }
    writeSync(content: string) {
      mockDisk.set(this.uri, content);
    }
    textSync() {
      return mockDisk.get(this.uri);
    }
  }
  return { File, Paths: { document: "doc" } };
});

beforeEach(() => {
  mockDisk.clear();
});

it("reads the positions a version before the rename saved as sentences", () => {
  mockDisk.set(
    "doc/playback.json",
    JSON.stringify({
      bookId: "book",
      chapterIndex: 1,
      sentenceIndex: 4,
      positions: { book: { chapterId: "one", sentenceIndex: 4 } },
      rate: 1.5,
      pitch: 1,
    }),
  );
  const saved = loadPlayback();
  expect(saved).toMatchObject({
    bookId: "book",
    chapterIndex: 1,
    paragraphIndex: 4,
    rate: 1.5,
  });
  expect(savedPositions(saved)).toEqual({
    book: { chapterId: "one", paragraphIndex: 4 },
  });
});

it("writes the file under the names it has always had", () => {
  savePlayback({
    bookId: "book",
    chapterIndex: 0,
    paragraphIndex: 2,
    positions: { book: { chapterId: "one", paragraphIndex: 2 } },
    rate: 1,
    pitch: 1,
  });
  expect(JSON.parse(mockDisk.get("doc/playback.json") ?? "")).toEqual({
    bookId: "book",
    chapterIndex: 0,
    sentenceIndex: 2,
    positions: { book: { chapterId: "one", sentenceIndex: 2 } },
    rate: 1,
    pitch: 1,
  });
});

it("reads nothing from a file that is not there or not JSON", () => {
  expect(loadPlayback()).toBeNull();
  mockDisk.set("doc/playback.json", "{");
  expect(loadPlayback()).toBeNull();
});
