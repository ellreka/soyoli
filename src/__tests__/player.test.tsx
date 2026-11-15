import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Audio from "expo-audio";
import * as Speech from "expo-speech";

import type { Book, ContentNode } from "@/features/books/book";
import * as DictionaryModule from "@/features/dictionary/Dictionary";
import { emptyDictionary } from "@/features/dictionary/entries";
import { PlaybackProvider, usePlayback } from "@/features/player/Playback";
import * as PageSound from "@/features/player/pageSound";
import {
  bookProgress,
  movePosition,
  parseChapter,
  positionAt,
  toParagraphs,
} from "@/features/books/paragraphs";
import { loadPlayback, savePlayback } from "@/features/player/storage";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
  maxSpeechInputLength: 4000,
  VoiceQuality: { Default: "Default" },
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/features/player/storage", () => ({
  ...jest.requireActual("@/features/player/storage"),
  loadPlayback: jest.fn(() => null),
  savePlayback: jest.fn(),
}));
jest.mock("expo-media-control", () =>
  jest.requireActual("../../__mocks__/expo-media-control"),
);

const image: ContentNode = {
  type: "image",
  uri: "data:image/png;base64,YQ==",
  alt: "挿絵",
};
const book: Book = {
  id: "book",
  source: "file",
  title: "作品",
  author: "著者",
  chapters: [
    { id: "cover", title: "口絵", content: [image] },
    {
      id: "one",
      title: "第一章",
      content: [{ type: "text", text: "一文目。\n二文目。" }],
    },
    { id: "image", title: "挿絵", content: [image] },
    {
      id: "two",
      title: "第二章",
      content: [{ type: "text", text: "最終文。" }],
    },
  ],
};

