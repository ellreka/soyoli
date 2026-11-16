/// <reference types="node" />
import {
  book,
  routes,
  dismissSheet,
  chapterText,
  seek,
  seed,
} from "@/testing/app";

import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import { BottomSheet } from "@expo/ui";
import { colors } from "@/constants/theme";
import { themes } from "@/features/reader/Display";
import { loadDisplay, saveDisplay } from "@/features/reader/displayStorage";

it("has one book entry point and always displays the player alongside the chapter", async () => {
  await renderRouter(routes);
  await fireEvent.press(
    await screen.findByRole("link", { name: "サンプル作品を開く" }),
  );
  expect(screen).toHavePathname("/reader");
  expect(screen.getByRole("header", { name: "はじまり" })).toBeOnTheScreen();
  await screen.findByTestId("chapter-content");
  expect(chapterText("最初の本文。")).toBeOnTheScreen();
  expect(screen.getByTestId("viewer-player")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "再生" })).toBeOnTheScreen();
  expect(Speech.speak).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: /を読む|を聴く/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "この章から聴く" })).toBeNull();
  expect(screen.getByRole("button", { name: "前の話" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "次の話" }));
  expect(screen.getByRole("header", { name: "おわり" })).toBeOnTheScreen();
  expect(chapterText("次の本文。")).toBeOnTheScreen();
  expect(screen.getByTestId("current-paragraph")).toHaveTextContent(
    "次の本文。",
  );
  expect(screen.getByRole("button", { name: "次の話" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "前の話" }));
  expect(screen.getByRole("header", { name: "はじまり" })).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  expect(screen).toHavePathname("/");
});

it("uses the same integrated viewer for normalized Web content", async () => {
  seed({ ...book, id: "web-novel", title: "Web小説" });
  await renderRouter(routes, { initialUrl: "/reader?id=web-novel" });
  expect(await screen.findByText("Web小説")).toBeOnTheScreen();
  expect(screen.getByTestId("viewer-player")).toBeOnTheScreen();
  await screen.findByTestId("chapter-content");
  expect(chapterText("最初の本文。")).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  expect(screen).toHavePathname("/");
});

