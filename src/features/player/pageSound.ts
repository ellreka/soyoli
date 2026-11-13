import { requireOptionalNativeModule } from "expo";
import { AppState } from "react-native";
import type { AudioPlayer } from "expo-audio";

/** 声ほど大きくしない: めくりの合図であって、驚かせるものではない。 */
const volume = 0.6;
/** 音の長さと、その後に声が始まるまでに置く間。 */
const soundMs = 420;
const pauseMs = 250;

let player: AudioPlayer | null = null;
/** 最後のめくりの後、声がまた始まってよい時刻。 */
let quietUntil = 0;

/** 最後のページめくりのために、声があとどれだけ待つべきか（ms）。 */
export function pageTurnWait(): number {
  return Math.max(0, quietUntil - Date.now());
}

/**
 * ページめくりの後、声が始まってよくなったら resolve する: 今から `wait` ms 後。
 *
 * タイマーだけでは足りない。Android はアプリが画面に出ていない間タイマーを
 * 止め、読み上げはそこでも続く: めくりの音は鳴るのに、声は発火しない
 * タイマーを待ち続けてしまう。そこでフォアグラウンドにいないときは、
 * プレーヤーが音の終わりを知らせた時点 — プラットフォームからのイベントで、
 * そこにも届く — で待ちを終え、音の後の短い間はあきらめる。
 */
export function afterPageTurn(wait: number): Promise<void> {
  return new Promise((resolve) => {
    /** 音を最後まで聞き終えた。 */
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
    // 間を置いている途中でフォアグラウンドを離れた: もうタイマーは発火しないかもしれない。
    const visibility = AppState.addEventListener("change", () => {
      if (over && hidden()) {
        done();
      }
    });
  });
}

function ignore(): void {
  /* 音はおまけ: なくても読み上げは続く。 */
}

/**
 * ページをめくる音を鳴らす。プレーヤーは最初に使うときに作って保持する。
 * 音が鳴っている最中のめくりは、音を最初からやり直す。
 *
 * この音を足す前に作ったビルドにはオーディオのモジュールがなく、そこへ
 * 配信したアップデートも動かなければならない: パッケージは、モジュールが
 * あると分かってから読み込み、なければ何も鳴らない。
 */
export function playPageTurn(): void {
  try {
    if (!player) {
      if (!requireOptionalNativeModule("ExpoAudio")) {
        return;
      }
      // SAFETY: 上の理由で、先頭で import せずにここで読み込む。型は
      // パッケージのもの。
      // oxlint-disable-next-line typescript/no-require-imports
      const audio = require("expo-audio") as typeof import("expo-audio");
      // 声と同じ種類のセッション: 消音スイッチがオンでも、バックグラウンドでも
      // 聞こえ、— ほかのアプリと混ざらないので — ロック画面の操作もそのまま
      // 付いてくる。
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
