import { requireOptionalNativeModule } from "expo";
import { AppState } from "react-native";
import type { AudioPlayer } from "expo-audio";

const volume = 0.6;
const soundMs = 420;
const pauseMs = 250;

let player: AudioPlayer | null = null;
let quietUntil = 0;

export function pageTurnWait(): number {
  return Math.max(0, quietUntil - Date.now());
}

// WORKAROUND: Android はアプリが画面に出ていない間タイマーを止めるが、読み上げは続く。フォアグラウンドにいないときは、プレーヤーが音の終わりを知らせた時点で声を始める。
export function afterPageTurn(wait: number): Promise<void> {
  return new Promise((resolve) => {
    let over = false;
    let started = false;
    const hidden = () => AppState.currentState !== "active";
    function done(): void {
      clearTimeout(timer);
      status?.remove();
      visibility.remove();
      resolve();
    }
    const timer = setTimeout(done, wait);
    let status: { remove: () => void } | undefined;
    try {
      status = player?.addListener("playbackStatusUpdate", (update) => {
        started ||= update.playing;
        if (update.didJustFinish || (started && !update.playing)) {
          over = true;
          if (hidden()) {
            done();
          }
        }
      });
    } catch {
      ignore();
    }
    const visibility = AppState.addEventListener("change", () => {
      if (over && hidden()) {
        done();
      }
    });
  });
}

function ignore(): void {}

// WORKAROUND: この音を足す前に作ったビルドにはオーディオのモジュールがなく、そこへ配信したアップデートも動かなければならない。モジュールがあると分かってから読み込む。
export function playPageTurn(): void {
  try {
    if (!player) {
      if (!requireOptionalNativeModule("ExpoAudio")) {
        return;
      }
      // SAFETY: 型はパッケージのもの。モジュールがあると分かってから読み込むので、先頭では import しない。
      // oxlint-disable-next-line typescript/no-require-imports
      const audio = require("expo-audio") as typeof import("expo-audio");
      // WORKAROUND: 声と同じ種類のオーディオセッションにする。消音スイッチがオンでもバックグラウンドでも聞こえ、ほかのアプリと混ざらないので、ロック画面の操作も残る。
      audio
        .setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: "doNotMix",
        })
        .catch(ignore);
      player = audio.createAudioPlayer(
        require("../../../assets/sounds/page-turn.mp3"),
      );
      player.volume = volume;
    }
    player.seekTo(0).catch(ignore);
    player.play();
    quietUntil = Date.now() + soundMs + pauseMs;
  } catch {
    ignore();
  }
}