beforeEach(() => {
  jest.mocked(Speech.speak).mockClear();
  jest.mocked(Speech.stop).mockReset().mockResolvedValue();
  jest.mocked(Speech.getAvailableVoicesAsync).mockReset().mockResolvedValue([]);
  jest.mocked(loadPlayback).mockReset().mockReturnValue(null);
  jest.mocked(savePlayback).mockClear();
  // ページめくりの後に間を置かない。その間を試すテストだけは別。
  jest.spyOn(PageSound, "pageTurnWait").mockReturnValue(0);
  jest.mocked(activateKeepAwakeAsync).mockClear();
  jest.mocked(deactivateKeepAwake).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function setup() {
  const hook = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  await act(async () => {
    hook.result.current.openBook(book);
  });
  await act(async () => {
    hook.result.current.seekChapter(1);
  });
  return hook;
}
function done() {
  const options = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!;
  (options.onDone as () => void)();
}

it("extracts paragraphs without images or duplicate ruby and retains unannotated ruby text", () => {
  const nodes: ContentNode[] = [
    image,
    {
      type: "element",
      tag: "p",
      children: [
        { type: "text", text: "「こんにちは。」次は" },
        {
          type: "element",
          tag: "ruby",
          children: [
            { type: "text", text: "漢" },
            {
              type: "element",
              tag: "rp",
              children: [{ type: "text", text: "（" }],
            },
            {
              type: "element",
              tag: "rt",
              children: [{ type: "text", text: "かん" }],
            },
            {
              type: "element",
              tag: "rp",
              children: [{ type: "text", text: "）" }],
            },
            { type: "text", text: "字" },
          ],
        },
        { type: "text", text: "です！" },
      ],
    },
    {
      type: "element",
      tag: "p",
      children: [{ type: "text", text: "次の段落" }],
    },
  ];
  expect(toParagraphs(nodes)).toEqual([
    // 段落は、文がいくつ入っていても 1 つの単位。
    {
      text: "「こんにちは。」次は漢字です！",
      speech: "「こんにちは。」次はかん字です！",
      ruby: [{ start: 10, length: 1, reading: "かん" }],
    },
    { text: "次の段落", speech: "次の段落" },
  ]);
  expect(
    toParagraphs([{ type: "text", text: "あ".repeat(2001) }]).map(
      (paragraph) => paragraph.speech.length,
    ),
  ).toEqual([1000, 1000, 1]);
});

it("splits a chapter into display blocks with paragraph starts, indents and images", () => {
  const paragraph = (text: string): ContentNode => ({
    type: "element",
    tag: "p",
    children: [{ type: "text", text }],
  });
  const { paragraphs, blocks } = parseChapter([
    paragraph("　一文目。二文目。"),
    image,
    paragraph("「三文目。」"),
  ]);
  expect(paragraphs.map((paragraph) => paragraph.text)).toEqual([
    "　一文目。二文目。",
    "「三文目。」",
  ]);
  expect(paragraphs[0].speech).toBe("一文目。二文目。");
  expect(blocks).toEqual([
    { kind: "paragraph", index: 0, startsBlock: false },
    { kind: "image", uri: image.uri, alt: "挿絵" },
    { kind: "paragraph", index: 1, startsBlock: true },
  ]);
});

it("measures book progress in characters and maps an offset back to a paragraph", () => {
  const chapters = book.chapters.map((chapter) =>
    toParagraphs(chapter.content),
  );
  expect(
    bookProgress(chapters, { chapterIndex: 0, paragraphIndex: 0 }),
  ).toEqual({ read: 0, total: 12 });
  expect(
    bookProgress(chapters, { chapterIndex: 1, paragraphIndex: 1 }),
  ).toEqual({ read: 4, total: 12 });
  expect(
    bookProgress(chapters, { chapterIndex: 3, paragraphIndex: 0 }),
  ).toEqual({ read: 8, total: 12 });
  expect(positionAt(chapters, 0)).toEqual({
    chapterIndex: 1,
    paragraphIndex: 0,
  });
  expect(positionAt(chapters, 5)).toEqual({
    chapterIndex: 1,
    paragraphIndex: 1,
  });
  expect(positionAt(chapters, 9)).toEqual({
    chapterIndex: 3,
    paragraphIndex: 0,
  });
  expect(positionAt(chapters, 99)).toEqual({
    chapterIndex: 3,
    paragraphIndex: 0,
  });
  expect(positionAt([], 0)).toBeNull();
});

it("skips image chapters for paragraph movement but includes them for chapter movement", () => {
  const chapters = book.chapters.map((chapter) =>
    toParagraphs(chapter.content),
  );
  expect(
    movePosition(chapters, { chapterIndex: 1, paragraphIndex: 0 }, -1),
  ).toBeNull();
  expect(
    movePosition(chapters, { chapterIndex: 1, paragraphIndex: 1 }, 1),
  ).toEqual({ chapterIndex: 3, paragraphIndex: 0 });
  expect(
    movePosition(chapters, { chapterIndex: 3, paragraphIndex: 0 }, -1),
  ).toEqual({ chapterIndex: 1, paragraphIndex: 1 });
  expect(
    movePosition(
      chapters,
      { chapterIndex: 3, paragraphIndex: 0 },
      -1,
      "chapter",
    ),
  ).toEqual({ chapterIndex: 2, paragraphIndex: 0 });
  expect(
    movePosition(chapters, { chapterIndex: 3, paragraphIndex: 0 }, 1),
  ).toBeNull();
});

it("starts a selected text chapter paused and ignores stale completion after a pause", async () => {
  const { result } = await setup();
  expect(result.current.state.chapterIndex).toBe(1);
  expect(Speech.speak).not.toHaveBeenCalled();
  await act(async () => {
    result.current.toggle();
  });
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "一文目。",
    expect.objectContaining({ language: "ja-JP", rate: 1 }),
  );
  const stale = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!
    .onDone as () => void;
  await act(async () => {
    result.current.toggle();
    stale();
  });
  expect(result.current.state.playing).toBe(false);
  expect(result.current.state.paragraphIndex).toBe(0);
  await act(async () => {
    result.current.toggle();
  });
  await act(async () => {
    done();
  });
  expect(result.current.state.paragraphIndex).toBe(1);
  expect(Speech.speak).toHaveBeenLastCalledWith("二文目。", expect.any(Object));
  await act(async () => {
    done();
  });
  expect(result.current.state.chapterIndex).toBe(3);
  await act(async () => {
    done();
  });
  expect(result.current.state.playing).toBe(false);
});

it("does not enqueue an obsolete utterance if an earlier native stop resolves late", async () => {
  const { result } = await setup();
  let release!: () => void;
  jest.mocked(Speech.stop).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await act(async () => {
    result.current.toggle();
  });
  await act(async () => {
    result.current.seekParagraph(1);
  });
  await act(async () => {
    release();
  });
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  expect(Speech.speak).toHaveBeenCalledWith("二文目。", expect.any(Object));
});

it("stops at a chapter boundary without losing the next listening position", async () => {
  const { result } = await setup();
  await act(async () => {
    result.current.setSleepTimer("chapter");
    result.current.toggle();
  });
  await act(async () => {
    done();
  });
  expect(result.current.state.playing).toBe(true);
  await act(async () => {
    done();
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 3,
    paragraphIndex: 0,
    playing: false,
  });
  expect(result.current.timer).toBeNull();
});

it("stops at the end of an episode when it is not to read on, without restarting what it reads", async () => {
  const { result } = await setup();
  await act(async () => {
    result.current.toggle();
  });
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  // 読み上げ中に切り替えても、読んでいる段落はやり直さない。
  await act(async () => {
    result.current.setAutoNext(false);
  });
  expect(result.current.settings.autoNext).toBe(false);
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  expect(result.current.state.playing).toBe(true);
  await act(async () => {
    done();
  });
  expect(result.current.state.playing).toBe(true);
  await act(async () => {
    done();
  });
  // 次の話の先頭で止まる: 再生を押せば、そこから読む。
  expect(result.current.state).toMatchObject({
    chapterIndex: 3,
    paragraphIndex: 0,
    playing: false,
  });
});

it("waits for the current paragraph to finish when the sleep deadline passes", async () => {
  jest.useFakeTimers();
  const { result } = await setup();
  await act(async () => {
    result.current.setSleepTimer(Date.now() + 5000);
    result.current.toggle();
  });
  await act(async () => {
    jest.advanceTimersByTime(6000);
  });
  expect(result.current.state.playing).toBe(true);
  await act(async () => {
    done();
  });
  expect(result.current.state.playing).toBe(false);
  expect(result.current.state.paragraphIndex).toBe(1);
  expect(result.current.timer).toBeNull();
  expect(Speech.speak).toHaveBeenCalledTimes(1);
});

it("clears a sleep timer that runs out while nothing is being read", async () => {
  jest.useFakeTimers();
  const { result } = await setup();
  await act(async () => {
    result.current.setSleepTimer(Date.now() + 5000);
  });
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(result.current.timer).not.toBeNull();
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(result.current.timer).toBeNull();
  expect(result.current.state.playing).toBe(false);
  expect(Speech.speak).not.toHaveBeenCalled();
});

it("surfaces native failures without a stop/retry loop and allows an explicit retry", async () => {
  const { result } = await setup();
  jest.mocked(Speech.stop).mockRejectedValueOnce(new Error("unavailable"));
  await act(async () => {
    result.current.toggle();
  });
  expect(result.current.error).toContain("読み上げに失敗");
  expect(result.current.state.playing).toBe(false);
  await act(async () => {
    result.current.toggle();
  });
  expect(result.current.error).toBeNull();
  expect(Speech.speak).toHaveBeenCalledTimes(1);
});

it("uses actual Japanese voice IDs, adjusts rate, and rejects invalid seeks", async () => {
  const { result } = await setup();
  jest.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([
    {
      identifier: "ja-voice",
      language: "ja-JP",
      name: "日本語音声",
      quality: Speech.VoiceQuality.Default,
    },
    {
      identifier: "en-voice",
      language: "en-US",
      name: "English",
      quality: Speech.VoiceQuality.Default,
    },
  ]);
  await act(async () => {
    result.current.loadVoices();
  });
  expect(result.current.voices.map((voice) => voice.identifier)).toEqual([
    "ja-voice",
  ]);
  await act(async () => {
    result.current.setVoice("ja-voice");
    result.current.setRate(1.5);
    result.current.setPitch(1.4);
    result.current.toggle();
  });
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "一文目。",
    expect.objectContaining({ rate: 1.5, pitch: 1.4, voice: "ja-voice" }),
  );
  await act(async () => {
    result.current.seekParagraph(Number.NaN);
    result.current.seekChapter(book.chapters.length);
    result.current.setRate(100);
    for (const pitch of [Number.NaN, Number.POSITIVE_INFINITY, 0.4, 2.1]) {
      result.current.setPitch(pitch);
    }
    result.current.setVoice("missing");
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 1,
    paragraphIndex: 0,
  });
  expect(result.current.settings).toMatchObject({
    rate: 1.5,
    pitch: 1.4,
    voice: "ja-voice",
  });
});

