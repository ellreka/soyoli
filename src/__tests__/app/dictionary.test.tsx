/// <reference types="node" />
import { book, routes, chapterText, savedDictionary } from "@/testing/app";

import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { Alert } from "react-native";
import * as Speech from "expo-speech";
import {
  loadDictionary,
  saveDictionary,
} from "@/features/dictionary/dictionaryStorage";

it("registers a reading from a long-pressed paragraph into the work's own dictionary, made on the spot", async () => {
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("chapter-content");
  await fireEvent(chapterText("最初の本文。"), "longPress", {
    nativeEvent: {},
  });
  await fireEvent.press(screen.getByRole("button", { name: "辞書登録" }));
  expect(screen).toHavePathname("/dictionary");
  const form = within(screen.getByTestId("dictionary-form"));
  expect(form.getByLabelText("入力")).toHaveProp(
    "defaultValue",
    "最初の本文。",
  );
  expect(
    form.getByRole("radio", { name: "登録先 この作品の辞書" }),
  ).toBeChecked();
  expect(form.getByText(`新しく作成：${book.title}`)).toBeOnTheScreen();
  expect(
    form.getByRole("radio", { name: "登録先 すべての作品" }),
  ).not.toBeChecked();
  await fireEvent.changeText(form.getByLabelText("入力"), "");
  expect(form.getByRole("button", { name: "登録" })).toBeDisabled();
  await fireEvent.changeText(form.getByLabelText("入力"), "本文");
  expect(form.getByRole("button", { name: "登録" })).toBeEnabled();
  await fireEvent.changeText(form.getByLabelText("読み"), "ほんもん");
  await fireEvent.press(form.getByRole("button", { name: "登録" }));
  expect(screen).toHavePathname("/reader");
  const saved = jest.mocked(saveDictionary).mock.calls.at(-1)![0] as {
    sets: { id: string; name: string; entries: unknown[] }[];
    assigned: Record<string, unknown>;
  };
  expect(saved.sets).toEqual([
    {
      id: expect.any(String),
      name: book.title,
      entries: [{ surface: "本文", reading: "ほんもん" }],
    },
  ]);
  expect(saved.assigned).toEqual({
    "sample-01": { setId: saved.sets[0].id, title: book.title },
  });
  await fireEvent.press(chapterText("最初の本文。"));
  await fireEvent.press(screen.getByRole("button", { name: "再生" }));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "最初のほんもん。",
    expect.any(Object),
  );
});

it("lists the readings that apply to a work from the reader's menu", async () => {
  jest.mocked(loadDictionary).mockReturnValue(savedDictionary);
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("chapter-content");
  await fireEvent.press(screen.getByRole("button", { name: "その他" }));
  await fireEvent.press(screen.getByRole("button", { name: "読み方辞書" }));
  expect(screen).toHavePathname("/work-dictionary");
  expect(screen.getByText("この作品の読み（1件）")).toBeOnTheScreen();
  expect(screen.getByText("すべての作品の読み（1件）")).toBeOnTheScreen();
  expect(screen.getByText("ほんもん")).toBeOnTheScreen();
  expect(screen.getByText("いち")).toBeOnTheScreen();
  await fireEvent(
    screen.getByRole("switch", { name: "本文を適用" }),
    "valueChange",
    false,
  );
  expect(screen.getByRole("switch", { name: "本文を適用" })).not.toBeChecked();
  await fireEvent.press(
    screen.getByRole("button", { name: "本文の読みを編集" }),
  );
  expect(screen).toHavePathname("/dictionary");
});

it("offers to add a reading for a work that has no dictionary yet", async () => {
  jest.mocked(loadDictionary).mockReturnValue({
    ...savedDictionary,
    assigned: {},
  });
  await renderRouter(routes, {
    initialUrl: "/work-dictionary?bookId=sample-01",
  });
  expect(await screen.findByText("この作品の読み（0件）")).toBeOnTheScreen();
  expect(screen.queryByText("ほんもん")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "読みを追加" }));
  expect(screen).toHavePathname("/dictionary");
});

