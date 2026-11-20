/// <reference types="node" />
import { routes, savedDictionary } from "@/testing/app";

import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { Alert } from "react-native";
import { pickBackup, saveBackup } from "@/features/backup/backupFile";
import {
  loadDictionary,
  saveDictionary,
} from "@/features/dictionary/dictionaryStorage";
import { loadLibrary, saveLibrary } from "@/features/library/libraryStorage";
import { loadPlayback, savePlayback } from "@/features/player/storage";

const work = {
  id: "narou-n1234ab",
  source: "narou",
  title: "Web作品",
  author: "作者名",
  episode: {
    id: "2",
    title: "第二話　出会い",
    url: "https://ncode.syosetu.com/n1234ab/2/",
  },
  readAt: 2000,
};
const backupFile = {
  app: "soyoli",
  version: 1,
  exportedAt: "2026-11-14T00:00:00.000Z",
  dictionary: savedDictionary,
  voice: {
    rate: 1.5,
    pitch: 1,
    voice: "ja-voice",
    brackets: { kagi: { on: true, pitch: 1.2, voice: "missing-voice" } },
    keepAwake: true,
    pageSound: false,
  },
  works: [work],
  positions: { [work.id]: { chapterId: "2", paragraphIndex: 4 } },
};

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it("writes a backup of the dictionary, the voice settings and the saved web novels", async () => {
  jest.mocked(loadDictionary).mockReturnValue(savedDictionary);
  jest.mocked(loadLibrary).mockReturnValue([work]);
  jest.mocked(loadPlayback).mockReturnValue({
    bookId: null,
    chapterIndex: 0,
    paragraphIndex: 0,
    positions: {
      [work.id]: { chapterId: "2", paragraphIndex: 4 },
      "sample-01": { chapterId: "first", paragraphIndex: 1 },
    },
    rate: 1.5,
    pitch: 1,
  });
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.mocked(saveBackup).mockResolvedValue({
    canceled: false,
    name: "soyoli-backup-20261114.json",
  });
  await renderRouter(routes, { initialUrl: "/settings" });
  await fireEvent.press(
    await screen.findByRole("button", { name: "バックアップを書き出す" }),
  );
  await waitFor(() => {
    expect(alert).toHaveBeenLastCalledWith(
      "バックアップを保存しました",
      "soyoli-backup-20261114.json",
    );
  });
  const [name, file] = jest.mocked(saveBackup).mock.calls[0];
  expect(name).toMatch(/^soyoli-backup-\d{8}\.json$/);
  expect(file).toEqual({
    app: "soyoli",
    version: 1,
    exportedAt: expect.any(String),
    dictionary: savedDictionary,
    voice: {
      rate: 1.5,
      pitch: 1,
      voice: undefined,
      brackets: {},
      keepAwake: false,
      pageSound: true,
      autoNext: true,
      authorNotes: false,
    },
    works: [work],
    positions: { [work.id]: { chapterId: "2", paragraphIndex: 4 } },
  });
});

it("says so when the backup could not be saved, and nothing when no folder is chosen", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest
    .mocked(saveBackup)
    .mockResolvedValueOnce({ canceled: true })
    .mockRejectedValueOnce(new Error("file could not be created"));
  await renderRouter(routes, { initialUrl: "/settings" });
  const row = await screen.findByRole("button", {
    name: "バックアップを書き出す",
  });
  await fireEvent.press(row);
  await waitFor(() => {
    expect(saveBackup).toHaveBeenCalledTimes(1);
  });
  expect(alert).not.toHaveBeenCalled();
  await fireEvent.press(row);
  await waitFor(() => {
    expect(alert).toHaveBeenLastCalledWith(
      "書き出せませんでした",
      expect.stringContaining("保存できませんでした"),
    );
  });
});

it("takes in a backup after asking: replaces the dictionary and voice, adds the web novels", async () => {
  jest.useFakeTimers();
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest
    .mocked(pickBackup)
    .mockResolvedValue({ canceled: false, value: backupFile });
  await renderRouter(routes, { initialUrl: "/settings" });
  expect(
    await screen.findByRole("button", { name: "読み方辞書" }),
  ).toHaveAccessibilityValue({ text: "0件" });
  await fireEvent.press(
    screen.getByRole("button", { name: "バックアップから取り込む" }),
  );
  await waitFor(() => {
    expect(alert).toHaveBeenCalledTimes(1);
  });
  expect(alert).toHaveBeenLastCalledWith(
    "バックアップを取り込みますか？",
    "読み方辞書（読み2件）と音声設定は、バックアップの内容に置き換わります。\n" +
      "本棚と履歴には、バックアップのWeb小説1件が加わります。今ある作品は残ります。",
    expect.any(Array),
  );
  const buttons = alert.mock.calls.at(-1)![2]!;
  expect(buttons.map((button) => button.text)).toEqual([
    "キャンセル",
    "取り込む",
  ]);
  await act(async () => {
    buttons[0].onPress?.();
  });
  expect(saveDictionary).not.toHaveBeenCalled();
  await act(async () => {
    buttons[1].onPress?.();
  });
  expect(
    screen.getByRole("button", { name: "読み方辞書" }),
  ).toHaveAccessibilityValue({ text: "2件" });
  expect(
    screen.getByRole("button", { name: "音声設定" }),
  ).toHaveAccessibilityValue({ text: "日本語音声 · 1.5x" });
  expect(screen.getByTestId("settings-keep-awake-switch")).toBeChecked();
  expect(screen.getByTestId("settings-page-sound-switch")).not.toBeChecked();
  expect(saveDictionary).toHaveBeenLastCalledWith(savedDictionary);
  expect(saveLibrary).toHaveBeenLastCalledWith([work]);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(savePlayback).toHaveBeenLastCalledWith(
    expect.objectContaining({
      rate: 1.5,
      voice: "ja-voice",
      brackets: { kagi: { on: true, pitch: 1.2 } },
      keepAwake: true,
      pageSound: false,
      positions: { [work.id]: { chapterId: "2", paragraphIndex: 4 } },
    }),
  );
});

it("refuses a file that is not a backup, and one that cannot be read", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest
    .mocked(pickBackup)
    .mockResolvedValueOnce({ canceled: false, value: { common: [] } })
    .mockRejectedValueOnce(new SyntaxError("Unexpected token"));
  await renderRouter(routes, { initialUrl: "/settings" });
  const row = await screen.findByRole("button", {
    name: "バックアップから取り込む",
  });
  await fireEvent.press(row);
  await waitFor(() => {
    expect(alert).toHaveBeenLastCalledWith(
      "取り込めませんでした",
      expect.stringContaining("バックアップファイルではない"),
    );
  });
  await fireEvent.press(row);
  await waitFor(() => {
    expect(alert).toHaveBeenLastCalledWith(
      "取り込めませんでした",
      expect.stringContaining("ファイルを読めませんでした"),
    );
  });
  expect(saveDictionary).not.toHaveBeenCalled();
});

it("does nothing when no file is chosen", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await renderRouter(routes, { initialUrl: "/settings" });
  await fireEvent.press(
    await screen.findByRole("button", { name: "バックアップから取り込む" }),
  );
  await waitFor(() => {
    expect(pickBackup).toHaveBeenCalledTimes(1);
  });
  expect(alert).not.toHaveBeenCalled();
});