it("opens image chapters without skipping them and pauses when browsing into one", async () => {
  const { result } = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  await act(async () => {
    result.current.openBook(book);
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 0,
    playing: false,
  });
  await act(async () => {
    result.current.toggle();
  });
  expect(Speech.speak).not.toHaveBeenCalled();
  await act(async () => {
    result.current.step(1, "chapter");
  });
  expect(result.current.state.chapterIndex).toBe(1);
  await act(async () => {
    result.current.toggle();
  });
  const stale = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!
    .onDone as () => void;
  await act(async () => {
    result.current.seekChapter(2);
    stale();
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 2,
    paragraphIndex: 0,
    playing: false,
  });
  await act(async () => {
    result.current.openBook(book);
  });
  expect(result.current.state.chapterIndex).toBe(2);
});

it("keeps the reading position when the library reloads the same book", async () => {
  const { result } = await setup();
  await act(async () => {
    result.current.seekParagraph(1);
  });
  const reloaded: Book = { ...book };
  await act(async () => {
    result.current.openBook(reloaded);
  });
  expect(result.current.state).toMatchObject({
    book: reloaded,
    chapterIndex: 1,
    paragraphIndex: 1,
  });
});

it("restores a saved position and settings when opening the same book", async () => {
  jest.mocked(loadPlayback).mockReturnValue({
    bookId: "book",
    chapterIndex: 1,
    paragraphIndex: 1,
    rate: 1.5,
    pitch: 1.4,
    voice: "ja-voice",
  });
  const { result } = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  expect(result.current.settings).toMatchObject({
    rate: 1.5,
    pitch: 1.4,
    voice: "ja-voice",
  });
  await act(async () => {
    result.current.openBook(book);
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 1,
    paragraphIndex: 1,
    playing: false,
  });
});

