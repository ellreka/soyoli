import { requireOptionalNativeModule } from "expo";
import type { Book } from "@/features/books/book";
import type { Subscription } from "@/lib/subscription";

// WORKAROUND: ネイティブモジュールは development build にしかなく、Expo Go ではパッケージの import が投げる。どの入口も動的な import() を通す。
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

async function loadNative(): Promise<NativeMediaControl | null> {
  if (native) {
    return native;
  }
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
    // WORKAROUND: Metro はリロード時にチャンクを同期的に実行し直すことがあり、モジュールスコープの requireNativeModule が promise チェーンの外で投げる。
    loadPromise = Promise.resolve(null);
  }
  return await loadPromise;
}

export interface MediaCommands {
  toggle: () => void;
  stepChapter: (direction: -1 | 1) => void;
  stop: () => void;
  isPlaying: () => boolean;
}

function nativeUnavailable(): void {}

function nativeState(playing: boolean): number {
  return playing ? MediaPlaybackState.PLAYING : MediaPlaybackState.PAUSED;
}

function runCommand(commands: MediaCommands, command: string): void {
  const playing = commands.isPlaying();
  if (command === "play") {
    if (!playing) {
      commands.toggle();
    }
  } else if (command === "pause") {
    if (playing) {
      commands.toggle();
    }
  } else if (command === "stop") {
    commands.stop();
  } else if (command === "nextTrack") {
    commands.stepChapter(1);
  } else if (command === "previousTrack") {
    commands.stepChapter(-1);
  }
}

export function mediaControls(commands: MediaCommands): Subscription {
  return () => {
    const session: { disposed: boolean; unsubscribe?: () => void } = {
      disposed: false,
    };
    loadNative()
      .then((controls) => {
        if (session.disposed || !controls) {
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
            if (session.disposed) {
              return;
            }
            session.unsubscribe = controls.addListener((event) => {
              runCommand(commands, event.command);
            });
            return controls.updatePlaybackState(
              nativeState(commands.isPlaying()),
            );
          });
      })
      .catch(nativeUnavailable);
    return () => {
      session.disposed = true;
      session.unsubscribe?.();
      loadNative()
        .then((controls) => controls?.disableMediaControls())
        .catch(nativeUnavailable);
    };
  };
}

export function showNowPlaying(book: Book, chapterTitle?: string): void {
  // WORKAROUND: 長さの決まったトラックではないので、ライブストリームとして渡して通知のシークバーを隠す。
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
    .catch(nativeUnavailable);
}

export function showPlaying(playing: boolean): void {
  loadNative()
    .then((controls) => controls?.updatePlaybackState(nativeState(playing)))
    .catch(nativeUnavailable);
}