it("changes playback settings inside the viewer and returns there from the mini player", async () => {
  await renderRouter(routes);
  await fireEvent.press(
    await screen.findByRole("link", { name: "サンプル作品を開く" }),
  );
  await screen.findByTestId("chapter-content");
  await fireEvent.press(screen.getByRole("button", { name: "再生" }));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "最初の本文。",
    expect.any(Object),
  );
  // 第 0 章は 180pt に 13 文字: x=90 は 7 文字目で、2 つ目の段落の中。
  await seek(90);
  expect(screen.getByTestId("current-paragraph")).toHaveTextContent(
    "もう一つの文。",
  );
  expect(screen.getByText("6 / 13 字")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "音声設定" }));
  expect(
    screen
      .getAllByRole("radio", { name: /×$/ })
      .map((button) => button.props.accessibilityLabel),
  ).toEqual(["0.7×", "1×", "1.2×", "1.5×", "1.7×", "2×"]);
  expect(screen.queryByRole("button", { name: "速度" })).toBeNull();
  expect(screen.queryByRole("button", { name: "音声" })).toBeNull();
  expect(screen.queryByRole("switch", { name: "追従スクロール" })).toBeNull();
  expect(screen.queryByRole("switch", { name: "連続再生" })).toBeNull();
  await fireEvent.press(screen.getByRole("radio", { name: "1.5×" }));
  expect(screen.getByRole("radio", { name: "1.5×" })).toBeChecked();
  expect(screen.getByText("音声設定")).toBeOnTheScreen();
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "もう一つの文。",
    expect.objectContaining({ rate: 1.5 }),
  );
  await fireEvent.press(
    await screen.findByRole("radio", { name: "日本語音声（拡張）" }),
  );
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "もう一つの文。",
    expect.objectContaining({ voice: "ja-voice" }),
  );
  // カッコの声はここの 1 行で、押すとそのページが開く。
  expect(
    screen.getByRole("button", { name: "カッコ別の音声 オフ" }),
  ).toBeOnTheScreen();
  const pitch = screen.getByRole("adjustable", { name: "声の高さ" });
  const beforeDrag = jest.mocked(Speech.speak).mock.calls.length;
  await fireEvent(pitch, "RNCSliderSlidingStart", {
    nativeEvent: { value: 1 },
  });
  await fireEvent(pitch, "RNCSliderValueChange", {
    nativeEvent: { value: 1.4 },
  });
  expect(Speech.speak).toHaveBeenCalledTimes(beforeDrag);
  await fireEvent(pitch, "RNCSliderSlidingComplete", {
    nativeEvent: { value: 1.4 },
  });
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "もう一つの文。",
    expect.objectContaining({ rate: 1.5, pitch: 1.4, voice: "ja-voice" }),
  );
  await dismissSheet();
  await fireEvent.press(screen.getByRole("button", { name: "音声設定" }));
  expect(screen.getByRole("radio", { name: "1.5×" })).toBeChecked();
  expect(
    screen.getByRole("radio", { name: "日本語音声（拡張）" }),
  ).toBeChecked();
  expect(
    screen.getByRole("adjustable", { name: "声の高さ" }),
  ).toHaveAccessibilityValue({ now: 1.4 });
  await fireEvent.press(screen.getByRole("button", { name: "標準に戻す" }));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "もう一つの文。",
    expect.objectContaining({ pitch: 1 }),
  );
  // スクリーンリーダーの調整操作は、ドラッグを始めずに値を変えられる。
  await fireEvent(
    screen.getByRole("adjustable", { name: "声の高さ" }),
    "RNCSliderValueChange",
    { nativeEvent: { value: 1.2 } },
  );
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "もう一つの文。",
    expect.objectContaining({ pitch: 1.2 }),
  );
  await dismissSheet();
  await seek(0);
  expect(screen.getByTestId("current-paragraph")).toHaveTextContent(
    "最初の本文。",
  );
  expect(screen.queryByRole("button", { name: "前の段落" })).toBeNull();
  // タイマーはドックにあり、設定すると残り時間を表示する。
  await fireEvent.press(screen.getByRole("button", { name: "タイマー" }));
  await fireEvent.press(screen.getByRole("radio", { name: "5分" }));
  expect(
    within(screen.getByTestId("viewer-player")).getByText("5分"),
  ).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  expect(screen).toHavePathname("/");
  expect(screen.getByTestId("mini-player")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "一時停止" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText("ホーム"));
  expect(screen).toHavePathname("/home");
  const calls = jest.mocked(Speech.speak).mock.calls.length;
  await fireEvent.press(screen.getByRole("link", { name: "ビューアーを開く" }));
  expect(screen).toHavePathname("/reader");
  expect(await screen.findByTestId("chapter-content")).toBeOnTheScreen();
  expect(screen.getByTestId("viewer-player")).toBeOnTheScreen();
  expect(screen.getByTestId("current-paragraph")).toHaveTextContent(
    "最初の本文。",
  );
  expect(Speech.speak).toHaveBeenCalledTimes(calls);
  await fireEvent.press(screen.getByRole("button", { name: "目次" }));
  await fireEvent.press(screen.getByRole("radio", { name: "おわり" }));
  expect(screen.getByRole("header", { name: "おわり" })).toBeOnTheScreen();
  expect(chapterText("次の本文。")).toBeOnTheScreen();
});

it("updates the displayed chapter when playback advances and reopens the same shared position", async () => {
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  expect(await screen.findByTestId("viewer-player")).toBeOnTheScreen();
  await screen.findByTestId("chapter-content");
  await seek(90);
  await fireEvent.press(screen.getByRole("button", { name: "再生" }));
  const options = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!;
  await act(async () => {
    (options.onDone as () => void)();
  });
  expect(screen.getByRole("header", { name: "おわり" })).toBeOnTheScreen();
  expect(chapterText("次の本文。")).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  await fireEvent.press(
    screen.getByRole("link", { name: "サンプル作品を開く" }),
  );
  expect(screen.getByRole("header", { name: "おわり" })).toBeOnTheScreen();
  expect(await screen.findByTestId("current-paragraph")).toHaveTextContent(
    "次の本文。",
  );
});