it("ignores a saved position from a different book but keeps the settings", async () => {
  jest.mocked(loadPlayback).mockReturnValue({
    bookId: "other",
    chapterIndex: 5,
    paragraphIndex: 9,
    rate: 2,
    pitch: 2,
    voice: "x-voice",
  });
  const { result } = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  await act(async () => {
    result.current.openBook(book);
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 0,
    paragraphIndex: 0,
  });
  expect(result.current.settings).toMatchObject({
    rate: 2,
    pitch: 2,
    voice: "x-voice",
  });
});

it("persists the reading position and settings after a delay", async () => {
  jest.useFakeTimers();
  await setup();
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(savePlayback).toHaveBeenLastCalledWith({
    bookId: "book",
    brackets: {},
    chapterIndex: 1,
    keepAwake: false,
    pageSound: true,
    autoNext: true,
    authorNotes: false,
    paragraphIndex: 0,
    rate: 1,
    pitch: 1,
    voice: undefined,
    positions: { book: { chapterId: "one", paragraphIndex: 0 } },
  });
});

it("keeps playing when the app leaves the foreground (background reading)", async () => {
  // 再生は AppState で動かしていない: 画面を消したまま読み上げることこそが
  // 目的（app.json の iOS UIBackgroundModes audio）。
  const addEventListener = jest.spyOn(AppState, "addEventListener");
  const { result } = await setup();
  await act(async () => {
    result.current.toggle();
  });
  expect(result.current.state.playing).toBe(true);
  expect(addEventListener).not.toHaveBeenCalled();
});

it("previews a voice without selecting it, advancing the book, or resuming playback", async () => {
  const { result } = await setup();
  jest.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([
    {
      identifier: "preview-voice",
      name: "試聴音声",
      language: "ja-JP",
      quality: Speech.VoiceQuality.Default,
    },
  ]);
  await act(async () => {
    result.current.loadVoices();
  });
  await act(async () => {
    result.current.setRate(1.5);
    result.current.setPitch(1.4);
    result.current.seekParagraph(1);
    result.current.toggle();
  });
  const mainDone = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!
    .onDone as () => void;
  await act(async () => {
    result.current.previewVoice("preview-voice");
  });
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "こんにちは。これは音声の試聴です。",
    expect.objectContaining({ voice: "preview-voice", rate: 1.5, pitch: 1.4 }),
  );
  expect(result.current.state).toMatchObject({
    playing: false,
    chapterIndex: 1,
    paragraphIndex: 1,
  });
  expect(result.current.settings.voice).toBeUndefined();
  const oldPreviewDone = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!
    .onDone as () => void;
  await act(async () => {
    result.current.previewVoice();
    mainDone();
    oldPreviewDone();
  });
  expect(result.current.preview).toEqual({ voice: undefined });
  await act(async () => {
    done();
  });
  expect(result.current.preview).toBeNull();
  expect(result.current.state).toMatchObject({
    playing: false,
    chapterIndex: 1,
    paragraphIndex: 1,
  });
});

it("only speaks the newest preview when an earlier native stop resolves late", async () => {
  const { result } = await setup();
  let release!: () => void;
  jest.mocked(Speech.stop).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await act(async () => {
    result.current.previewVoice();
  });
  await act(async () => {
    result.current.previewVoice();
  });
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  await act(async () => {
    release();
  });
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  expect(result.current.preview).not.toBeNull();
  await act(async () => {
    result.current.setPitch(1.2);
  });
  expect(result.current.preview).toBeNull();
  expect(result.current.state.playing).toBe(false);
});

it.each(["stop", "unmount"] as const)(
  "does not enqueue a pending preview after %s",
  async (action) => {
    const hook = await setup();
    let release!: () => void;
    jest.mocked(Speech.stop).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await act(async () => {
      hook.result.current.previewVoice();
    });
    expect(hook.result.current.preview).not.toBeNull();
    await act(async () => {
      if (action === "stop") {
        hook.result.current.stopPreview();
      }
      if (action === "unmount") {
        await hook.unmount();
      }
    });
    await act(async () => {
      release();
    });
    expect(Speech.speak).not.toHaveBeenCalled();
    if (action !== "unmount") {
      expect(hook.result.current.preview).toBeNull();
      expect(hook.result.current.state).toMatchObject({
        playing: false,
        chapterIndex: 1,
        paragraphIndex: 0,
      });
    }
  },
);

