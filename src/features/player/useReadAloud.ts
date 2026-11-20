import { useState, type SetStateAction } from "react";
import * as Speech from "expo-speech";

import { awaitsText } from "@/features/books/book";
import type { Dictionary } from "@/features/dictionary/entries";
import { isBracketId } from "@/features/speech/brackets";
import type { Segment } from "@/features/speech/segments";
import { moveToSpoken, spokenAt } from "@/features/speech/spoken";
import {
  unsubscribeNothing,
  useSubscription,
  type Subscription,
} from "@/lib/subscription";
import { afterPageTurn, pageTurnWait, playPageTurn } from "./pageSound";
import type { PlaybackState } from "./playbackState";
import type { PlaybackSettings } from "./settings";
import type { Generation } from "./useGeneration";
import type { Preview } from "./usePreview";
import type { SleepTimer } from "./useSleepTimer";

const sample: Segment[] = [{ speech: "こんにちは。これは音声の試聴です。" }];

export interface LatestReading {
  rules: () => Dictionary;
  timer: () => SleepTimer;
  autoNext: () => boolean;
  pageSound: () => boolean;
}

interface ReadAloud {
  state: PlaybackState;
  settings: PlaybackSettings;
  preview: Preview | null;
  generation: Generation;
  latest: LatestReading;
  change: (update: SetStateAction<PlaybackState>) => void;
  setSleepTimer: (value: SleepTimer) => void;
  stopPreview: () => void;
  setError: (message: string) => void;
  setPreviewError: (message: string) => void;
}

function providerMayBeGone(): void {}

function readAloud({
  state,
  settings,
  preview,
  generation,
  latest,
  change,
  setSleepTimer,
  stopPreview,
  setError,
  setPreviewError,
}: ReadAloud): Subscription {
  const { rate, pitch, voice, brackets } = settings;
  function start(): (() => void) | undefined {
    if (!preview && (!state.book || !state.playing)) {
      return;
    }
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
    function advance() {
      const next = moveToSpoken(
        { rules: latest.rules(), brackets },
        state.book,
        state.chapters,
        state,
        1,
      );
      const sleep = latest.timer();
      const timerReached =
        (typeof sleep === "number" && Date.now() >= sleep) ||
        (sleep === "chapter" &&
          (!next || next.chapterIndex !== state.chapterIndex));
      if (timerReached || !next) {
        setSleepTimer(null);
      }
      const turns = Boolean(next) && next?.chapterIndex !== state.chapterIndex;
      const chapterEnd = turns && !latest.autoNext();
      if (turns && !chapterEnd && !timerReached && latest.pageSound()) {
        playPageTurn();
      }
      change({
        ...state,
        ...next,
        playing: Boolean(next) && !timerReached && !chapterEnd,
      });
    }
    async function speak() {
      await Speech.stop();
      // WORKAROUND: Android のバックグラウンドではタイマーが止まるが、読み上げは続く。ページめくりの音の終わりはタイマーだけで待たない（afterPageTurn）。
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
            { rules: latest.rules(), brackets },
            state.book,
            state.chapters,
            state,
          ) ?? []);
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
      const sleep = latest.timer();
      if (!preview && typeof sleep === "number" && Date.now() >= sleep) {
        setSleepTimer(null);
        change((current) => ({ ...current, playing: false }));
        return;
      }
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
      Speech.stop().catch(providerMayBeGone);
    };
  }
  return () => start() ?? unsubscribeNothing;
}

function readingInputs({ state, settings, preview }: ReadAloud): unknown[] {
  const { rate, pitch, voice, brackets } = settings;
  return [state, rate, pitch, voice, brackets, preview];
}

function sameInputs(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function useReadAloud(reading: ReadAloud): void {
  const inputs = readingInputs(reading);
  const [current, setCurrent] = useState(() => ({
    inputs,
    subscribe: readAloud(reading),
  }));
  if (!sameInputs(current.inputs, inputs)) {
    setCurrent({ inputs, subscribe: readAloud(reading) });
  }
  useSubscription(current.subscribe);
}
