import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  FlatList,
  useWindowDimensions,
  Platform,
  StyleSheet,
  Text,
  View,
  type FlatListProps,
  type ViewProps,
} from "react-native";

import { Loading } from "@/components/Loading";
import type { Chapter } from "@/features/books/book";
import { parseChapter, type Block } from "@/features/books/paragraphs";
import { themes, type ReaderPalette } from "./Display";
import { Illustration } from "./Illustration";
import { renderRuby, renderedLength, type RubyLook } from "./ruby";
import { useSubscription } from "@/lib/subscription";
import { createChapterScroller } from "./chapterScroller";

const placementFallbackMs = 500;

type Row =
  | { kind: "text"; indices: number[]; heading?: true }
  | Extract<Block, { kind: "image" }>;

// WORKAROUND: RN Web は実行時に onWheel/onKeyDown を足すが、react-native の FlatListProps にはない。
type WebScrollEvents = {
  onWheel: (event: unknown) => void;
  onTouchMove: (event: unknown) => void;
  onKeyDown: (event: { nativeEvent: { key: string } }) => void;
};
const scrollKeys = [
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
];

// WORKAROUND: 入れ子の <Text onPress> は Android でタップ領域が壊れる。行をボタンにして、タップ位置から段落を選ぶ。
function paragraphAt(
  indices: number[],
  tops: Map<number, number>,
  y: number | undefined,
): number {
  let index = indices[0];
  for (const candidate of indices) {
    const top = tops.get(candidate);
    if (top !== undefined && y !== undefined && top <= y) {
      index = candidate;
    }
  }
  return index;
}

interface ChapterTextProps {
  chapter: Chapter;
  paragraphIndex: number;
  autoScroll: boolean;
  fontSize?: number;
  lineHeight?: number;
  palette?: ReaderPalette;
  onManualScroll: () => void;
  onSelect: (paragraphIndex: number) => void;
  onPlay?: (paragraphIndex: number) => void;
  onMenu?: (paragraphIndex: number) => void;
}

type CellProps = ViewProps & { index: number };

const doubleTapMs = 300;