it.each(["stop", "speak", "callback"] as const)(
  "handles preview %s failures and allows a retry",
  async (failure) => {
    const { result } = await setup();
    if (failure === "stop") {
      jest.mocked(Speech.stop).mockRejectedValueOnce(new Error("unavailable"));
    }
    if (failure === "speak") {
      jest.mocked(Speech.speak).mockImplementationOnce(() => {
        throw new Error("unavailable");
      });
    }
    await act(async () => {
      result.current.previewVoice();
    });
    if (failure === "callback") {
      const options = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!;
      await act(async () => {
        (options.onError as (error: Error) => void)(new Error("unavailable"));
      });
    }
    expect(result.current.preview).toBeNull();
    expect(result.current.previewError).toContain("試聴できませんでした");
    await act(async () => {
      result.current.previewVoice();
    });
    expect(result.current.previewError).toBeNull();
    expect(result.current.preview).not.toBeNull();
  },
);

it("does not interrupt the book when closing settings without a preview", async () => {
  const { result } = await setup();
  await act(async () => {
    result.current.toggle();
  });
  await act(async () => {
    result.current.stopPreview();
    result.current.previewVoice("missing");
    done();
  });
  expect(result.current.state).toMatchObject({
    playing: true,
    paragraphIndex: 1,
  });
});

const webNovel: Book = {
  id: "narou:n0001aa",
  source: "narou",
  title: "連載",
  author: "作者",
  chapters: [
    {
      id: "1",
      title: "第一話",
      url: "https://ncode.syosetu.com/n0001aa/1/",
      content: [{ type: "text", text: "一話の文。" }],
    },
    {
      id: "2",
      title: "第二話",
      url: "https://ncode.syosetu.com/n0001aa/2/",
      content: [],
    },
    {
      id: "3",
      title: "第三話",
      url: "https://ncode.syosetu.com/n0001aa/3/",
      content: [{ type: "text", text: "三話の文。" }],
    },
  ],
};

it("moves on to the next episode at the end and reads it once its text arrives", async () => {
  const { result } = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  await act(async () => {
    result.current.openBook(webNovel);
  });
  await act(async () => {
    result.current.toggle();
  });
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "一話の文。",
    expect.any(Object),
  );
  await act(async () => {
    done();
  });
  // 次はまだ取得していない話 — その先の読み込み済みの話へ飛ばさない —
  // で、再生は止まりも失敗もせず、それを待つ。
  expect(result.current.state).toMatchObject({
    chapterIndex: 1,
    paragraphIndex: 0,
    playing: true,
  });
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBeNull();

  // チャプターローダーが取得した本文を差し込む。
  await act(async () => {
    result.current.openBook({
      ...webNovel,
      chapters: webNovel.chapters.map((chapter) =>
        chapter.id === "2"
          ? { ...chapter, content: [{ type: "text", text: "二話の文。" }] }
          : chapter,
      ),
    });
  });
  expect(result.current.state.playing).toBe(true);
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "二話の文。",
    expect.any(Object),
  );
});

it("can be paused while waiting for the next episode", async () => {
  const { result } = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  await act(async () => {
    result.current.openBook(webNovel);
  });
  await act(async () => {
    result.current.toggle();
  });
  await act(async () => {
    done();
  });
  expect(result.current.state.playing).toBe(true);
  await act(async () => {
    result.current.toggle();
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 1,
    playing: false,
  });
});

const otherBook: Book = {
  id: "other",
  source: "file",
  title: "別の作品",
  author: "著者",
  chapters: [
    { id: "a", title: "一", content: [{ type: "text", text: "別の文。" }] },
  ],
};

it("reopens each book where it was left, also after reading another one", async () => {
  const { result } = await setup();
  await act(async () => {
    result.current.seekParagraph(1);
  });
  await act(async () => {
    result.current.openBook(otherBook);
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 0,
    paragraphIndex: 0,
  });
  await act(async () => {
    result.current.openBook(book);
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 1,
    paragraphIndex: 1,
  });
});

it("resumes a saved web novel at its episode and paragraph once the text is fetched", async () => {
  jest.mocked(loadPlayback).mockReturnValue({
    bookId: "other",
    chapterIndex: 0,
    paragraphIndex: 0,
    rate: 1,
    pitch: 1,
    positions: { [webNovel.id]: { chapterId: "2", paragraphIndex: 1 } },
  });
  const { result } = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  // 起動後の本棚にあるのは最後に読んだ話だけで、本文はない。
  const saved: Book = { ...webNovel, chapters: [webNovel.chapters[1]] };
  await act(async () => {
    result.current.openBook(saved);
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 0,
    paragraphIndex: 0,
  });
  await act(async () => {
    result.current.openBook({
      ...saved,
      chapters: [
        {
          ...saved.chapters[0],
          content: [{ type: "text", text: "一文目。\n二文目。\n三文目。" }],
        },
      ],
    });
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 0,
    paragraphIndex: 1,
    playing: false,
  });
  // 待っている間に、保存された段落を先頭で上書きしていてはならない。
  await act(async () => {
    result.current.toggle();
  });
  expect(Speech.speak).toHaveBeenLastCalledWith("二文目。", expect.any(Object));
});

