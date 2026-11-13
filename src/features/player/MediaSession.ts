import { useEffect, useRef } from "react";
import { requireOptionalNativeModule } from "expo";
import type { Book } from "@/features/books/book";

/**
 * TTS の読み上げセッション用の、ロック画面・通知の操作（音楽アプリ風の
 * 「再生中」）。expo-media-control を使う。
 *
 * ネイティブモジュールは development build にしかない: Expo Go では
 * パッケージの import が投げるので、どの入口も動的な import() を通し、
 * その reject を受け止める。通すかどうかは実行環境で決める。
 */
type NativeMediaControl = {
  enableMediaControls: (options?: Record<string, unknown>) => Promise<void>;
  disableMediaControls: () => Promise<void>;
  updateMetadata: (metadata: Record<string, unknown>) => Promise<void>;
  updatePlaybackState: (state: number) => Promise<void>;
  addListener: (listener: (event: { command: string }) => void) => () => void;
};

export const MediaPlaybackState = {
  PLAYING: 2,
  PAUSED: 3,
} as const;

let native: NativeMediaControl | null = null;
let loadPromise: Promise<NativeMediaControl | null> | null = null;
/** プロバイダーがマウントされている間、フックが入れる。リモートのコマンドを受け取る。 */
let commandSink: ((command: string) => void) | null = null;

async function loadNative(): Promise<NativeMediaControl | null> {
  if (native) {
    return native;
  }
  // ネイティブモジュールがない（Expo Go）ときは、投げずに null を返す。
  // モジュールがない限り、JS のラッパーには一切触れない。
  if (!requireOptionalNativeModule?.("ExpoMediaControl")) {
    return null;
  }
  try {
    loadPromise ??= import("expo-media-control")
      .then((mod) => {
        native = mod.MediaControl;
        return native;
      })
      .catch(() => {
        native = null;
        return null;
      });
  } catch {
    // Metro はリロード時にチャンクを同期的に実行し直すことがある。モジュール
    // スコープの requireNativeModule は、そこで promise チェーンの外で投げる。
    loadPromise = Promise.resolve(null);
  }
  return await loadPromise;
}

export interface MediaSessionInput {
  book: Book | null;
  playing: boolean;
  /** 読者がいる章。通知のタイトルになる。 */
  chapterTitle?: string;
  /** システムの操作部品が発火させる、利用者の操作と同等のアクション。 */
  toggle: () => void;
  stepChapter: (direction: -1 | 1) => void;
  stop: () => void;
}

export function useMediaSession(input: MediaSessionInput): void {
  const { book, playing, chapterTitle, toggle, stepChapter, stop } = input;
  // リスナーは一度だけ登録する。登録し直さずにアクションへ届くようにしておく。
  const actions = useRef({ toggle, stepChapter, stop, playing });
  useEffect(() => {
    actions.current = { toggle, stepChapter, stop, playing };
  }, [toggle, stepChapter, stop, playing]);

  // commandSink を通して、一度だけ登録したネイティブのリスナーがアクションに届く。
  useEffect(() => {
    commandSink = (command) => {
      const current = actions.current;
      if (command === "play") {
        if (!current.playing) {
          current.toggle();
        }
      } else if (command === "pause") {
        if (current.playing) {
          current.toggle();
        }
      } else if (command === "stop") {
        current.stop();
      } else if (command === "nextTrack") {
        current.stepChapter(1);
      } else if (command === "previousTrack") {
        current.stepChapter(-1);
      }
    };
    return () => {
      commandSink = null;
    };
  }, []);

  useEffect(() => {
    const state = { disposed: false };
    loadNative()
      .then((controls) => {
        if (state.disposed || !controls) {
          return;
        }
        return controls
          .enableMediaControls({
            capabilities: [
              "play",
              "pause",
              "stop",
              "nextTrack",
              "previousTrack",
            ],
            compactCapabilities: ["previousTrack", "play", "nextTrack"],
          })
          .then(() => {
            if (state.disposed) {
              return;
            }
            controls.addListener((event) => {
              commandSink?.(event.command);
            });
            // 操作部品が有効になった時点の状態を反映する。
            return controls.updatePlaybackState(
              actions.current.playing
                ? MediaPlaybackState.PLAYING
                : MediaPlaybackState.PAUSED,
            );
          });
      })
      .catch(() => undefined);
    return () => {
      state.disposed = true;
      loadNative()
        .then((controls) => {
          if (!state.disposed || !controls) {
            return;
          }
          return controls.disableMediaControls();
        })
        .catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!book) {
      return;
    }
    // 長さの決まったトラックではない: 通知のシークバーを隠す。
    loadNative()
      .then((controls) =>
        controls?.updateMetadata({
          title: chapterTitle ?? book.title,
          artist: book.author,
          album: book.title,
          artwork: book.cover ? { uri: book.cover } : undefined,
          isLiveStream: true,
        }),
      )
      .catch(() => undefined);
  }, [book, chapterTitle]);

  useEffect(() => {
    if (!book) {
      return;
    }
    loadNative()
      .then((controls) =>
        controls?.updatePlaybackState(
          playing ? MediaPlaybackState.PLAYING : MediaPlaybackState.PAUSED,
        ),
      )
      .catch(() => undefined);
  }, [book, playing]);
}
