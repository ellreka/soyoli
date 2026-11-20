/// <reference types="node" />
import { book, routes, savedDictionary } from "@/testing/app";

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { renderRouter, testRouter } from "expo-router/testing-library";
import { BackHandler } from "react-native";
import * as Speech from "expo-speech";
import { loadLibrary } from "@/features/library/libraryStorage";
import { loadDictionary } from "@/features/dictionary/dictionaryStorage";
import { loadPlayback } from "@/features/player/storage";
import { openSavedFile, savedFileBooks } from "@/features/books/import";

const mockMoveToBack = jest.fn(() => Promise.resolve(true));
jest.mock("../../../modules/app-task/src/AppTaskModule", () => ({
  __esModule: true,
  default: { moveToBack: () => mockMoveToBack() },
}));

type BackHandlers = Parameters<typeof BackHandler.addEventListener>[1][];

it("opens on the bookshelf, switches tabs, and returns through tab history", async () => {
  await renderRouter(routes);
  expect(screen).toHavePathname("/");
  expect(screen.getByRole("header", { name: "本棚" })).toBeOnTheScreen();
  expect(
    await screen.findByRole("link", { name: "サンプル作品を開く" }),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText("本棚")).toBeSelected();
  await fireEvent.press(screen.getByLabelText("ホーム"));
  await waitFor(() => {
    expect(screen).toHavePathname("/home");
  });
  expect(screen.getByRole("header", { name: "ホーム" })).toBeOnTheScreen();
  expect(screen.getByLabelText("ホーム")).toBeSelected();
  expect(screen.getByLabelText("本棚")).not.toBeSelected();
  expect(screen.queryByRole("link", { name: "サンプル作品を開く" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "カクヨムを開く" }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "ファイルを取り込む" }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText("設定"));
  expect(screen).toHavePathname("/settings");
  expect(screen.getByRole("header", { name: "設定" })).toBeOnTheScreen();
  expect(screen.getByLabelText("設定")).toBeSelected();
  expect(
    screen.getByRole("button", { name: "カッコ別の音声" }),
  ).toBeOnTheScreen();
  await testRouter.back();
  expect(screen).toHavePathname("/home");
  await fireEvent.press(screen.getByLabelText("本棚"));
  expect(screen).toHavePathname("/");
});

it.each(["/home", "/settings"])(
  "opens %s directly with the bottom menu",
  async (initialUrl) => {
    await renderRouter(routes, { initialUrl });
    expect(screen).toHavePathname(initialUrl);
    expect(screen.getByLabelText("ホーム")).toBeOnTheScreen();
    expect(screen.getByLabelText("本棚")).toBeOnTheScreen();
    expect(screen.getByLabelText("設定")).toBeOnTheScreen();
  },
);

it("handles unknown book links without crashing", async () => {
  await renderRouter(routes, { initialUrl: "/reader?id=missing" });
  expect(await screen.findByText("作品が見つかりません。")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "閉じる" }));
  expect(screen).toHavePathname("/");
});

it("goes back to the first page of a tab when the tab is pressed again", async () => {
  await renderRouter(routes);
  await fireEvent.press(await screen.findByLabelText("ホーム"));
  await fireEvent.press(screen.getByRole("button", { name: "カクヨムを開く" }));
  expect(screen).toHavePathname("/home/browse");
  await fireEvent.press(screen.getByLabelText("ホーム"));
  await waitFor(() => {
    expect(screen).toHavePathname("/home");
  });
  expect(screen.getByRole("header", { name: "ホーム" })).toBeOnTheScreen();

  await fireEvent.press(screen.getByLabelText("設定"));
  await fireEvent.press(screen.getByRole("button", { name: "音声設定" }));
  expect(screen).toHavePathname("/settings/speed");
  await fireEvent.press(screen.getByLabelText("設定"));
  await waitFor(() => {
    expect(screen).toHavePathname("/settings");
  });
});

it("keeps the mini player in the browser and returns to the viewer from it", async () => {
  await renderRouter(routes);
  await fireEvent.press(
    await screen.findByRole("link", { name: "サンプル作品を開く" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  await fireEvent.press(screen.getByLabelText("ホーム"));
  await fireEvent.press(screen.getByRole("button", { name: "カクヨムを開く" }));
  expect(screen).toHavePathname("/home/browse");
  expect(screen.getByLabelText("本棚")).toBeOnTheScreen();
  const mini = within(screen.getByTestId("mini-player"));
  expect(mini.getByText("サンプル作品")).toBeOnTheScreen();
  await fireEvent.press(mini.getByRole("button", { name: "再生" }));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "最初の本文。",
    expect.any(Object),
  );
  await fireEvent.press(mini.getByRole("link", { name: "ビューアーを開く" }));
  expect(screen).toHavePathname("/reader");
  expect(screen.getByRole("button", { name: "一時停止" })).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  expect(screen).toHavePathname("/home/browse");
});

it("puts the last opened book back into the mini player at launch", async () => {
  jest.mocked(loadPlayback).mockReturnValue({
    bookId: "sample-01",
    chapterIndex: 1,
    paragraphIndex: 0,
    rate: 1,
    pitch: 1,
  });
  await renderRouter(routes);
  expect(
    await within(await screen.findByTestId("mini-player")).findByText("おわり"),
  ).toBeOnTheScreen();
  expect(Speech.speak).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "再生" })).toBeOnTheScreen();
});