it("chooses the dictionary a work uses from the reader's menu, sharing another work's", async () => {
  jest.mocked(loadDictionary).mockReturnValue({
    ...savedDictionary,
    assigned: { "narou-n1": "s1" },
  });
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("chapter-content");
  await fireEvent.press(screen.getByRole("button", { name: "その他" }));
  await fireEvent.press(screen.getByRole("button", { name: "読み方辞書" }));
  expect(screen).toHavePathname("/work-dictionary");
  await fireEvent.press(screen.getByRole("button", { name: "使う辞書" }));
  expect(screen).toHavePathname("/dictionary-select");
  expect(screen.getByRole("radio", { name: "使わない" })).toBeChecked();
  expect(screen.queryByRole("button", { name: "新しい辞書を作る" })).toBeNull();
  expect(screen.getByRole("button", { name: "決定" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("radio", { name: "サンプルの辞書" }));
  expect(screen.getByRole("radio", { name: "サンプルの辞書" })).toBeChecked();
  expect(saveDictionary).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "閉じる" }));
  expect(screen).toHavePathname("/work-dictionary");
  expect(saveDictionary).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "使う辞書" }));
  expect(screen.getByRole("radio", { name: "使わない" })).toBeChecked();
  await fireEvent.press(screen.getByRole("radio", { name: "サンプルの辞書" }));
  await fireEvent.press(screen.getByRole("button", { name: "決定" }));
  expect(screen).toHavePathname("/work-dictionary");
  expect(
    screen.getByRole("button", { name: "本文の読みを編集" }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "閉じる" }));
  expect(screen).toHavePathname("/reader");
  expect(saveDictionary).toHaveBeenLastCalledWith({
    ...savedDictionary,
    assigned: {
      "narou-n1": { setId: "s1" },
      "sample-01": { setId: "s1", title: book.title },
    },
  });
  await fireEvent.press(chapterText("最初の本文。"));
  await fireEvent.press(screen.getByRole("button", { name: "再生" }));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "最初のほんもん。",
    expect.any(Object),
  );
});

it("shows a dictionary's works and readings, renames and deletes it", async () => {
  const withAbsentWork = {
    ...savedDictionary,
    assigned: {
      ...savedDictionary.assigned,
      "narou-n0001aa": {
        setId: "s1",
        title: "本棚から外した作品",
        url: "https://novel18.syosetu.com/n0001aa/",
      },
    },
  };
  jest.mocked(loadDictionary).mockReturnValue(withAbsentWork);
  await renderRouter(routes, { initialUrl: "/settings/dictionary" });
  expect(
    within(await screen.findByTestId("dictionary-set-common")).getByText(
      "どの作品にも適用",
    ),
  ).toBeOnTheScreen();
  const row = screen.getByTestId("dictionary-set-サンプルの辞書");
  expect(within(row).getByText("2作品で使用")).toBeOnTheScreen();
  await fireEvent.press(row);
  expect(screen).toHavePathname("/settings/dictionary-set");
  expect(
    screen.getByRole("header", { name: "サンプルの辞書" }),
  ).toBeOnTheScreen();
  expect(await screen.findByText(book.title)).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "本文の読みを編集" }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: /辞書を解除/ })).toBeNull();
  expect(screen.getByText("本棚から外した作品")).toBeOnTheScreen();
  expect(
    screen.getByText("本棚にない作品 · novel18.syosetu.com/n0001aa"),
  ).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText("辞書の名前"), "新しい名前");
  expect(screen.getByRole("header", { name: "新しい名前" })).toBeOnTheScreen();
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const saves = jest.mocked(saveDictionary).mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: "この辞書を削除" }));
  expect(alert).toHaveBeenLastCalledWith(
    "この辞書を削除しますか？",
    expect.stringContaining("読み1件"),
    expect.any(Array),
  );
  const buttons = alert.mock.calls.at(-1)![2]!;
  expect(buttons.map((button) => button.text)).toEqual(["キャンセル", "削除"]);
  await act(async () => {
    buttons[0].onPress?.();
  });
  expect(screen).toHavePathname("/settings/dictionary-set");
  expect(saveDictionary).toHaveBeenCalledTimes(saves);
  await act(async () => {
    buttons[1].onPress?.();
  });
  expect(screen).toHavePathname("/settings/dictionary");
  expect(saveDictionary).toHaveBeenLastCalledWith({
    common: savedDictionary.common,
    sets: [savedDictionary.sets[1]],
    assigned: {},
  });
});