it("opens a web novel at the episode asked for, and stays on it when the table of contents grows", async () => {
  const { result } = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  await act(async () => {
    result.current.openBook(webNovel);
  });
  expect(result.current.state.chapterIndex).toBe(0);
  // ブラウザから 3 話目で開いた: 作品を読みかけた位置ではなく、そこへ行く。
  await act(async () => {
    result.current.openBook({ ...webNovel }, { chapterId: "3" });
  });
  expect(result.current.state).toMatchObject({
    chapterIndex: 2,
    paragraphIndex: 0,
    playing: false,
  });
  // 前の話が先頭に足されるとインデックスはずれるが、読んでいる場所は動かない。
  await act(async () => {
    result.current.openBook({
      ...webNovel,
      chapters: [
        {
          id: "0",
          title: "序",
          url: "https://ncode.syosetu.com/x/",
          content: [],
        },
        ...webNovel.chapters,
      ],
    });
  });
  expect(result.current.state.chapterIndex).toBe(3);
  await act(async () => {
    result.current.toggle();
  });
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "三話の文。",
    expect.any(Object),
  );
});

it("marks the paragraphs of a heading so the reader can set them apart", () => {
  const { paragraphs, blocks } = parseChapter([
    {
      type: "element",
      tag: "h1",
      children: [{ type: "text", text: "第一話　旅立ち" }],
    },
    { type: "element", tag: "p", children: [{ type: "text", text: "本文。" }] },
  ]);
  expect(paragraphs.map((paragraph) => paragraph.speech)).toEqual([
    "第一話　旅立ち",
    "本文。",
  ]);
  expect(blocks).toEqual([
    { kind: "paragraph", index: 0, startsBlock: false, heading: true },
    { kind: "paragraph", index: 1, startsBlock: true },
  ]);
});

it("passes over a paragraph the built-in rules leave silent, and reads the next", async () => {
  const hook = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  await act(async () => {
    hook.result.current.openBook({
      ...book,
      chapters: [
        {
          id: "one",
          title: "第一章",
          content: [
            {
              type: "text",
              text: "一文目。\n◆◇◆\n詳細は https://example.com へ。",
            },
          ],
        },
      ],
    });
  });
  await act(async () => {
    hook.result.current.toggle();
  });
  expect(Speech.speak).toHaveBeenLastCalledWith("一文目。", expect.any(Object));
  await act(async () => {
    done();
  });
  // 区切り線は読まれない（エラーにもならない）。URL は短くなる。
  expect(hook.result.current.state.paragraphIndex).toBe(2);
  expect(hook.result.current.state.playing).toBe(true);
  expect(hook.result.current.error).toBeNull();
  expect(Speech.speak).toHaveBeenCalledTimes(2);
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "詳細は URL省略 へ。",
    expect.any(Object),
  );
});

it("passes over the paragraphs a rule matched over paragraphs leaves unread, in one move", async () => {
  jest.spyOn(DictionaryModule, "useDictionary").mockReturnValue({
    add: jest.fn(),
    remove: jest.fn(),
    create: jest.fn(() => ""),
    rename: jest.fn(),
    destroy: jest.fn(),
    assign: jest.fn(),
    setEnabled: jest.fn(),
    setSystemEnabled: jest.fn(),
    replace: jest.fn(),
    dictionary: {
      ...emptyDictionary,
      common: [
        {
          surface: "^<あとがき>$[\\s\\S]*",
          reading: "",
          regex: true,
          multiline: true,
        },
        {
          surface: "^<注>$[\\s\\S]*?^</注>$",
          reading: "",
          regex: true,
          multiline: true,
        },
      ],
    },
  });
  const hook = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  await act(async () => {
    hook.result.current.openBook({
      ...book,
      chapters: [
        {
          id: "one",
          title: "第一話",
          content: [
            {
              type: "text",
              text: "一文目。\n<あとがき>\nありがとう。\nまたね。",
            },
          ],
        },
        {
          id: "two",
          title: "第二話",
          content: [
            { type: "text", text: "次の話。\n<注>\n中。\n</注>\n最後。" },
          ],
        },
      ],
    });
  });
  await act(async () => {
    hook.result.current.toggle();
  });
  expect(Speech.speak).toHaveBeenLastCalledWith("一文目。", expect.any(Object));
  await act(async () => {
    done();
  });
  // 後書きは読まれない: すぐに次の話が続く。
  expect(hook.result.current.state).toMatchObject({
    chapterIndex: 1,
    paragraphIndex: 0,
    playing: true,
  });
  expect(Speech.speak).toHaveBeenCalledTimes(2);
  expect(Speech.speak).toHaveBeenLastCalledWith("次の話。", expect.any(Object));
  await act(async () => {
    done();
  });
  // こちらで省かれるのは注記だけ。
  expect(hook.result.current.state.paragraphIndex).toBe(4);
  expect(Speech.speak).toHaveBeenCalledTimes(3);
  expect(Speech.speak).toHaveBeenLastCalledWith("最後。", expect.any(Object));
  // 戻るときも、そこで跳ね返されずに飛び越える。
  await act(async () => {
    hook.result.current.step(-1);
  });
  expect(hook.result.current.state.paragraphIndex).toBe(0);
  expect(Speech.speak).toHaveBeenLastCalledWith("次の話。", expect.any(Object));
  await act(async () => {
    done();
  });
  await act(async () => {
    done();
  });
  // 最後の段落の後には、読むものが残っていない。
  expect(hook.result.current.state.playing).toBe(false);
  expect(hook.result.current.error).toBeNull();
});

