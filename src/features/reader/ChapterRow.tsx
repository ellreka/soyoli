import { memo, useSyncExternalStore, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import type { Paragraph } from "@/features/books/paragraphs";
import type { ReaderPalette } from "./Display";
import type { ChapterScroller } from "./chapterScroller";
import type { Reading } from "./reading";
import { renderRuby, renderedLength, type RubyLook } from "./ruby";

export interface TextRow {
  kind: "text";
  indices: number[];
  heading?: true;
}

const elsewhere = -1;

export function positionIn(row: TextRow, paragraphIndex: number): number {
  return row.indices.includes(paragraphIndex) ? paragraphIndex : elsewhere;
}

export function isRead(row: TextRow, paragraphIndex: number): boolean {
  const last = row.indices.at(-1);
  return last !== undefined && paragraphIndex > last;
}

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

interface TapHandlers {
  onSelect: (paragraphIndex: number) => void;
  onPlay?: (paragraphIndex: number) => void;
  onMenu?: (paragraphIndex: number) => void;
}

export interface RowTaps {
  listenTo: (handlers: TapHandlers) => void;
  press: (row: TextRow, y: number | undefined) => void;
  hold: (row: TextRow, y: number | undefined) => void;
}

const doubleTapMs = 300;

export function createRowTaps(tops: Map<number, number>): RowTaps {
  const taps: {
    handlers?: TapHandlers;
    last: { time: number; row: number; paragraph: number } | null;
  } = { last: null };
  return {
    listenTo(handlers) {
      taps.handlers = handlers;
    },
    press(row, y) {
      const now = Date.now();
      const previous = taps.last;
      const onPlay = taps.handlers?.onPlay;
      if (
        onPlay &&
        previous?.row === row.indices[0] &&
        now - previous.time < doubleTapMs
      ) {
        taps.last = null;
        onPlay(previous.paragraph);
        return;
      }
      const paragraph = paragraphAt(row.indices, tops, y);
      taps.last = { time: now, row: row.indices[0], paragraph };
      taps.handlers?.onSelect(paragraph);
    },
    hold(row, y) {
      taps.last = null;
      taps.handlers?.onMenu?.(paragraphAt(row.indices, tops, y));
    },
  };
}

export interface RowLook {
  palette: ReaderPalette;
  text: StyleProp<TextStyle>;
  heading: StyleProp<TextStyle>;
  ruby: { text: RubyLook; heading: RubyLook };
}

export interface ChapterRowProps {
  row: TextRow;
  rowIndex: number;
  paragraphs: readonly Paragraph[];
  look: RowLook;
  playsOnDoubleTap: boolean;
  opensMenu: boolean;
  taps: RowTaps;
  scroller: ChapterScroller;
  reading: Reading;
  onShown: (rowIndex: number) => void;
}

function recordParagraphTops(
  row: TextRow,
  paragraphs: readonly Paragraph[],
  lines: readonly { text: string; y: number }[],
  tops: Map<number, number>,
): void {
  let lineIndex = 0;
  let lineStart = 0;
  let paragraphStart = 0;
  for (const index of row.indices) {
    while (
      lineIndex < lines.length - 1 &&
      lineStart + lines[lineIndex].text.length <= paragraphStart
    ) {
      lineStart += lines[lineIndex++].text.length;
    }
    tops.set(index, (lines[lineIndex]?.y ?? 0) + 2);
    paragraphStart += renderedLength(paragraphs[index]);
  }
}

interface CurrentParagraphProps {
  paragraph: number;
  rowIndex: number;
  scroller: ChapterScroller;
  reading: Reading;
  children: ReactNode;
}

function CurrentParagraph({
  paragraph,
  rowIndex,
  scroller,
  reading,
  children,
}: CurrentParagraphProps) {
  const follows = useSyncExternalStore(reading.subscribe, reading.follows);
  return (
    <Text
      ref={follows ? scroller.refFor(paragraph, rowIndex) : scroller.track}
      testID="current-paragraph"
    >
      {children}
    </Text>
  );
}

type RowTextProps = Pick<
  ChapterRowProps,
  | "row"
  | "rowIndex"
  | "paragraphs"
  | "look"
  | "scroller"
  | "reading"
  | "onShown"
> & { position: number };

function RowText({
  row,
  rowIndex,
  paragraphs,
  position,
  look,
  scroller,
  reading,
  onShown,
}: RowTextProps) {
  const current = position !== elsewhere;
  const ruby = row.heading ? look.ruby.heading : look.ruby.text;
  const dimmed = { color: look.palette.dimmed };
  return (
    <Text
      accessibilityRole={row.heading ? "header" : undefined}
      style={row.heading ? look.heading : look.text}
      onLayout={() => {
        if (current && Platform.OS === "web") {
          onShown(rowIndex);
        }
      }}
      onTextLayout={({ nativeEvent: { lines } }) => {
        recordParagraphTops(row, paragraphs, lines, scroller.paragraphTops);
        if (current) {
          onShown(rowIndex);
        }
      }}
    >
      {row.indices.map((index) =>
        index === position ? (
          <CurrentParagraph
            key={index}
            paragraph={index}
            rowIndex={rowIndex}
            scroller={scroller}
            reading={reading}
          >
            {renderRuby(paragraphs[index], ruby)}
          </CurrentParagraph>
        ) : (
          <Text key={index} style={index < position && dimmed}>
            {renderRuby(paragraphs[index], ruby)}
          </Text>
        ),
      )}
    </Text>
  );
}

function rowStyle(
  palette: ReaderPalette,
  marked: boolean,
  pressed: boolean,
): StyleProp<ViewStyle> {
  const dims = pressed && Platform.OS !== "android";
  return [
    styles.row,
    dims && { backgroundColor: `${palette.dimmed}33` },
    marked && { backgroundColor: palette.marker },
    dims && marked && styles.pressedMarked,
  ];
}

function ChapterRowView({
  row,
  paragraphs,
  look,
  playsOnDoubleTap,
  opensMenu,
  taps,
  reading,
  ...text
}: ChapterRowProps) {
  const position = useSyncExternalStore(reading.subscribe, () =>
    positionIn(row, reading.paragraphIndex()),
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.indices
        .map((index) => paragraphs[index].text)
        .join("")}
      accessibilityHint={
        playsOnDoubleTap
          ? "タップで読み上げ位置を移動、ダブルタップで再生"
          : "タップした段落から再生"
      }
      onPress={(event) => {
        taps.press(row, event.nativeEvent.locationY);
      }}
      onLongPress={
        opensMenu
          ? (event) => {
              taps.hold(row, event.nativeEvent.locationY);
            }
          : undefined
      }
      android_ripple={{ color: `${look.palette.dimmed}40` }}
      style={({ pressed }) =>
        rowStyle(look.palette, position !== elsewhere, pressed)
      }
    >
      <RowText
        row={row}
        paragraphs={paragraphs}
        position={position}
        look={look}
        reading={reading}
        {...text}
      />
    </Pressable>
  );
}

export const ChapterRow = memo(ChapterRowView);

const styles = StyleSheet.create({
  pressedMarked: { opacity: 0.55 },
  row: {
    minHeight: 44,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
});