it("edits a reading from its dictionary's page and moves it to the one for every work", async () => {
  jest.mocked(loadDictionary).mockReturnValue(savedDictionary);
  await renderRouter(routes, {
    initialUrl: "/settings/dictionary-set?id=s1",
  });
  await fireEvent.press(
    await screen.findByRole("button", { name: "本文の読みを編集" }),
  );
  expect(screen).toHavePathname("/dictionary");
  expect(screen.getByRole("header", { name: "読みを編集" })).toBeOnTheScreen();
  const form = within(screen.getByTestId("dictionary-form"));
  expect(form.getByLabelText("入力")).toHaveProp("defaultValue", "本文");
  expect(form.getByLabelText("読み")).toHaveProp("defaultValue", "ほんもん");
  expect(
    form.getByRole("radio", { name: "登録先 サンプルの辞書" }),
  ).toBeChecked();
  expect(form.queryByRole("radio", { name: "登録先 別の辞書" })).toBeNull();
  await fireEvent.changeText(form.getByLabelText("読み"), "ぶん");
  await fireEvent.press(
    form.getByRole("radio", { name: "登録先 すべての作品" }),
  );
  await fireEvent.press(form.getByRole("button", { name: "保存" }));
  expect(saveDictionary).toHaveBeenLastCalledWith({
    ...savedDictionary,
    common: [{ surface: "本文", reading: "ぶん" }, ...savedDictionary.common],
    sets: [
      { ...savedDictionary.sets[0], entries: [] },
      savedDictionary.sets[1],
    ],
  });
  expect(screen).toHavePathname("/settings/dictionary-set");
  await fireEvent.press(screen.getByRole("button", { name: "読みを追加" }));
  const added = within(screen.getByTestId("dictionary-form"));
  await fireEvent.changeText(added.getByLabelText("入力"), "二");
  await fireEvent.changeText(added.getByLabelText("読み"), "に");
  await fireEvent.changeText(added.getByLabelText("説明"), "数字の二");
  await fireEvent.press(added.getByRole("button", { name: "登録" }));
  expect(saveDictionary).toHaveBeenLastCalledWith(
    expect.objectContaining({
      sets: [
        {
          ...savedDictionary.sets[0],
          entries: [{ surface: "二", reading: "に", description: "数字の二" }],
        },
        savedDictionary.sets[1],
      ],
    }),
  );
  expect(screen.getByText("二")).toBeOnTheScreen();
  expect(screen.getByText("に")).toBeOnTheScreen();
  expect(screen.getAllByText("→")).toHaveLength(1);
  expect(screen.getByText("数字の二")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "二の読みを編集" }));
  expect(
    within(screen.getByTestId("dictionary-form")).getByLabelText("説明"),
  ).toHaveProp("defaultValue", "数字の二");
  await fireEvent.press(screen.getByRole("button", { name: "この読みを削除" }));
  expect(screen.queryByRole("button", { name: "二の読みを編集" })).toBeNull();
});

