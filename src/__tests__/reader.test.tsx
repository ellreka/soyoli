import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { FlatList, Platform } from "react-native";

import { colors } from "@/constants/theme";
import type { Chapter } from "@/features/books/book";
import { ChapterText } from "@/features/reader/ChapterText";

const chapter: Chapter = {
  id: "chapter",
  title: "章",
  content: [
    {
      type: "element",
      tag: "p",
      children: [{ type: "text", text: "一段落目。一段落目の続き。" }],
    },
    { type: "image", uri: "data:image/png;base64,YQ==", alt: "挿絵" },
    {
      type: "element",
      tag: "p",
      children: [{ type: "text", text: "二段落目。二段落目の続き。" }],
    },
  ],
};
const scrollEvent = {
  nativeEvent: {
    contentOffset: { x: 0, y: 100 },
    contentSize: { width: 390, height: 2000 },
    layoutMeasurement: { width: 390, height: 500 },
  },
};
const rubyChapter: Chapter = {
  id: "ruby",
  title: "ルビ",
  content: [
    {
      type: "element",
      tag: "p",
      children: [
        { type: "text", text: "次は" },
        {
          type: "element",
          tag: "ruby",
          children: [
            { type: "text", text: "漢字" },
            {
              type: "element",
              tag: "rt",
              children: [{ type: "text", text: "かんじ" }],
            },
          ],
        },
        { type: "text", text: "です。続きの文。" },
      ],
    },
  ],
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("sets ruby readings over their base characters", async () => {
  await render(
    <ChapterText
      chapter={rubyChapter}
      paragraphIndex={0}
      autoScroll
      onManualScroll={jest.fn()}
      onSelect={jest.fn()}
    />,
  );
  const paragraph = screen.getByRole("button", {
    name: "次は漢字です。続きの文。",
  });
  const reading = within(paragraph).getByText("かんじ");
  // 本文（17）の半分の大きさで、親文字 2 つの上に載る: 幅は読み 4 文字分
  // （うち 1 文字分はゆとり）で、親文字の 34 に対して中央に置き、字形の上へ
  // 持ち上げる — iOS（ここ）では、行の余分な高さの半分だけさらに上げる。
  // アンカーがベースラインよりその分だけ下にあるため。
  expect(reading).toHaveStyle({
    color: colors.secondary,
    fontSize: 9,
    position: "absolute",
    width: 36,
    right: -1,
    bottom: 22,
  });
  // 段落全体が 1 つの単位: ブロックとして幅いっぱいに印が付き、
  // その中の文字が既読として薄くなることはない。
  expect(paragraph).toHaveStyle({ backgroundColor: colors.marker });
  expect(screen.getByTestId("current-paragraph")).not.toHaveStyle({
    color: colors.secondary,
  });
});

it("reads paragraph by paragraph: marks the current one in full and selects by paragraph", async () => {
  const onSelect = jest.fn();
  await render(
    <ChapterText
      chapter={chapter}
      paragraphIndex={1}
      autoScroll
      onManualScroll={jest.fn()}
      onSelect={onSelect}
    />,
  );
  const first = screen.getByRole("button", {
    name: "一段落目。一段落目の続き。",
  });
  const second = screen.getByRole("button", {
    name: "二段落目。二段落目の続き。",
  });
  // ボタンは段落ごとに 1 つ。中の文は単位ではない。
  expect(screen.getAllByRole("button")).toHaveLength(2);
  expect(screen.queryByText("一段落目の続き。")).toBeNull();
  // 今の段落は丸ごと印が付き、その前の段落は薄くなる。
  expect(second).toHaveStyle({ backgroundColor: colors.marker });
  expect(within(second).getByTestId("current-paragraph")).toHaveTextContent(
    "二段落目。二段落目の続き。",
  );
  expect(first).not.toHaveStyle({ backgroundColor: colors.marker });
  expect(within(first).getByText("一段落目。一段落目の続き。")).toHaveStyle({
    color: colors.secondary,
  });
  // 段落のどこをタップしても、その段落が選ばれる。
  await fireEvent(first, "press", { nativeEvent: { locationY: 700 } });
  expect(onSelect).toHaveBeenLastCalledWith(0);
  await fireEvent.press(second);
  expect(onSelect).toHaveBeenLastCalledWith(1);
  await fireEvent.press(screen.getByLabelText("挿絵"));
  expect(onSelect).toHaveBeenCalledTimes(2);
});

it("moves on a tap and plays on a second tap of the same paragraph", async () => {
  const onSelect = jest.fn();
  const onPlay = jest.fn();
  let now = 1_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  await render(
    <ChapterText
      chapter={chapter}
      paragraphIndex={0}
      autoScroll
      onManualScroll={jest.fn()}
      onSelect={onSelect}
      onPlay={onPlay}
    />,
  );
  const first = screen.getByRole("button", {
    name: "一段落目。一段落目の続き。",
  });
  const second = screen.getByRole("button", {
    name: "二段落目。二段落目の続き。",
  });
  expect(first).toHaveProp(
    "accessibilityHint",
    "タップで読み上げ位置を移動、ダブルタップで再生",
  );
  await fireEvent.press(first);
  expect(onSelect).toHaveBeenLastCalledWith(0);
  expect(onPlay).not.toHaveBeenCalled();
  // 直後の 2 回目のタップで、最初のタップが選んだ段落から再生する。
  now += 200;
  await fireEvent.press(first);
  expect(onPlay).toHaveBeenLastCalledWith(0);
  expect(onSelect).toHaveBeenCalledTimes(1);
  // 3 回目のタップで仕切り直し: これはまた 1 回のタップになる。
  now += 100;
  await fireEvent.press(first);
  expect(onSelect).toHaveBeenCalledTimes(2);
  // ダブルタップにしては遅すぎる。
  now += 400;
  await fireEvent.press(first);
  expect(onSelect).toHaveBeenCalledTimes(3);
  expect(onPlay).toHaveBeenCalledTimes(1);
  // 別々の段落への素早い 2 回のタップは、1 回のタップが 2 つ。
  now += 100;
  await fireEvent.press(second);
  expect(onSelect).toHaveBeenLastCalledWith(1);
  expect(onPlay).toHaveBeenCalledTimes(1);
  now += 100;
  await fireEvent.press(second);
  expect(onPlay).toHaveBeenLastCalledWith(1);
});

it("slides the text to the reading position in a moment, once its rows are measured", async () => {
  jest.useFakeTimers();
  const scrollToIndex = jest
    .spyOn(FlatList.prototype, "scrollToIndex")
    .mockImplementation(() => {});
  const scrollToOffset = jest
    .spyOn(FlatList.prototype, "scrollToOffset")
    .mockImplementation(() => {});
  const onManualScroll = jest.fn();
  const view = (paragraphIndex: number) => (
    <ChapterText
      chapter={chapter}
      paragraphIndex={paragraphIndex}
      autoScroll
      onManualScroll={onManualScroll}
      onSelect={jest.fn()}
    />
  );
  const { rerender } = await render(view(0));
  const list = screen.getByTestId("chapter-content");
  await fireEvent(list, "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 500 } },
  });
  // 2 つ目の段落は 3 行目: コンテンツの 900 下から始まる。
  const row = screen.getAllByRole("button")[1].parent;
  if (!row) {
    throw new Error("the paragraph is not in a cell of the list");
  }
  await fireEvent(row, "layout", {
    nativeEvent: { layout: { x: 0, y: 900, width: 390, height: 60 } },
  });
  const placed = scrollToIndex.mock.calls.length;
  await rerender(view(1));
  // プラットフォームのアニメーション付きスクロールは使わない。速くできないため。
  expect(scrollToIndex).toHaveBeenCalledTimes(placed);
  await act(async () => {
    jest.advanceTimersByTime(48);
  });
  const partway = scrollToOffset.mock.lastCall?.[0].offset ?? 0;
  expect(partway).toBeGreaterThan(0);
  expect(partway).toBeLessThan(750);
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  // ビューポートの 30% が段落の上に残る。
  expect(scrollToOffset).toHaveBeenLastCalledWith({
    offset: 750,
    animated: false,
  });
  // ドラッグは、進行中のスライドに取って代わる。
  await rerender(view(0));
  await fireEvent(list, "scrollBeginDrag", scrollEvent);
  const frames = scrollToOffset.mock.calls.length;
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  expect(scrollToOffset).toHaveBeenCalledTimes(frames);
});