it("puts a book kept on the device back into the mini player at launch, reading its file once", async () => {
  const kept = { ...book, file: "kept.epub" };
  jest.mocked(savedFileBooks).mockReturnValue([{ ...kept, chapters: [] }]);
  jest.mocked(openSavedFile).mockResolvedValue(kept);
  jest.mocked(loadPlayback).mockReturnValue({
    bookId: "sample-01",
    chapterIndex: 1,
    paragraphIndex: 0,
    rate: 1,
    pitch: 1,
  });
  await renderRouter(routes);
  expect(
    await within(await screen.findByTestId("mini-player")).findByText("おわり"),
  ).toBeOnTheScreen();
  expect(openSavedFile).toHaveBeenCalledTimes(1);
  expect(Speech.speak).not.toHaveBeenCalled();
});

it("has nothing to continue at launch when the last book's file cannot be read", async () => {
  jest
    .mocked(savedFileBooks)
    .mockReturnValue([{ ...book, file: "kept.epub", chapters: [] }]);
  jest.mocked(openSavedFile).mockRejectedValue(new Error("gone"));
  jest.mocked(loadPlayback).mockReturnValue({
    bookId: "sample-01",
    chapterIndex: 1,
    paragraphIndex: 0,
    rate: 1,
    pitch: 1,
  });
  await renderRouter(routes);
  await waitFor(() => {
    expect(openSavedFile).toHaveBeenCalledTimes(1);
  });
  await waitFor(() => {
    expect(screen.queryByTestId("mini-player")).toBeNull();
  });
});

it("keeps one browser: opening a page while it is open takes it there", async () => {
  jest.mocked(loadLibrary).mockReturnValue([
    {
      id: "narou-n1234ab",
      source: "narou",
      title: "Web作品",
      author: "作者名",
      episode: {
        id: "2",
        title: "第二話",
        url: "https://ncode.syosetu.com/n1234ab/2/",
      },
    },
  ]);
  await renderRouter(routes, { initialUrl: "/home" });
  await fireEvent.press(
    await screen.findByRole("button", { name: "カクヨムを開く" }),
  );
  expect(screen).toHavePathname("/home/browse");
  expect(screen.getAllByTestId("webview")).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText("本棚"));
  await fireEvent(
    screen.getByRole("link", { name: "Web作品を開く" }),
    "longPress",
  );
  await fireEvent.press(screen.getByTestId("action-site"));
  expect(screen).toHavePathname("/home/browse");
  expect(screen.getAllByTestId("webview")).toHaveLength(1);
  expect(
    screen.getByLabelText(
      "表示中のページ https://ncode.syosetu.com/n1234ab/2/",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "ブラウザを閉じる" }),
  );
  expect(screen).toHavePathname("/home");
  expect(screen.queryByTestId("webview")).toBeNull();
});

it("puts Home under the browser when it is opened before Home was", async () => {
  jest.mocked(loadLibrary).mockReturnValue([
    {
      id: "narou-n1234ab",
      source: "narou",
      title: "Web作品",
      author: "作者名",
      episode: {
        id: "2",
        title: "第二話",
        url: "https://ncode.syosetu.com/n1234ab/2/",
      },
    },
  ]);
  await renderRouter(routes);
  await fireEvent(
    await screen.findByRole("link", { name: "Web作品を開く" }),
    "longPress",
  );
  await fireEvent.press(screen.getByTestId("action-site"));
  expect(screen).toHavePathname("/home/browse");
  await fireEvent.press(
    screen.getByRole("button", { name: "ブラウザを閉じる" }),
  );
  expect(screen).toHavePathname("/home");
  expect(screen.queryByTestId("webview")).toBeNull();
  await fireEvent.press(screen.getByLabelText("本棚"));
  await fireEvent(
    screen.getByRole("link", { name: "Web作品を開く" }),
    "longPress",
  );
  await fireEvent.press(screen.getByTestId("action-site"));
  expect(screen).toHavePathname("/home/browse");
  await fireEvent.press(screen.getByLabelText("ホーム"));
  await waitFor(() => {
    expect(screen).toHavePathname("/home");
  });
  expect(screen.queryByTestId("webview")).toBeNull();
});