it("reads the inside of a bracket in the voice given to it, and keeps the choice", async () => {
  jest.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([
    {
      identifier: "ja-voice",
      language: "ja-JP",
      name: "日本語音声",
      quality: Speech.VoiceQuality.Default,
    },
  ]);
  const hook = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  await act(async () => {
    hook.result.current.loadVoices();
  });
  await act(async () => {
    hook.result.current.openBook({
      ...book,
      chapters: [
        {
          id: "one",
          title: "第一章",
          content: [
            { type: "text", text: "彼は「こんにちは」と言った。\n次の段落。" },
          ],
        },
      ],
    });
  });
  await act(async () => {
    // 端末にない声は受け付けない。
    hook.result.current.setBracketVoice("kagi", {
      on: true,
      voice: "missing",
      pitch: 1,
    });
    hook.result.current.setBracketVoice("kagi", {
      on: true,
      voice: "ja-voice",
      pitch: 1.5,
    });
  });
  expect(hook.result.current.settings.brackets).toEqual({
    kagi: { on: true, voice: "ja-voice", pitch: 1.5 },
  });
  await act(async () => {
    hook.result.current.toggle();
  });
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "彼は",
    expect.objectContaining({ voice: undefined, pitch: 1, rate: 1 }),
  );
  await act(async () => {
    done();
  });
  // 同じ段落を、カッコの声で。速度は全体に共通のもの。
  expect(hook.result.current.state.paragraphIndex).toBe(0);
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "こんにちは",
    expect.objectContaining({ voice: "ja-voice", pitch: 1.5, rate: 1 }),
  );
  await act(async () => {
    done();
  });
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "と言った。",
    expect.objectContaining({ voice: undefined, pitch: 1 }),
  );
  await act(async () => {
    done();
  });
  expect(hook.result.current.state.paragraphIndex).toBe(1);
  // オフにすると、段落はカッコも含めてまた丸ごと読まれる。
  jest.useFakeTimers();
  await act(async () => {
    hook.result.current.seekParagraph(0, true);
    hook.result.current.setBracketVoice("kagi", {
      on: false,
      voice: "ja-voice",
      pitch: 1.5,
    });
  });
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "彼は「こんにちは」と言った。",
    expect.objectContaining({ voice: undefined, pitch: 1 }),
  );
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(savePlayback).toHaveBeenLastCalledWith(
    expect.objectContaining({
      brackets: { kagi: { on: false, voice: "ja-voice", pitch: 1.5 } },
    }),
  );
});

it("restores the voices of brackets, dropping what is malformed", async () => {
  jest.mocked(loadPlayback).mockReturnValue({
    bookId: null,
    chapterIndex: 0,
    paragraphIndex: 0,
    rate: 1,
    pitch: 1,
    brackets: {
      kagi: { on: true, voice: "ja-voice", pitch: 1.5 },
      paren: { on: true, pitch: 9 },
      unknown: { on: true, pitch: 1 },
    },
  });
  const { result } = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  expect(result.current.settings.brackets).toEqual({
    kagi: { on: true, voice: "ja-voice", pitch: 1.5 },
  });
});

it("keeps the screen on only while reading aloud, when the setting is on", async () => {
  jest.useFakeTimers();
  const hook = await setup();
  await act(async () => {
    hook.result.current.toggle();
  });
  // 既定ではオフ: 読み上げ中の画面は端末に任せる。
  expect(hook.result.current.settings.keepAwake).toBe(false);
  expect(activateKeepAwakeAsync).not.toHaveBeenCalled();

  // どちらのスイッチも読み上げ中のものをやり直さない: 声に関わる設定ではない。
  const spoken = jest.mocked(Speech.speak).mock.calls.length;
  const stopped = jest.mocked(Speech.stop).mock.calls.length;
  expect(spoken).toBeGreaterThan(0);
  await act(async () => {
    hook.result.current.setKeepAwake(true);
  });
  await act(async () => {
    hook.result.current.setPageSound(false);
  });
  expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
  expect(deactivateKeepAwake).not.toHaveBeenCalled();
  expect(Speech.speak).toHaveBeenCalledTimes(spoken);
  expect(Speech.stop).toHaveBeenCalledTimes(stopped);

  await act(async () => {
    hook.result.current.pause();
  });
  expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);

  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(jest.mocked(savePlayback).mock.calls.at(-1)![0]).toMatchObject({
    keepAwake: true,
  });
});