export function ChapterText({
  chapter,
  paragraphIndex,
  autoScroll,
  fontSize = 17,
  lineHeight = 33 / 17,
  palette = themes.black,
  onManualScroll,
  onSelect,
  onPlay,
  onMenu,
}: ChapterTextProps) {
  const lastTap = useRef<{ time: number; row: number; paragraph: number }>(
    null,
  );
  const window = useWindowDimensions();
  const { paragraphs, blocks } = useMemo(
    () => parseChapter(chapter.content),
    [chapter],
  );
  const rows = useMemo(() => {
    const grouped: Row[] = [];
    for (const block of blocks) {
      const previous = grouped.at(-1);
      if (block.kind === "image") {
        grouped.push(block);
      } else if (
        block.startsBlock ||
        previous?.kind !== "text" ||
        previous.heading !== block.heading
      ) {
        grouped.push({
          kind: "text",
          indices: [block.index],
          ...(block.heading && { heading: true as const }),
        });
      } else {
        previous.indices.push(block.index);
      }
    }
    return grouped;
  }, [blocks]);
  const current = useMemo(
    () =>
      rows.findIndex(
        (block) =>
          block.kind === "text" && block.indices.includes(paragraphIndex),
      ),
    [rows, paragraphIndex],
  );
  const textStyle = useMemo(
    () => [
      styles.text,
      {
        color: palette.text,
        fontSize,
        lineHeight: Math.round(fontSize * lineHeight),
      },
    ],
    [fontSize, lineHeight, palette],
  );
  const headingStyle = useMemo(
    () => [
      styles.heading,
      {
        color: palette.text,
        fontSize: Math.round(fontSize * 1.2),
        lineHeight: Math.round(fontSize * 1.2 * 1.5),
      },
    ],
    [fontSize, palette],
  );
  const rubyLooks = useMemo(() => {
    const look = (base: number, line: number): RubyLook => ({
      base,
      line,
      size: Math.round(base * 0.5),
      color: palette.dimmed,
    });
    const headingSize = Math.round(fontSize * 1.2);
    return {
      text: look(fontSize, Math.round(fontSize * lineHeight)),
      heading: look(headingSize, Math.round(headingSize * 1.5)),
    };
  }, [fontSize, lineHeight, palette]);

  const [scroller] = useState(() =>
    createChapterScroller(autoScroll ? current : -1),
  );
  const [attachList] = useState(() => scroller.attachList);
  const [placed, setPlaced] = useState(
    () => Platform.OS === "web" || !autoScroll || current <= 0,
  );
  const [revealSoon] = useState(() => (): (() => void) => {
    const fallback = setTimeout(() => {
      setPlaced(true);
    }, placementFallbackMs);
    return () => {
      clearTimeout(fallback);
    };
  });
  useSubscription(placed ? null : revealSoon);

  function scrollToParagraph(animated = false): void {
    scroller.scrollTo(current, paragraphIndex, animated);
  }

  const attachParagraph = autoScroll
    ? scroller.refFor(paragraphIndex, current)
    : scroller.track;

  function stopAutoScroll() {
    scroller.stop();
    onManualScroll();
  }

  const Cell = useCallback(
    ({ index, onLayout, ...props }: CellProps) => (
      <View
        {...props}
        onLayout={(event) => {
          scroller.setRowTop(index, event.nativeEvent.layout.y);
          onLayout?.(event);
        }}
      />
    ),
    [scroller],
  );

  const webEvents: WebScrollEvents | undefined =
    Platform.OS === "web"
      ? {
          onWheel: stopAutoScroll,
          onTouchMove: stopAutoScroll,
          onKeyDown: ({ nativeEvent }) => {
            if (scrollKeys.includes(nativeEvent.key)) {
              stopAutoScroll();
            }
          },
        }
      : undefined;
  // SAFETY: react-native の FlatListProps にはないが、RN Web は実行時に
  // これらのハンドラを受け付ける。undefined を展開しても何も足されない。
  const webHandlers = webEvents as Partial<FlatListProps<Row>> | undefined;

  return (
    <>
      {!placed && (
        <Loading color={palette.text} style={StyleSheet.absoluteFill} />
      )}
      <FlatList
        ref={attachList}
        testID="chapter-content"
        accessibilityLabel={chapter.title}
        data={rows}
        extraData={paragraphIndex}
        // WORKAROUND: 仮想化したリストを途中から始める（initialScrollIndex）と、上の行が見積もりのままになり、読む位置を追うと違う文章や空白に着く。すべての段落を描画して計測する。
        initialNumToRender={rows.length}
        maxToRenderPerBatch={rows.length}
        windowSize={1000}
        onLayout={({ nativeEvent }) => {
          scroller.setViewportHeight(nativeEvent.layout.height);
          if (autoScroll && scroller.isTarget(current)) {
            scrollToParagraph();
          }
        }}
        onScrollBeginDrag={stopAutoScroll}
        onScroll={({ nativeEvent }) => {
          scroller.setOffset(nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
        CellRendererComponent={Cell}
        {...webHandlers}
        style={[
          styles.list,
          { backgroundColor: palette.background },
          !placed && styles.unplaced,
        ]}
        contentContainerStyle={styles.content}
        ListFooterComponent=<View style={{ height: window.height * 0.6 }} />
        keyExtractor={(block, index) =>
          block.kind === "text" ? `p${block.indices[0]}` : `i${index}`
        }
        onScrollToIndexFailed={({ index }) => {
          if (autoScroll) {
            scroller.retryLater(index, () => {
              scrollToParagraph();
            });
          }
        }}
        renderItem={({ item }) => {
          if (item.kind === "image") {
            return (
              <Illustration
                uri={item.uri}
                alt={item.alt}
                color={palette.dimmed}
              />
            );
          }
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.indices
                .map((index) => paragraphs[index].text)
                .join("")}
              accessibilityHint={
                onPlay
                  ? "タップで読み上げ位置を移動、ダブルタップで再生"
                  : "タップした段落から再生"
              }
              onPress={(event) => {
                const now = Date.now();
                const row = item.indices[0];
                const previous = lastTap.current;
                if (
                  onPlay &&
                  previous?.row === row &&
                  now - previous.time < doubleTapMs
                ) {
                  lastTap.current = null;
                  onPlay(previous.paragraph);
                  return;
                }
                const paragraph = paragraphAt(
                  item.indices,
                  scroller.paragraphTops,
                  event.nativeEvent.locationY,
                );
                lastTap.current = { time: now, row, paragraph };
                onSelect(paragraph);
              }}
              onLongPress={
                onMenu &&
                ((event) => {
                  lastTap.current = null;
                  onMenu(
                    paragraphAt(
                      item.indices,
                      scroller.paragraphTops,
                      event.nativeEvent.locationY,
                    ),
                  );
                })
              }
              android_ripple={{ color: `${palette.dimmed}40` }}
              style={({ pressed }) => [
                styles.row,
                pressed &&
                  Platform.OS !== "android" && {
                    backgroundColor: `${palette.dimmed}33`,
                  },
                item.indices.includes(paragraphIndex) && {
                  backgroundColor: palette.marker,
                },
                pressed &&
                  Platform.OS !== "android" &&
                  item.indices.includes(paragraphIndex) &&
                  styles.pressedMarked,
              ]}
            >
              <Text
                accessibilityRole={item.heading ? "header" : undefined}
                style={item.heading ? headingStyle : textStyle}
                onLayout={() => {
                  if (
                    Platform.OS === "web" &&
                    autoScroll &&
                    scroller.isTarget(current) &&
                    item.indices.includes(paragraphIndex)
                  ) {
                    scrollToParagraph();
                  }
                }}
                onTextLayout={({ nativeEvent: { lines } }) => {
                  let lineIndex = 0;
                  let lineStart = 0;
                  let paragraphStart = 0;
                  for (const index of item.indices) {
                    while (
                      lineIndex < lines.length - 1 &&
                      lineStart + lines[lineIndex].text.length <= paragraphStart
                    ) {
                      lineStart += lines[lineIndex++].text.length;
                    }
                    scroller.paragraphTops.set(
                      index,
                      (lines[lineIndex]?.y ?? 0) + 2,
                    );
                    paragraphStart += renderedLength(paragraphs[index]);
                  }
                  if (
                    autoScroll &&
                    scroller.isTarget(current) &&
                    item.indices.includes(paragraphIndex)
                  ) {
                    scrollToParagraph();
                  }
                  if (!placed && item.indices.includes(paragraphIndex)) {
                    requestAnimationFrame(() => {
                      setPlaced(true);
                    });
                  }
                }}
              >
                {item.indices.map((index) => (
                  <Text
                    key={index}
                    ref={index === paragraphIndex ? attachParagraph : undefined}
                    testID={
                      index === paragraphIndex ? "current-paragraph" : undefined
                    }
                    style={[
                      index < paragraphIndex && { color: palette.dimmed },
                    ]}
                  >
                    {renderRuby(
                      paragraphs[index],
                      item.heading ? rubyLooks.heading : rubyLooks.text,
                    )}
                  </Text>
                ))}
              </Text>
            </Pressable>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  unplaced: { opacity: 0 },
  content: {
    gap: 12,
    paddingTop: 4,
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  pressedMarked: { opacity: 0.55 },
  row: {
    minHeight: 44,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  text: {
    fontWeight: "400",
    fontSize: 17,
    lineHeight: 33,
  },
  heading: { fontWeight: "600", paddingVertical: 8 },
});