it("stops following and pending scroll retries on manual scrolling, resumes on enable, and cleans up on unmount", async () => {
  jest.useFakeTimers();
  const scrollToIndex = jest
    .spyOn(FlatList.prototype, "scrollToIndex")
    .mockImplementation(() => {});
  const scrollToOffset = jest
    .spyOn(FlatList.prototype, "scrollToOffset")
    .mockImplementation(() => {});
  const onManualScroll = jest.fn();
  const onSelect = jest.fn();
  const view = (paragraphIndex: number, autoScroll = true) => (
    <ChapterText
      chapter={chapter}
      paragraphIndex={paragraphIndex}
      autoScroll={autoScroll}
      onManualScroll={onManualScroll}
      onSelect={onSelect}
    />
  );
  const { rerender, unmount } = await render(view(1));
  await rerender(view(0));
  expect(scrollToIndex).toHaveBeenLastCalledWith({
    index: 0,
    viewPosition: 0,
    viewOffset: 0,
    animated: false,
  });
  await fireEvent.scroll(
    screen.getByTestId("chapter-content"),
    scrollEvent.nativeEvent,
  );
  expect(onManualScroll).not.toHaveBeenCalled();
  await fireEvent(
    screen.getByTestId("chapter-content"),
    "scrollToIndexFailed",
    { index: 0, averageItemLength: 50, highestMeasuredFrameIndex: 0 },
  );
  // スクロールに失敗したら、段落が計測されるのを待ってやり直す。
  // 見積もりのオフセットへは飛ばない。
  expect(scrollToOffset).not.toHaveBeenCalled();
  await fireEvent(
    screen.getByTestId("chapter-content"),
    "scrollBeginDrag",
    scrollEvent,
  );
  expect(onManualScroll).toHaveBeenCalledTimes(1);
  await rerender(view(1, false));
  const calls = scrollToIndex.mock.calls.length;
  const offsets = scrollToOffset.mock.calls.length;
  await act(async () => {
    jest.advanceTimersByTime(100);
  });
  await rerender(view(1, false));
  await fireEvent(
    screen.getByTestId("chapter-content"),
    "scrollToIndexFailed",
    { index: 0, averageItemLength: 50, highestMeasuredFrameIndex: 0 },
  );
  expect(scrollToIndex).toHaveBeenCalledTimes(calls);
  expect(scrollToOffset).toHaveBeenCalledTimes(offsets);
  await rerender(view(1));
  // 段落 1 の前には段落 1 つと画像 1 つがある: リストでは 2 番目の項目。
  expect(scrollToIndex).toHaveBeenLastCalledWith({
    index: 2,
    viewPosition: 0,
    viewOffset: 0,
    animated: false,
  });
  const beforeToggle = scrollToIndex.mock.calls.length;
  await rerender(view(1, false));
  await rerender(view(1));
  expect(scrollToIndex).toHaveBeenCalledTimes(beforeToggle + 1);
  expect(scrollToIndex).toHaveBeenLastCalledWith({
    index: 2,
    viewPosition: 0,
    viewOffset: 0,
    animated: false,
  });
  await fireEvent(
    screen.getByTestId("chapter-content"),
    "scrollToIndexFailed",
    { index: 2, averageItemLength: 50, highestMeasuredFrameIndex: 0 },
  );
  const beforeUnmount = scrollToIndex.mock.calls.length;
  await unmount();
  await act(async () => {
    jest.advanceTimersByTime(100);
  });
  expect(scrollToIndex).toHaveBeenCalledTimes(beforeUnmount);
});

it.each(["wheel", "touchMove", "keyDown"])(
  "suspends following on web %s",
  async (event) => {
    jest.replaceProperty(Platform, "OS", "web");
    const onManualScroll = jest.fn();
    await render(
      <ChapterText
        chapter={chapter}
        paragraphIndex={0}
        autoScroll
        onManualScroll={onManualScroll}
        onSelect={jest.fn()}
      />,
    );
    await fireEvent(screen.getByTestId("chapter-content"), event, {
      nativeEvent: { key: "ArrowDown", touches: [] },
    });
    expect(onManualScroll).toHaveBeenCalled();
  },
);