it("nests the settings: a list of items, each opening its own page", async () => {
  jest.mocked(loadDictionary).mockReturnValue(savedDictionary);
  await renderRouter(routes, { initialUrl: "/settings" });
  expect(
    await screen.findByRole("button", { name: "カッコ別の音声" }),
  ).toHaveAccessibilityValue({ text: "オフ" });
  expect(
    screen.getByRole("button", { name: "読み方辞書" }),
  ).toHaveAccessibilityValue({ text: "2件" });
  expect(screen.queryByTestId("dictionary-set-common")).toBeNull();
  expect(
    screen.getByRole("button", { name: "音声設定" }),
  ).toHaveAccessibilityValue({ text: "端末標準 · 1x" });
  expect(
    screen.getByText("読み上げている間、画面を自動で消しません"),
  ).toBeOnTheScreen();
  for (const label of ["読み上げ", "辞書", "その他"]) {
    expect(screen.getByText(label)).toBeOnTheScreen();
  }

  await fireEvent.press(screen.getByRole("button", { name: "読み方辞書" }));
  expect(screen).toHavePathname("/settings/dictionary");
  expect(screen.getByTestId("dictionary-set-common")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "戻る" }));
  expect(screen).toHavePathname("/settings");

  await fireEvent.press(screen.getByRole("button", { name: "カッコ別の音声" }));
  expect(screen).toHavePathname("/settings/brackets");
  await fireEvent.press(screen.getByRole("button", { name: "戻る" }));
  await fireEvent.press(screen.getByRole("button", { name: "音声設定" }));
  expect(screen).toHavePathname("/settings/speed");
  await fireEvent.press(screen.getByRole("radio", { name: "1.5×" }));
  expect(
    screen.getByRole("adjustable", { name: "声の高さ" }),
  ).toBeOnTheScreen();
  expect(screen.getByText("基本音声")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "戻る" }));
  expect(
    screen.getByRole("button", { name: "音声設定" }),
  ).toHaveAccessibilityValue({ text: "端末標準 · 1.5x" });
  await fireEvent.press(screen.getByRole("button", { name: "カッコ別の音声" }));
  await fireEvent.press(screen.getByRole("button", { name: "戻る" }));
  const sound = screen.getByTestId("settings-page-sound-switch");
  expect(sound).toBeChecked();
  await fireEvent.press(
    screen.getByRole("button", { name: "ページをめくる音" }),
  );
  expect(screen.getByTestId("settings-page-sound-switch")).not.toBeChecked();
  expect(screen.getByTestId("settings-auto-next-switch")).toBeChecked();
  await fireEvent.press(screen.getByRole("button", { name: "連続再生" }));
  expect(screen.getByTestId("settings-auto-next-switch")).not.toBeChecked();
  expect(screen.getByTestId("settings-author-notes-switch")).not.toBeChecked();
  await fireEvent.press(
    screen.getByRole("button", { name: "前書き・後書きを読む" }),
  );
  expect(screen.getByTestId("settings-author-notes-switch")).toBeChecked();
  const awake = screen.getByTestId("settings-keep-awake-switch");
  expect(awake).not.toBeChecked();
  await fireEvent(awake, "valueChange", true);
  expect(screen.getByTestId("settings-keep-awake-switch")).toBeChecked();
  await fireEvent.press(screen.getByRole("button", { name: "カッコ別の音声" }));
  expect(screen.getByLabelText("設定")).toBeSelected();
});

it.each([
  ["after", (handlers: BackHandlers) => handlers.toReversed()],
  ["before", (handlers: BackHandlers) => handlers],
])(
  "sends the app to the background on Back only where there is nothing to go back to, when navigation listens %s it",
  async (_order, inOrder) => {
    const handlers: BackHandlers = [];
    const listen = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        handlers.push(handler);
        return {
          remove: () => {
            handlers.splice(handlers.indexOf(handler), 1);
          },
        };
      });
    const pressBack = () =>
      act(async () => {
        // SAFETY: 受ける側はイベントの中身を見ない。
        inOrder(handlers).some((handler) => handler({} as never));
      });
    await renderRouter(routes);
    await screen.findByRole("header", { name: "本棚" });
    await fireEvent.press(screen.getByLabelText("設定"));
    await fireEvent.press(
      await screen.findByRole("button", { name: "音声設定" }),
    );
    expect(screen).toHavePathname("/settings/speed");
    await pressBack();
    expect(screen).toHavePathname("/settings");
    await pressBack();
    expect(screen).toHavePathname("/");
    expect(mockMoveToBack).not.toHaveBeenCalled();
    await pressBack();
    expect(mockMoveToBack).toHaveBeenCalledTimes(1);
    expect(screen).toHavePathname("/");
    mockMoveToBack.mockClear();
    listen.mockRestore();
  },
);
