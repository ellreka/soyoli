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
import { themes } from "@/features/reader/Display";
import { readingFrom } from "@/features/reader/reading";
import * as ruby from "@/features/reader/ruby";
import { createStore } from "@/lib/store";

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

function readingAt(paragraphIndex: number, follows = true) {
  const position = createStore(paragraphIndex);
  const following = createStore(follows);
  return {
    reading: readingFrom(position, following),
    following,
    async move(to: number, follow = following.get()) {
      await act(async () => {
        position.update(() => to);
        following.update(() => follow);
      });
    },
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("sets ruby readings over their base characters", async () => {
  await render(
    <ChapterText
      chapter={rubyChapter}
      reading={readingAt(0).reading}
      onSelect={jest.fn()}
    />,
  );
  const paragraph = screen.getByRole("button", {
    name: "次は漢字です。続きの文。",
  });
  const reading = within(paragraph).getByText("かんじ");
  expect(reading).toHaveStyle({
    color: colors.secondary,
    fontSize: 9,
    position: "absolute",
    width: 36,
    right: -1,
    bottom: 22,
  });
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
      reading={readingAt(1).reading}
      onSelect={onSelect}
    />,
  );
  const first = screen.getByRole("button", {
    name: "一段落目。一段落目の続き。",
  });
  const second = screen.getByRole("button", {
    name: "二段落目。二段落目の続き。",
  });
  expect(screen.getAllByRole("button")).toHaveLength(2);
  expect(screen.queryByText("一段落目の続き。")).toBeNull();
  expect(second).toHaveStyle({ backgroundColor: colors.marker });
  expect(within(second).getByTestId("current-paragraph")).toHaveTextContent(
    "二段落目。二段落目の続き。",
  );
  expect(first).not.toHaveStyle({ backgroundColor: colors.marker });
  expect(first.parent).toHaveStyle({ opacity: themes.black.readOpacity });
  expect(second.parent).not.toHaveStyle({
    opacity: themes.black.readOpacity,
  });
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
      reading={readingAt(0).reading}
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
  now += 200;
  await fireEvent.press(first);
  expect(onPlay).toHaveBeenLastCalledWith(0);
  expect(onSelect).toHaveBeenCalledTimes(1);
  now += 100;
  await fireEvent.press(first);
  expect(onSelect).toHaveBeenCalledTimes(2);
  now += 400;
  await fireEvent.press(first);
  expect(onSelect).toHaveBeenCalledTimes(3);
  expect(onPlay).toHaveBeenCalledTimes(1);
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
  const { reading, move } = readingAt(0);
  await render(
    <ChapterText chapter={chapter} reading={reading} onSelect={jest.fn()} />,
  );
  const list = screen.getByTestId("chapter-content");
  await fireEvent(list, "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 500 } },
  });
  const row = screen.getAllByRole("button")[1].parent;
  if (!row) {
    throw new Error("the paragraph is not in a cell of the list");
  }
  await fireEvent(row, "layout", {
    nativeEvent: { layout: { x: 0, y: 900, width: 390, height: 60 } },
  });
  const placed = scrollToIndex.mock.calls.length;
  await move(1);
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
  expect(scrollToOffset).toHaveBeenLastCalledWith({
    offset: 750,
    animated: false,
  });
  await move(0);
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
  const { reading, following, move } = readingAt(1);
  const { unmount } = await render(
    <ChapterText chapter={chapter} reading={reading} onSelect={jest.fn()} />,
  );
  await move(0);
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
  expect(following.get()).toBe(true);
  await fireEvent(
    screen.getByTestId("chapter-content"),
    "scrollToIndexFailed",
    { index: 0, averageItemLength: 50, highestMeasuredFrameIndex: 0 },
  );
  expect(scrollToOffset).not.toHaveBeenCalled();
  await fireEvent(
    screen.getByTestId("chapter-content"),
    "scrollBeginDrag",
    scrollEvent,
  );
  expect(following.get()).toBe(false);
  await move(1);
  const calls = scrollToIndex.mock.calls.length;
  const offsets = scrollToOffset.mock.calls.length;
  await act(async () => {
    jest.advanceTimersByTime(100);
  });
  await fireEvent(
    screen.getByTestId("chapter-content"),
    "scrollToIndexFailed",
    { index: 0, averageItemLength: 50, highestMeasuredFrameIndex: 0 },
  );
  expect(scrollToIndex).toHaveBeenCalledTimes(calls);
  expect(scrollToOffset).toHaveBeenCalledTimes(offsets);
  await move(1, true);
  expect(scrollToIndex).toHaveBeenLastCalledWith({
    index: 2,
    viewPosition: 0,
    viewOffset: 0,
    animated: false,
  });
  const beforeToggle = scrollToIndex.mock.calls.length;
  await move(1, false);
  await move(1, true);
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
    const { reading, following } = readingAt(0);
    await render(
      <ChapterText chapter={chapter} reading={reading} onSelect={jest.fn()} />,
    );
    await fireEvent(screen.getByTestId("chapter-content"), event, {
      nativeEvent: { key: "ArrowDown", touches: [] },
    });
    expect(following.get()).toBe(false);
  },
);

it("draws only the row that had the position and the row that gets it when the position moves, however far, and never the list", async () => {
  const rowCount = 40;
  const long: Chapter = {
    id: "long",
    title: "長い話",
    content: Array.from({ length: rowCount }, (_, index) => ({
      type: "element" as const,
      tag: "p" as const,
      children: [{ type: "text" as const, text: `段落${index}。` }],
    })),
  };
  const drawn = jest.spyOn(ruby, "renderRuby");
  const { reading, move } = readingAt(0, false);
  const text = (onSelect: () => void) => (
    <ChapterText chapter={long} reading={reading} onSelect={onSelect} />
  );
  const view = await render(text(jest.fn()));
  expect(drawn).toHaveBeenCalledTimes(rowCount);
  const listDrawn = jest.spyOn(FlatList.prototype, "render");

  drawn.mockClear();
  await move(1);
  expect(drawn).toHaveBeenCalledTimes(2);

  drawn.mockClear();
  await move(30);
  expect(drawn).toHaveBeenCalledTimes(2);
  const row = (index: number) =>
    screen.getByRole("button", { name: `段落${index}。` });
  const faded = { opacity: themes.black.readOpacity };
  expect(row(0).parent).toHaveStyle(faded);
  expect(row(29).parent).toHaveStyle(faded);
  expect(row(30).parent).not.toHaveStyle(faded);
  expect(row(30)).toHaveStyle({ backgroundColor: colors.marker });
  expect(row(31).parent).not.toHaveStyle(faded);

  drawn.mockClear();
  await move(5);
  expect(drawn).toHaveBeenCalledTimes(2);
  expect(row(4).parent).toHaveStyle(faded);
  expect(row(5).parent).not.toHaveStyle(faded);
  expect(row(29).parent).not.toHaveStyle(faded);

  drawn.mockClear();
  const onSelect = jest.fn();
  await view.rerender(text(onSelect));
  expect(drawn).not.toHaveBeenCalled();
  expect(listDrawn).not.toHaveBeenCalled();
  await fireEvent.press(row(30));
  expect(onSelect).toHaveBeenCalledWith(30);
});