it("keeps image-only chapters viewable with the player present", async () => {
  seed({
    ...book,
    chapters: [
      {
        id: "cover",
        title: "口絵",
        content: [
          { type: "image", uri: "data:image/png;base64,YQ==", alt: "表紙" },
        ],
      },
      ...book.chapters,
    ],
  });
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  expect(await screen.findByRole("header", { name: "口絵" })).toBeOnTheScreen();
  expect(
    within(await screen.findByTestId("chapter-content")).getByLabelText("表紙"),
  ).toHaveProp("source", { uri: "data:image/png;base64,YQ==" });
  expect(screen.getByTestId("viewer-player")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "再生" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "次の話" }));
  expect(screen.getByRole("header", { name: "はじまり" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "目次" }));
  await fireEvent.press(screen.getByRole("radio", { name: "口絵" }));
  expect(screen.getByRole("header", { name: "口絵" })).toBeOnTheScreen();
  expect(screen.getByTestId("viewer-player")).toBeOnTheScreen();
});

it("changes font size, line spacing and theme from the reader settings and keeps them", async () => {
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("chapter-content");
  // 既定値: 黒テーマで 17pt。
  const paragraph = () => chapterText("最初の本文。").parent;
  expect(paragraph()).toHaveStyle({ fontSize: 17, lineHeight: 33 });
  expect(screen.getByTestId("chapter-content")).toHaveStyle({
    backgroundColor: colors.background,
  });
  await fireEvent.press(screen.getByRole("button", { name: "リーダー設定" }));
  expect(screen.getByText("リーダー設定")).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "文字サイズ 中" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "行間 標準" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "テーマカラー 黒" })).toBeChecked();
  // どの選択もすぐに反映され、シートは開いたまま。
  await fireEvent.press(screen.getByRole("radio", { name: "文字サイズ 大" }));
  await fireEvent.press(screen.getByRole("radio", { name: "行間 狭い" }));
  await fireEvent.press(screen.getByRole("radio", { name: "テーマカラー 白" }));
  expect(screen.getByText("リーダー設定")).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "文字サイズ 大" })).toBeChecked();
  expect(paragraph()).toHaveStyle({
    color: themes.white.text,
    fontSize: 21,
    lineHeight: 34,
  });
  expect(screen.getByTestId("chapter-content")).toHaveStyle({
    backgroundColor: themes.white.background,
  });
  expect(saveDisplay).toHaveBeenLastCalledWith({
    fontSize: "large",
    lineHeight: "tight",
    theme: "white",
    playOn: "doubleTap",
  });
  // 表示を変えても再生には触れない。
  expect(Speech.speak).not.toHaveBeenCalled();
  await dismissSheet();
  // 設定はビューアーを閉じても残る。
  await fireEvent.press(
    screen.getByRole("button", { name: "ビューアーを閉じる" }),
  );
  await fireEvent.press(screen.getByRole("link", { name: "ビューアーを開く" }));
  await screen.findByTestId("chapter-content");
  expect(paragraph()).toHaveStyle({ fontSize: 21 });
});

it("restores saved display settings and ignores unknown values", async () => {
  jest
    .mocked(loadDisplay)
    .mockReturnValue({ fontSize: "xlarge", lineHeight: 3, theme: "sepia" });
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("chapter-content");
  expect(chapterText("最初の本文。").parent).toHaveStyle({
    fontSize: 25,
    // 不正な行の高さは既定の比率に戻される。
    lineHeight: Math.round(25 * (33 / 17)),
  });
  expect(screen.getByTestId("chapter-content")).toHaveStyle({
    backgroundColor: "#F4ECD8",
  });
});

