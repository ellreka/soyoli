import { useEffect, type RefObject, type SetStateAction } from "react";
import * as Speech from "expo-speech";

import { awaitsText } from "@/features/books/book";
import type { Dictionary } from "@/features/dictionary/entries";
import { isBracketId } from "@/features/speech/brackets";
import type { Segment } from "@/features/speech/segments";
import { moveToSpoken, spokenAt } from "@/features/speech/spoken";
import { afterPageTurn, pageTurnWait } from "./pageSound";
import type { PlaybackState } from "./playbackState";
import type { PlaybackSettings } from "./settings";
import type { Generation } from "./useGeneration";
import type { Preview } from "./usePreview";
import type { SleepTimer } from "./useSleepTimer";

const sample: Segment[] = [{ speech: "こんにちは。これは音声の試聴です。" }];

interface ReadAloud {
  state: PlaybackState;
  settings: PlaybackSettings;
  /** 本文の代わりに試聴している声。 */
  preview: Preview | null;
  /** 話す内容と、それに応答するもの: `useGeneration` を参照。 */
  generation: Generation;
  /** 段落が始まるときに読む: 新しいルールは次の段落から効く。 */
  dictionary: RefObject<Dictionary>;
  timer: RefObject<SleepTimer>;
  /** 読み上げが別の章へ進んだときに呼ばれる（`usePageTurn`）。 */
  onChapterTurn: () => void;
  change: (update: SetStateAction<PlaybackState>) => void;
  setSleepTimer: (value: SleepTimer) => void;
  stopPreview: () => void;
  setError: (message: string) => void;
  setPreviewError: (message: string) => void;
}

/**
 * 話す: `playing` の間、読む位置にある段落を、次にその次を、と本の終わりか
 * スリープタイマーまで続ける — または、試聴している声のサンプルを話す。
 * 発話は一度に 1 つ。話す内容を変えるものがあれば、止めて最初からやり直す。
 *
 * バックグラウンドでの動作は意図したもの: 画面がロックされても、アプリが
 * フォアグラウンドを離れても、読み上げは続く（iOS では UIBackgroundModes
 * audio が要り、app.json で宣言している）。それがこのアプリの目的なので、
 * ここでは AppState の変化で一時停止するものはない。
 */
export function useReadAloud({
  state,
  settings,
  preview,
  generation,
  dictionary,
  timer,
  onChapterTurn,
  change,
  setSleepTimer,
  stopPreview,
  setError,
  setPreviewError,
}: ReadAloud): void {
  const { rate, pitch, voice, brackets } = settings;

  useEffect(() => {
    if (!preview && (!state.book || !state.playing)) {
      return;
    }
    // まだ読み込み中の話に来た: 「再生中」のまま待ち、本文が届いたら始める
    // （取得に失敗したらローダーが一時停止する）。
    if (!preview && awaitsText(state.book?.chapters[state.chapterIndex])) {
      return;
    }
    const token = generation.begin();
    const live = () => generation.isCurrent(token);
    function fail() {
      if (!live()) {
        return;
      }
      if (preview) {
        setPreviewError(
          "試聴できませんでした。音声を選び直して再試行してください。",
        );
        stopPreview();
        return;
      }
      setError(
        "読み上げに失敗しました。端末の音声設定を確認し、再生を押してください。",
      );
      change((current) => ({ ...current, playing: false }));
    }
    /** 次の段落へ進む。終わりかタイマーなら止まる。 */
    function advance() {
      const next = moveToSpoken(
        { rules: dictionary.current, brackets },
        state.book,
        state.chapters,
        state,
        1,
      );
      const sleep = timer.current;
      const timerReached =
        (typeof sleep === "number" && Date.now() >= sleep) ||
        (sleep === "chapter" &&
          (!next || next.chapterIndex !== state.chapterIndex));
      if (timerReached || !next) {
        setSleepTimer(null);
      }
      if (next && next.chapterIndex !== state.chapterIndex) {
        onChapterTurn();
      }
      change({
        ...state,
        ...next,
        playing: Boolean(next) && !timerReached,
      });
    }
    async function speak() {
      await Speech.stop();
      // 声は、ページめくりの音が終わるまで待つ。2 つが重なって鳴らないように。
      // ただのタイマーではない: タイマーは Android のバックグラウンドで止まり、
      // 読み上げはそこでも続く。
      const wait = pageTurnWait();
      if (wait > 0) {
        await afterPageTurn(wait);
      }
      if (!live()) {
        return;
      }
      const paragraph =
        state.chapters[state.chapterIndex]?.[state.paragraphIndex];
      const parts: Segment[] = preview
        ? sample
        : (spokenAt(
            { rules: dictionary.current, brackets },
            state.book,
            state.chapters,
            state,
          ) ?? []);
      // ルールによって読むものがなくなった段落（◆◇◆ の区切り線）は飛ばす。
      if (paragraph && parts.length === 0) {
        advance();
        return;
      }
      if (
        !parts.length ||
        parts.some((part) => part.speech.length > Speech.maxSpeechInputLength)
      ) {
        fail();
        return;
      }
      if (
        !preview &&
        typeof timer.current === "number" &&
        Date.now() >= timer.current
      ) {
        setSleepTimer(null);
        change((current) => ({ ...current, playing: false }));
        return;
      }
      /** 段落の 1 区間を、その声で読み、次の区間へ進む。 */
      function say(index: number) {
        const part = parts[index];
        const own = isBracketId(part.bracket)
          ? brackets[part.bracket]
          : undefined;
        Speech.speak(part.speech, {
          language: "ja-JP",
          rate,
          pitch: preview ? (preview.pitch ?? pitch) : (own?.pitch ?? pitch),
          voice: preview ? preview.voice : own ? own.voice : voice,
          onError: fail,
          onStopped: () => {
            if (live()) {
              if (preview) {
                stopPreview();
              } else {
                change((current) => ({ ...current, playing: false }));
              }
            }
          },
          onDone: () => {
            if (!live()) {
              return;
            }
            if (preview) {
              stopPreview();
            } else if (index + 1 < parts.length) {
              say(index + 1);
            } else {
              advance();
            }
          },
        });
      }
      say(0);
    }
    speak().catch(fail);
    return () => {
      if (live()) {
        generation.begin();
      }
      Speech.stop().catch(() => {
        /* プロバイダーは、もうアンマウントされているかもしれない。 */
      });
    };
  }, [
    state,
    rate,
    pitch,
    voice,
    brackets,
    preview,
    generation,
    dictionary,
    timer,
    onChapterTurn,
    change,
    setSleepTimer,
    stopPreview,
    setError,
    setPreviewError,
  ]);
}
