import { useEffect } from "react";
import { BackHandler } from "react-native";

import AppTask from "../../modules/app-task/src/AppTaskModule";

/**
 * Android: 戻る先がもうないところでの「戻る」は、アプリを閉じずに裏へ回す。
 * 閉じると画面が壊され、読み上げが止まる。ホームボタンと同じ扱いにして、
 * 読み上げを続ける。
 *
 * アプリの一番外側で一度だけ呼ぶこと。ハンドラは後から登録したものが先に
 * 呼ばれる: ここは最初に登録するので、画面を戻るもの（ナビゲーション、
 * ビューアー、ブラウザ）が誰も受け取らなかったときにだけ届く。
 */
export function useBackToBackground(): void {
  useEffect(() => {
    // ネイティブ側がない（iOS、Web、古いビルド）ときは、何も変えない。
    if (!AppTask) {
      return undefined;
    }
    const native = AppTask;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        native.moveToBack().catch(() => undefined);
        return true;
      },
    );
    return () => {
      subscription.remove();
    };
  }, []);
}
