import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  ActivityIndicator,
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

import type { Chapter } from "@/features/books/book";
import { parseChapter, type Block } from "@/features/books/paragraphs";
import { themes, type ReaderPalette } from "./Display";
import { Illustration } from "./Illustration";
import { renderRuby, renderedLength, type RubyLook } from "./ruby";

type Row =
  | { kind: "text"; indices: number[]; heading?: true }
  | Extract<Block, { kind: "image" }>;

/** RN Web は実行時に onWheel/onKeyDown を足す。react-native の FlatListProps にはない。 */
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

/**
 * 最初の行がタップ位置（またはそのすぐ上）にある段落。入れ子の
 * `<Text onPress>` は Android でタップ領域が壊れるので、行をボタンにして、
 * タップ位置から段落を選ぶ。1 行に段落が 2 つ以上入るのは、とても長い
 * 段落をいくつかに切ったところだけ。
 * 精度は行単位 — 同じ行から始まる 2 つの断片は区別しない。
 * 必要になったら、押せる span を使うこと。
 */
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
  /** 行の高さ。フォントサイズに対する倍率。 */
  lineHeight?: number;
  palette?: ReaderPalette;
  onManualScroll: () => void;
  /** 本文へのタップ: その位置にある段落。 */
  onSelect: (paragraphIndex: number) => void;
  /** 最初のタップの直後の、同じ段落への 2 回目のタップ。扱う場合に渡す。 */
  onPlay?: (paragraphIndex: number) => void;
  /** 本文の長押し: アクションを出す対象の段落。 */
  onMenu?: (paragraphIndex: number) => void;
}

/**
 * 本文が読む位置までスライドするのにかける時間: どこへ動いたか見える
 * くらい長く、待たされないくらい短い。
 */
const slideMs = 150;

type CellProps = ViewProps & { index: number };

/** ダブルタップの 2 回のタップの間隔の上限。 */
const doubleTapMs = 300;