it("moves on a tap, plays on a double tap, and can be set to play on a single tap", async () => {
  let now = 1_000;
  const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("chapter-content");
  await seek(90);
  expect(screen.getByTestId("current-paragraph")).toHaveTextContent(
    "もう一つの文。",
  );
  // 1 回のタップは読む位置を動かすだけ。
  await fireEvent.press(chapterText("最初の本文。"));
  expect(screen.getByTestId("current-paragraph")).toHaveTextContent(
    "最初の本文。",
  );
  expect(Speech.speak).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "再生" })).toBeOnTheScreen();
  // 直後のもう 1 回のタップで、そこから読み始める。
  now += 200;
  await fireEvent.press(chapterText("最初の本文。"));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "最初の本文。",
    expect.any(Object),
  );
  await fireEvent.press(screen.getByRole("button", { name: "一時停止" }));
  // リーダー設定で、1 回のタップで読み始めるようにもできる。
  await fireEvent.press(screen.getByRole("button", { name: "リーダー設定" }));
  expect(
    screen.getByRole("radio", { name: "本文から再生 ダブルタップ" }),
  ).toBeChecked();
  await fireEvent.press(
    screen.getByRole("radio", { name: "本文から再生 タップ" }),
  );
  expect(saveDisplay).toHaveBeenLastCalledWith(
    expect.objectContaining({ playOn: "tap" }),
  );
  await dismissSheet();
  await seek(90);
  const calls = jest.mocked(Speech.speak).mock.calls.length;
  now += 5_000;
  await fireEvent.press(chapterText("最初の本文。"));
  expect(jest.mocked(Speech.speak).mock.calls.length).toBe(calls + 1);
  expect(screen.getByRole("button", { name: "一時停止" })).toBeOnTheScreen();
  clock.mockRestore();
});

it("with play on tap, starts at the tapped paragraph and keeps playback running when manual scrolling disables following", async () => {
  jest.mocked(loadDisplay).mockReturnValue({ playOn: "tap" });
  seed({
    ...book,
    chapters: [
      {
        ...book.chapters[0],
        content: [
          {
            type: "element",
            tag: "p",
            children: [{ type: "text", text: "一段落目。一段落目の続き。" }],
          },
          {
            type: "element",
            tag: "p",
            children: [{ type: "text", text: "二段落目。二段落目の続き。" }],
          },
        ],
      },
      book.chapters[1],
    ],
  });
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("chapter-content");
  const follow = { name: "読み上げ位置に戻る" };
  // 追従は最初からオン。戻すボタンは、オフになって初めて出る。
  expect(screen.queryByRole("button", follow)).toBeNull();
  await fireEvent.press(chapterText("二段落目。二段落目の続き。"));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "二段落目。二段落目の続き。",
    expect.any(Object),
  );
  const staleDone = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!
    .onDone as () => void;
  await fireEvent.press(chapterText("一段落目。一段落目の続き。"));
  await act(async () => {
    staleDone();
  });
  expect(screen.getByTestId("current-paragraph")).toHaveTextContent(
    "一段落目。一段落目の続き。",
  );
  await fireEvent.press(chapterText("二段落目。二段落目の続き。"));
  const calls = jest.mocked(Speech.speak).mock.calls.length;
  await fireEvent(screen.getByTestId("chapter-content"), "scrollBeginDrag", {
    nativeEvent: {
      contentOffset: { x: 0, y: 100 },
      contentSize: { width: 390, height: 2000 },
      layoutMeasurement: { width: 390, height: 500 },
    },
  });
  expect(screen.getByRole("button", follow)).toBeOnTheScreen();
  expect(jest.mocked(Speech.speak).mock.calls.length).toBe(calls);
  // この段落は章の最後の単位: 読み終えると次へ進む。
  const options = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!;
  await act(async () => {
    (options.onDone as () => void)();
  });
  expect(screen.getByRole("header", { name: "おわり" })).toBeOnTheScreen();
  // 章が変わっても追従はオフのまま。
  expect(screen.getByRole("button", follow)).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "一時停止" })).toBeOnTheScreen();
  await fireEvent.press(chapterText("次の本文。"));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "次の本文。",
    expect.any(Object),
  );
  // 段落をタップしただけでは、追従はオンに戻らない。
  expect(screen.getByRole("button", follow)).toBeOnTheScreen();
  const beforeToggle = jest.mocked(Speech.speak).mock.calls.length;
  await fireEvent.press(screen.getByRole("button", follow));
  expect(screen.queryByRole("button", follow)).toBeNull();
  expect(jest.mocked(Speech.speak).mock.calls.length).toBe(beforeToggle);
});

