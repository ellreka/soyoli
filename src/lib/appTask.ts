import { router } from "expo-router";
import { useEffect } from "react";
import { BackHandler } from "react-native";

import AppTask from "../../modules/app-task/src/AppTaskModule";

/**
 * Android: 戻る先がもうないところでの「戻る」は、アプリを閉じずに裏へ回す。
 * 閉じると画面が壊され、読み上げが止まる。ホームボタンと同じ扱いにして、
 * 読み上げを続ける。
 *
 * アプリの一番外側で一度だけ呼ぶこと。ハンドラは後から登録したものが先に
 * 呼ばれるが、登録の順には頼らない: ナビゲーションより後に登録されると
 * （画面のレイアウトは、ナビゲーションの入れ物より後に組まれることがある）、
 * ここが先に呼ばれて、設定のページやタブの履歴を戻る「戻る」まで取って
 * しまう。戻る先がある間は受け取らず、ナビゲーションに任せる。
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
        if (router.canGoBack()) {
          return false;
        }
        native.moveToBack().catch(() => undefined);
        return true;
      },
    );
    return () => {
      subscription.remove();
    };
  }, []);
}
