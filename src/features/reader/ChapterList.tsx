import { createContext, memo, useContext, useSyncExternalStore } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type FlatListProps,
  type ViewProps,
} from "react-native";

import type { Block } from "@/features/books/paragraphs";
import {
  ChapterRow,
  isRead,
  type ChapterRowProps,
  type TextRow,
} from "./ChapterRow";
import { Illustration } from "./Illustration";
import type { ChapterScroller } from "./chapterScroller";
import type { Reading } from "./reading";

export type Row = TextRow | Extract<Block, { kind: "image" }>;

const footerShare = 0.6;

export function rowOf(rows: readonly Row[], paragraphIndex: number): number {
  return rows.findIndex(
    (row) => row.kind === "text" && row.indices.includes(paragraphIndex),
  );
}

function rowKey(row: Row, index: number): string {
  return row.kind === "text" ? `p${row.indices[0]}` : `i${index}`;
}

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

function webScrollHandlers(
  stop: () => void,
): Partial<FlatListProps<Row>> | undefined {
  const events: WebScrollEvents | undefined =
    Platform.OS === "web"
      ? {
          onWheel: stop,
          onTouchMove: stop,
          onKeyDown: ({ nativeEvent }) => {
            if (scrollKeys.includes(nativeEvent.key)) {
              stop();
            }
          },
        }
      : undefined;
  return events;
}

function scrollHandlers(
  rows: readonly Row[],
  reading: Reading,
  scroller: ChapterScroller,
): Partial<FlatListProps<Row>> {
  function scrollToPosition(): void {
    const paragraph = reading.paragraphIndex();
    scroller.scrollTo(rowOf(rows, paragraph), paragraph);
  }
  function stopFollowing(): void {
    scroller.stop();
    reading.stopFollowing();
  }
  return {
    onLayout({ nativeEvent }) {
      scroller.setViewportHeight(nativeEvent.layout.height);
      const current = rowOf(rows, reading.paragraphIndex());
      if (reading.follows() && scroller.isTarget(current)) {
        scrollToPosition();
      }
    },
    onScrollBeginDrag: stopFollowing,
    onScroll({ nativeEvent }) {
      scroller.setOffset(nativeEvent.contentOffset.y);
    },
    onScrollToIndexFailed({ index }) {
      if (reading.follows()) {
        scroller.retryLater(index, scrollToPosition);
      }
    },
    ...webScrollHandlers(stopFollowing),
  };
}

interface Cells {
  scroller: ChapterScroller;
  reading: Reading;
  readOpacity: number;
}

const CellsContext = createContext<Cells | null>(null);

function useCells(): Cells {
  const cells = useContext(CellsContext);
  if (!cells) {
    throw new Error("ChapterListが必要です。");
  }
  return cells;
}

type CellProps = ViewProps & { index: number; item: Row };

function Cell({ index, item, style, onLayout, ...props }: CellProps) {
  const { scroller, reading, readOpacity } = useCells();
  const read = useSyncExternalStore(
    reading.subscribe,
    () => item.kind === "text" && isRead(item, reading.paragraphIndex()),
  );
  return (
    <View
      {...props}
      style={[style, read && { opacity: readOpacity }]}
      onLayout={(event) => {
        scroller.setRowTop(index, event.nativeEvent.layout.y);
        onLayout?.(event);
      }}
    />
  );
}

export type ChapterListProps = Omit<ChapterRowProps, "row" | "rowIndex"> & {
  title: string;
  rows: Row[];
  placed: boolean;
  attachList: ChapterScroller["attachList"];
};

function ChapterListView({
  title,
  rows,
  placed,
  attachList,
  ...row
}: ChapterListProps) {
  const window = useWindowDimensions();
  const { look, reading, scroller } = row;
  const { palette } = look;
  return (
    <CellsContext
      value={{ scroller, reading, readOpacity: palette.readOpacity }}
    >
      <FlatList
        ref={attachList}
        testID="chapter-content"
        accessibilityLabel={title}
        data={rows}
        // WORKAROUND: 仮想化したリストを途中から始める（initialScrollIndex）と、上の行が見積もりのままになり、読む位置を追うと違う文章や空白に着く。すべての段落を描画して計測する。
        initialNumToRender={rows.length}
        maxToRenderPerBatch={rows.length}
        windowSize={1000}
        scrollEventThrottle={16}
        CellRendererComponent={Cell}
        {...scrollHandlers(rows, reading, scroller)}
        style={[
          styles.list,
          { backgroundColor: palette.background },
          !placed && styles.unplaced,
        ]}
        contentContainerStyle={styles.content}
        ListFooterComponent=<View
          style={{ height: window.height * footerShare }}
        />
        keyExtractor={rowKey}
        renderItem={({ item, index }) =>
          item.kind === "image" ? (
            <Illustration
              uri={item.uri}
              alt={item.alt}
              color={palette.dimmed}
            />
          ) : (
            <ChapterRow row={item} rowIndex={index} {...row} />
          )
        }
      />
    </CellsContext>
  );
}

export const ChapterList = memo(ChapterListView);

const styles = StyleSheet.create({
  list: { flex: 1 },
  unplaced: { opacity: 0 },
  content: {
    gap: 12,
    paddingTop: 4,
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
});