/** 章の本文: 読んだ行は薄く、今の行はハイライトする。 */
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
  // 最後の 1 回のタップ。ダブルタップの 2 回目を見分けるために持っておく。
  const lastTap = useRef<{ time: number; row: number; paragraph: number }>(
    null,
  );
  const window = useWindowDimensions();
  const list = useRef<FlatList<Row>>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retries = useRef(0);
  const currentText = useRef<ComponentRef<typeof Text>>(null);
  // スクロールする内容の中で各行が始まる位置と、リストの今のスクロール位置:
  // 読む位置へのスライドの出発点と行き先。
  const rowTops = useRef(new Map<number, number>());
  const offset = useRef(0);
  const slide = useRef<number | undefined>(undefined);
  const paragraphTops = useRef(new Map<number, number>());
  const viewportHeight = useRef(0);
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
  // 見出し — Web の話ではタイトルが本文の先頭に来る — は、太さと大きさ
  // だけで目立たせる。そのため、読者のフォントサイズとテーマに従う。
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
  // ルビは、それが載る本文の大きさと行の高さから配置する。
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

  // 章を移るとこのリストは再マウントされる。最初の位置へのスクロールも、
  // 行の計測が済んでから下の effect が行う。
  const target = useRef(autoScroll ? current : -1);
  // リストはまず先頭からレイアウトされ、読む位置へ動かすのは、その段落の
  // 計測が済んでから。それまでは見せないので、本文が先頭で表示されてから
  // 飛ぶことがない。章の先頭と Web（本文を自分で配置する）では、待つものが
  // ない。
  const [placed, setPlaced] = useState(
    () => Platform.OS === "web" || !autoScroll || current <= 0,
  );
  useEffect(() => {
    if (placed) {
      return;
    }
    // 計測が来なかった場合でも、少し経てば表示する。
    const fallback = setTimeout(() => {
      setPlaced(true);
    }, 500);
    return () => {
      clearTimeout(fallback);
    };
  }, [placed]);

  const scrollToParagraph = useCallback(
    (animated = false) => {
      // React Native Web は onTextLayout を知らせない。テキストの span を直接使う。
      if (Platform.OS === "web") {
        // SAFETY: Web では ref が描画された <span> 要素を持つので、そこでは
        // DOM の型が本物。ネイティブはこの分岐に入らない。
        const element = currentText.current as unknown as HTMLElement | null;
        if (element?.scrollIntoView) {
          element.scrollIntoView({ block: "nearest", behavior: "instant" });
          return;
        }
      }
      if (current < 0) {
        return;
      }
      cancelAnimationFrame(slide.current ?? 0);
      slide.current = undefined;
      const rowTop = rowTops.current.get(current);
      const paragraphTop = paragraphTops.current.get(paragraphIndex) ?? 0;
      if (animated && rowTop !== undefined) {
        // プラットフォーム自身のアニメーション付きスクロールは時間がかかり、
        // 追いかけているタップや声に遅れる。長さも設定できない。そこで、
        // ここでフレームごとにリストを動かす。
        const from = offset.current;
        const to = Math.max(
          0,
          rowTop + paragraphTop - viewportHeight.current * 0.3,
        );
        const start = performance.now();
        const frame = () => {
          const progress = Math.min(1, (performance.now() - start) / slideMs);
          // イーズアウト: 出だしは速く、着くときはゆるやかに。
          const y = from + (to - from) * (1 - (1 - progress) ** 3);
          offset.current = y;
          list.current?.scrollToOffset({ offset: y, animated: false });
          slide.current =
            progress < 1 ? requestAnimationFrame(frame) : undefined;
        };
        slide.current = requestAnimationFrame(frame);
        return;
      }
      list.current?.scrollToIndex({
        index: current,
        viewPosition: 0,
        // 一度もレイアウトされていない（仮想化された）行の段落は、
        // 行の上端で代用する。必要なら、画面外でテキストを計測すること。
        viewOffset: viewportHeight.current * 0.3 - paragraphTop,
        animated: false,
      });
    },
    [current, paragraphIndex],
  );

  useEffect(() => {
    if (!autoScroll) {
      target.current = -1;
      return;
    }
    target.current = current;
    retries.current = 0;
    // 読む位置が動いたときは、本文をそこへスライドさせる。それ以外（最初の
    // 配置、遅れて届いた計測）は、すぐその位置に置く。
    scrollToParagraph(true);
    return () => {
      target.current = -1;
      clearTimeout(retry.current);
      cancelAnimationFrame(slide.current ?? 0);
    };
  }, [scrollToParagraph, current, autoScroll]);

  function stopAutoScroll() {
    target.current = -1;
    clearTimeout(retry.current);
    cancelAnimationFrame(slide.current ?? 0);
    onManualScroll();
  }

  // リスト自身のセル。行が始まる位置も記録する。
  const Cell = useCallback(
    ({ index, onLayout, ...props }: CellProps) => (
      <View
        {...props}
        onLayout={(event) => {
          rowTops.current.set(index, event.nativeEvent.layout.y);
          onLayout?.(event);
        }}
      />
    ),
    [],
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
        // 読む位置に置くまで本文は見せない。その間は読み込み中の印を出す。
        <ActivityIndicator
          color={palette.text}
          style={StyleSheet.absoluteFill}
        />
      )}
      <FlatList
        ref={list}
        testID="chapter-content"
        accessibilityLabel={chapter.title}
        data={rows}
        extraData={paragraphIndex}
        // すべての段落を描画し、計測する。仮想化したリストを途中から始める
        // （initialScrollIndex）と、上の行が見積もりのままになり、読む位置を
        // 追ったときに違う文章や空白に着いてしまう。
        // 章を丸ごと一度にマウントしている。とても長い章を開くのが
        // 遅ければ、計測した高さを使ってリストをウィンドウ化すること。
        initialNumToRender={rows.length}
        maxToRenderPerBatch={rows.length}
        windowSize={1000}
        onLayout={({ nativeEvent }) => {
          viewportHeight.current = nativeEvent.layout.height;
          if (autoScroll && target.current === current) {
            scrollToParagraph();
          }
        }}
        onScrollBeginDrag={stopAutoScroll}
        onScroll={({ nativeEvent }) => {
          offset.current = nativeEvent.contentOffset.y;
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
        // 最後の段落の下の余白。章の終わりまで読む位置を追っても、内容の先への
        // スクロールを求めないようにするため。
        ListFooterComponent=<View style={{ height: window.height * 0.6 }} />
        keyExtractor={(block, index) =>
          block.kind === "text" ? `p${block.indices[0]}` : `i${index}`
        }
        onScrollToIndexFailed={({ index }) => {
          if (!autoScroll || target.current !== index) {
            return;
          }
          clearTimeout(retry.current);
          retry.current = setTimeout(() => {
            retry.current = undefined;
            // 段落がまだ計測されていない: 少し後でやり直す。
            // 3 秒であきらめる。その先は手動のスクロールに任せる。
            if (target.current === index && retries.current < 30) {
              retries.current += 1;
              scrollToParagraph();
            }
          }, 100);
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
                  // 最初のタップがすでに段落を選んでいる。そこから始める。
                  lastTap.current = null;
                  onPlay(previous.paragraph);
                  return;
                }
                const paragraph = paragraphAt(
                  item.indices,
                  paragraphTops.current,
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
                      paragraphTops.current,
                      event.nativeEvent.locationY,
                    ),
                  );
                })
              }
              // 指が触れている間、段落に色を付ける。タップ・ダブルタップ・長押しが
              // どの段落に効くかが分かるようにするため。色はテーマの secondary の
              // 色をごく薄く重ねたもので、読み上げのマーカーとははっきり違う。
              // Android ではリップルとして出る。
              android_ripple={{ color: `${palette.dimmed}40` }}
              style={({ pressed }) => [
                styles.row,
                pressed &&
                  Platform.OS !== "android" && {
                    backgroundColor: `${palette.dimmed}33`,
                  },
                // 読み上げ中の段落は、文章がどれだけ短くても幅いっぱいに印が付く。
                item.indices.includes(paragraphIndex) && {
                  backgroundColor: palette.marker,
                },
                // 印の付いた段落は色を保ち、代わりに薄くなる: グレーを重ねても
                // マーカーの上では見えない。
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
                    target.current === current &&
                    item.indices.includes(paragraphIndex)
                  ) {
                    scrollToParagraph();
                  }
                }}
                onTextLayout={({ nativeEvent: { lines } }) => {
                  // 折り返した行を数えておく。長い行でも今の段落を追えるようにするため。
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
                    paragraphTops.current.set(
                      index,
                      (lines[lineIndex]?.y ?? 0) + 2,
                    );
                    paragraphStart += renderedLength(paragraphs[index]);
                  }
                  if (
                    autoScroll &&
                    target.current === current &&
                    item.indices.includes(paragraphIndex)
                  ) {
                    scrollToParagraph();
                  }
                  if (!placed && item.indices.includes(paragraphIndex)) {
                    // 上のスクロールが反映された後で。
                    requestAnimationFrame(() => {
                      setPlaced(true);
                    });
                  }
                }}
              >
                {item.indices.map((index) => (
                  <Text
                    key={index}
                    ref={index === paragraphIndex ? currentText : undefined}
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