it("restores the setting that keeps the screen on, and does nothing until reading starts", async () => {
  jest.mocked(loadPlayback).mockReturnValue({
    bookId: null,
    chapterIndex: 0,
    paragraphIndex: 0,
    rate: 1,
    pitch: 1,
    keepAwake: true,
  });
  const hook = await setup();
  expect(hook.result.current.settings.keepAwake).toBe(true);
  expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
  await act(async () => {
    hook.result.current.toggle();
  });
  expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
});

it("sounds a page turn on reading on into another chapter, and on no other move", async () => {
  // SAFETY: __mocks__ のモックは、配っているただ 1 つのプレーヤーを公開している。
  const { player } = Audio as unknown as {
    player: {
      play: jest.Mock;
      emit: (status: { playing: boolean; didJustFinish: boolean }) => void;
    };
  };
  player.play.mockClear();
  // 本を開くのはページめくりではない。
  const hook = await renderHook(() => usePlayback(), {
    wrapper: PlaybackProvider,
  });
  await act(async () => {
    hook.result.current.openBook(book);
  });
  expect(player.play).not.toHaveBeenCalled();
  // 後ろの章へ飛ぶのも違う。本を読みかけの位置に戻すときや、目次から
  // 飛ぶときなど。
  await act(async () => {
    hook.result.current.seekChapter(1);
  });
  expect(player.play).not.toHaveBeenCalled();
  // 読者が自分で次の章へ進むのも、戻るのも違う。
  await act(async () => {
    hook.result.current.step(1, "chapter");
  });
  expect(hook.result.current.state.chapterIndex).toBe(2);
  await act(async () => {
    hook.result.current.seekChapter(1);
  });
  expect(player.play).not.toHaveBeenCalled();
  jest.mocked(PageSound.pageTurnWait).mockRestore();
  jest.useFakeTimers();
  // 章の終わりを越えて読み進めるのは、ページめくり。
  await act(async () => {
    hook.result.current.toggle();
  });
  // これより前のめくりが残した待ちを過ぎるまで進める。
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  await act(async () => {
    done();
  });
  const spoken = jest.mocked(Speech.speak).mock.calls.length;
  await act(async () => {
    done();
  });
  expect(hook.result.current.state.chapterIndex).toBe(3);
  expect(player.play).toHaveBeenCalledTimes(1);
  // 声は音が終わるまで待ち、それから章を読む。
  expect(Speech.speak).toHaveBeenCalledTimes(spoken);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(700);
  });
  expect(Speech.speak).toHaveBeenCalledTimes(spoken + 1);
  expect(jest.mocked(Speech.speak).mock.calls.at(-1)![0]).toBe("最終文。");
  // バックグラウンドではアプリのタイマーが動かず（Android が止める）、
  // 読み上げはそこでも続く: タイマーが発火しなくても、プレーヤーが音の
  // 終わりを知らせた時点で声が始まる。
  await act(async () => {
    hook.result.current.seekChapter(1);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  await act(async () => {
    done();
  });
  const before = jest.mocked(Speech.speak).mock.calls.length;
  const shown = AppState.currentState;
  // SAFETY: テスト用プリセットの AppState はただのオブジェクト。下で元に戻す。
  (AppState as { currentState: unknown }).currentState = "background";
  await act(async () => {
    done();
  });
  expect(hook.result.current.state.chapterIndex).toBe(3);
  expect(player.play).toHaveBeenCalledTimes(2);
  expect(Speech.speak).toHaveBeenCalledTimes(before);
  await act(async () => {
    player.emit({ playing: true, didJustFinish: false });
  });
  expect(Speech.speak).toHaveBeenCalledTimes(before);
  await act(async () => {
    player.emit({ playing: false, didJustFinish: true });
  });
  expect(Speech.speak).toHaveBeenCalledTimes(before + 1);
  expect(jest.mocked(Speech.speak).mock.calls.at(-1)![0]).toBe("最終文。");
  (AppState as { currentState: unknown }).currentState = shown;
  player.play.mockClear();
  player.play();
  // オフにすると、読み進めても音は鳴らず、その選択は保存される。
  await act(async () => {
    hook.result.current.setPageSound(false);
  });
  await act(async () => {
    hook.result.current.seekChapter(1);
  });
  // これより前のめくりが残した待ちを過ぎるまで進める。
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  await act(async () => {
    done();
  });
  await act(async () => {
    done();
  });
  expect(hook.result.current.state.chapterIndex).toBe(3);
  expect(player.play).toHaveBeenCalledTimes(1);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(jest.mocked(savePlayback).mock.calls.at(-1)![0]).toMatchObject({
    pageSound: false,
  });
});