it("registers a regex reading, refusing a pattern that does not compile", async () => {
  jest.mocked(loadDictionary).mockReturnValue(savedDictionary);
  await renderRouter(routes, {
    initialUrl: "/settings/dictionary-set?id=s1",
  });
  await fireEvent.press(
    await screen.findByRole("button", { name: "読みを追加" }),
  );
  const form = within(screen.getByTestId("dictionary-form"));
  expect(form.getByRole("radio", { name: "入力の種類 文字列" })).toBeChecked();
  await fireEvent.press(
    form.getByRole("radio", { name: "入力の種類 正規表現" }),
  );
  await fireEvent.changeText(form.getByLabelText("入力"), "第(\\d+");
  await fireEvent.changeText(form.getByLabelText("読み"), "だい$1わ");
  expect(form.getByRole("alert")).toHaveTextContent(
    /正しい正規表現ではありません/,
  );
  expect(form.getByRole("button", { name: "登録" })).toBeDisabled();
  await fireEvent.changeText(form.getByLabelText("入力"), "第(\\d+)話");
  expect(form.queryByRole("alert")).toBeNull();
  await fireEvent.press(form.getByRole("button", { name: "登録" }));
  expect(saveDictionary).toHaveBeenLastCalledWith({
    ...savedDictionary,
    sets: [
      {
        ...savedDictionary.sets[0],
        entries: [
          { surface: "第(\\d+)話", reading: "だい$1わ", regex: true },
          ...savedDictionary.sets[0].entries,
        ],
      },
      savedDictionary.sets[1],
    ],
  });
  expect(screen.getByText("第(\\d+)話")).toBeOnTheScreen();
  expect(screen.getByText("だい$1わ")).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "第(\\d+)話の読みを編集" }),
  );
  expect(
    within(screen.getByTestId("dictionary-form")).getByRole("radio", {
      name: "入力の種類 正規表現",
    }),
  ).toBeChecked();
});

it("shows the built-in dictionary as any other, its readings switched off but not edited", async () => {
  jest.mocked(loadDictionary).mockReturnValue(savedDictionary);
  await renderRouter(routes, { initialUrl: "/settings/dictionary" });
  await fireEvent.press(await screen.findByTestId("dictionary-set-system"));
  expect(screen).toHavePathname("/settings/dictionary-set");
  expect(
    screen.getByRole("header", { name: "システム辞書" }),
  ).toBeOnTheScreen();
  expect(screen.getByText("https?://[!-~]+")).toBeOnTheScreen();
  expect(screen.getAllByText("URL省略")).toHaveLength(2);
  expect(screen.getByText("URL")).toBeOnTheScreen();
  expect(screen.getByText("読まない")).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: /読みを編集/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "読みを追加" })).toBeNull();
  expect(screen.queryByRole("button", { name: "この辞書を削除" })).toBeNull();
  const url = { name: "URLを適用" };
  expect(screen.getByRole("switch", url)).toBeChecked();
  await fireEvent(screen.getByRole("switch", url), "valueChange", false);
  expect(screen.getByRole("switch", url)).not.toBeChecked();
  expect(saveDictionary).toHaveBeenLastCalledWith({
    ...savedDictionary,
    systemOff: ["url"],
  });
  await fireEvent(screen.getByRole("switch", url), "valueChange", true);
  expect(saveDictionary).toHaveBeenLastCalledWith(savedDictionary);
});

it("switches a registered reading off on its dictionary's page, and an edit keeps it off", async () => {
  jest.mocked(loadDictionary).mockReturnValue(savedDictionary);
  await renderRouter(routes, {
    initialUrl: "/settings/dictionary-set?id=s1",
  });
  const toggle = { name: "本文を適用" };
  expect(await screen.findByRole("switch", toggle)).toBeChecked();
  await fireEvent(screen.getByRole("switch", toggle), "valueChange", false);
  expect(screen.getByRole("switch", toggle)).not.toBeChecked();
  const off = { surface: "本文", reading: "ほんもん", off: true };
  expect(saveDictionary).toHaveBeenLastCalledWith({
    ...savedDictionary,
    sets: [
      { ...savedDictionary.sets[0], entries: [off] },
      savedDictionary.sets[1],
    ],
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "本文の読みを編集" }),
  );
  const form = within(screen.getByTestId("dictionary-form"));
  expect(form.getAllByRole("switch")).toHaveLength(1);
  expect(
    form.getByRole("switch", { name: "段落をまたいで一致" }),
  ).not.toBeChecked();
  await fireEvent.changeText(form.getByLabelText("読み"), "ぶん");
  await fireEvent.press(form.getByRole("button", { name: "保存" }));
  expect(saveDictionary).toHaveBeenLastCalledWith({
    ...savedDictionary,
    sets: [
      { ...savedDictionary.sets[0], entries: [{ ...off, reading: "ぶん" }] },
      savedDictionary.sets[1],
    ],
  });
  expect(screen.getByRole("switch", toggle)).not.toBeChecked();
});