it("opens the TOC from its header button; a book without a source page has no way back to one in its menu", async () => {
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("chapter-content");
  // EPUB の本には元のページがない: メニューにそこへ戻る手段は出ない。
  await fireEvent.press(screen.getByRole("button", { name: "その他" }));
  expect(screen.queryByRole("button", { name: "元のサイトで開く" })).toBeNull();
  await fireEvent.press(screen.getByTestId("reader-menu-backdrop"));
  expect(screen.queryByTestId("player-sheet")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "目次" }));
  expect(screen.getByText("目次")).toBeOnTheScreen();
});

it("closes the viewer from the title, like the arrow next to it", async () => {
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("chapter-content");
  await fireEvent.press(screen.getByRole("header", { name: "はじまり" }));
  expect(screen).toHavePathname("/");
  expect(screen.queryByTestId("player-sheet")).toBeNull();
});

it("uses native half/full sheet heights", async () => {
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("chapter-content");
  await fireEvent.press(screen.getByRole("button", { name: "目次" }));
  expect(jest.mocked(BottomSheet).mock.calls.at(-1)?.[0]).toMatchObject({
    isPresented: true,
    snapPoints: ["half", "full"],
    contentPadding: 0,
  });
  expect(screen.getByText("目次")).toBeOnTheScreen();
  await fireEvent(screen.getByTestId("player-sheet"), "requestClose");
  expect(screen.queryByRole("header", { name: "目次" })).toBeNull();
});

it("offers actions for a paragraph on a long press", async () => {
  await renderRouter(routes, { initialUrl: "/reader?id=sample-01" });
  await screen.findByTestId("chapter-content");
  await seek(90);
  await fireEvent(chapterText("最初の本文。"), "longPress", {
    nativeEvent: {},
  });
  const menu = within(screen.getByTestId("paragraph-menu"));
  // 段落はテキストエリアに入っているので、一部を選択できる。
  expect(menu.getByDisplayValue("最初の本文。")).toBeOnTheScreen();
  // 長押しそのものは位置を動かさず、読み上げも始めない。
  expect(screen.getByTestId("current-paragraph")).toHaveTextContent(
    "もう一つの文。",
  );
  expect(Speech.speak).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole("button", { name: "コピー" }));
  expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith("最初の本文。");
  expect(screen.queryByTestId("paragraph-menu")).not.toBeOnTheScreen();

  await fireEvent(chapterText("最初の本文。"), "longPress", {
    nativeEvent: {},
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "ここから読み上げ" }),
  );
  expect(Speech.speak).toHaveBeenLastCalledWith(
    "最初の本文。",
    expect.any(Object),
  );
  expect(screen.queryByTestId("paragraph-menu")).not.toBeOnTheScreen();

  // 一部を選択していれば、その部分だけがコピーされる。
  await fireEvent(chapterText("最初の本文。"), "longPress", {
    nativeEvent: {},
  });
  // このフィールドは読み取り専用で、fireEvent はそれを飛ばす: ハンドラを直接呼ぶ。
  await act(async () => {
    screen.getByTestId("paragraph-menu-text").props.onSelectionChange({
      nativeEvent: { selection: { start: 0, end: 2 } },
    });
  });
  await fireEvent.press(screen.getByRole("button", { name: "コピー" }));
  expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith("最初");

  // メニューは設定と同じボトムシート: 閉じれば何もせずに閉じる。
  await fireEvent(chapterText("最初の本文。"), "longPress", {
    nativeEvent: {},
  });
  expect(screen.getByText("段落")).toBeOnTheScreen();
  const speaks = jest.mocked(Speech.speak).mock.calls.length;
  await dismissSheet();
  expect(screen.queryByTestId("paragraph-menu")).not.toBeOnTheScreen();
  expect(Speech.speak).toHaveBeenCalledTimes(speaks);
});
