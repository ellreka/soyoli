import { useEffect, useRef, useState } from "react";
import { NativeButton } from "@/components/NativeButton";
import {
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";

import type { IconName } from "@/components/Icon";
import { colors, gutter } from "@/constants/theme";
import { usePlayback } from "./Playback";
import type { SleepTimer } from "./useSleepTimer";
import { chapterProgress, positionAt } from "@/features/books/paragraphs";
import { episodePosition } from "@/features/web/episode";
import { Transport } from "./Transport";

const thumb = 14;

function count(value: number): string {
  return value.toLocaleString("ja-JP");
}

/** 現在時刻。`ticking` の間、最新に保つ。 */
function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) {
      return;
    }
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [ticking]);
  return now;
}

/** スリープタイマーの残り時間を短いラベルにしたもの。オフなら null。 */
function timerLabel(timer: SleepTimer, now: number) {
  if (timer === null) {
    return null;
  }
  if (timer === "chapter") {
    return "話末";
  }
  return `${Math.max(1, Math.ceil((timer - now) / 60_000))}分`;
}

interface ScrubberProps {
  read: number;
  total: number;
  /** シークバーが読む位置を動かした。 */
  onSeek?: () => void;
}

/** 章のシークバー: タップかドラッグで動かし、離すと再生がその段落へ飛ぶ。 */
function Scrubber({ read, total, onSeek }: ScrubberProps) {
  const playback = usePlayback();
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const origin = useRef(0);
  const ratio = drag ?? (total ? read / total : 0);

  function at(event: GestureResponderEvent): number {
    return width
      ? Math.min(
          1,
          Math.max(0, (event.nativeEvent.pageX - origin.current) / width),
        )
      : 0;
  }

  return (
    <View
      testID="playback-position"
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="読み上げ位置"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={({ nativeEvent }) => {
        playback.step(nativeEvent.actionName === "increment" ? 1 : -1);
      }}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
      onStartShouldSetResponder={() => total > 0 && width > 0}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => {
        origin.current = event.nativeEvent.pageX - event.nativeEvent.locationX;
        setDrag(at(event));
      }}
      onResponderMove={(event) => {
        setDrag(at(event));
      }}
      onResponderRelease={(event) => {
        const paragraphs =
          playback.state.chapters[playback.state.chapterIndex] ?? [];
        const target = positionAt([paragraphs], at(event) * total);
        setDrag(null);
        if (target) {
          playback.seekParagraph(target.paragraphIndex);
          onSeek?.();
        }
      }}
      onResponderTerminate={() => {
        setDrag(null);
      }}
      style={styles.scrubber}
    >
      <View pointerEvents="none" style={styles.track}>
        <View style={[styles.played, { width: ratio * width }]} />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: Math.min(
              Math.max(0, ratio * width - thumb / 2),
              width - thumb,
            ),
          },
        ]}
      />
    </View>
  );
}

interface PillProps {
  icon: IconName;
  label: string;
  hint: string;
  /** アイコンの横の文字。なければ、アイコンだけを薄く出す。 */
  value: string | null;
  onPress: () => void;
}

function Pill({ icon, label, hint, value, onPress }: PillProps) {
  return (
    <NativeButton
      icon={icon}
      label={value ?? ""}
      accessibilityLabel={label}
      accessibilityHint={hint}
      variant="outlined"
      onPress={onPress}
    />
  );
}

interface TimerPillProps {
  timer: SleepTimer;
  onPress: () => void;
}

/**
 * スリープタイマーのボタン。残り時間を表示する。カウントダウンする時計は
 * ボタン自身のものなので、毎秒描き直されるのはこのボタンだけ。key は
 * タイマーにすること: 設定し直すと、今から数え始める。
 */
function TimerPill({ timer, onPress }: TimerPillProps) {
  const now = useNow(typeof timer === "number");
  const remaining = timerLabel(timer, now);
  return (
    <Pill
      icon="timer"
      label="タイマー"
      hint={remaining ? `残り ${remaining}` : "オフ"}
      value={remaining}
      onPress={onPress}
    />
  );
}

interface PlayerProps {
  /** ビューアーのシートの 1 つを開く: ドックにあるのはボタンだけ。 */
  onOpen: (sheet: "timer" | "audio") => void;
  /** シークバーが読む位置を動かした: 本文はそこを見せる。 */
  onSeek?: () => void;
}

/** 章の本文の下に固定した操作ドック（「リーダービュー」）。 */
export function Player({ onOpen, onSeek }: PlayerProps) {
  const { state, settings, error, timer } = usePlayback();
  const paragraphs = state.chapters[state.chapterIndex] ?? [];
  const { read, total } = chapterProgress(paragraphs, state.paragraphIndex);
  if (!state.book) {
    return null;
  }
  const episode = episodePosition(state.book, state.chapterIndex);

  return (
    <View testID="viewer-player" style={styles.dock}>
      <Scrubber read={read} total={total} onSeek={onSeek} />
      {/* 左は話の中の位置（上のシークバーと同じ）、右は作品の中の位置。 */}
      <View style={styles.counts}>
        <Text style={styles.count}>
          {`${count(read)} / ${count(total)} 字`}
        </Text>
        {episode && (
          <Text style={styles.count}>
            {episode.total
              ? `${count(episode.number)} / ${count(episode.total)} 話`
              : `${count(episode.number)} 話`}
          </Text>
        )}
      </View>
      <View style={styles.bar}>
        <View style={styles.side}>
          <TimerPill
            key={String(timer)}
            timer={timer}
            onPress={() => {
              onOpen("timer");
            }}
          />
        </View>
        <Transport />
        <View style={[styles.side, styles.end]}>
          <Pill
            icon="audio-lines"
            label="音声設定"
            hint={`再生速度 ${settings.rate}倍`}
            value={`${settings.rate}×`}
            onPress={() => {
              onOpen("audio");
            }}
          />
        </View>
      </View>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: gutter,
    paddingBottom: 4,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  scrubber: { height: 24, justifyContent: "center" },
  track: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: colors.border,
  },
  played: { height: 3, backgroundColor: colors.text },
  thumb: {
    position: "absolute",
    top: 5,
    width: thumb,
    height: thumb,
    borderRadius: thumb / 2,
    backgroundColor: colors.text,
  },
  counts: { flexDirection: "row", justifyContent: "space-between" },
  count: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 11,
  },
  bar: { flexDirection: "row", alignItems: "center", paddingTop: 4 },
  side: { flex: 1, alignItems: "flex-start" },
  end: { alignItems: "flex-end" },
  error: {
    paddingVertical: 4,
    color: colors.text,
    fontWeight: "400",
    fontSize: 13,
    lineHeight: 20,
  },
});
