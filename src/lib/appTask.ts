import { router } from "expo-router";
import { BackHandler } from "react-native";

import AppTask from "../../modules/app-task/src/AppTaskModule";
import { unsubscribeNothing, useSubscription } from "./subscription";

function stayInFront(): void {}

function moveToBackOnLastBack(): () => void {
  if (!AppTask) {
    return unsubscribeNothing;
  }
  const native = AppTask;
  const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
    if (router.canGoBack()) {
      return false;
    }
    native.moveToBack().catch(stayInFront);
    return true;
  });
  return () => {
    subscription.remove();
  };
}

// WORKAROUND: ハンドラは後から登録したものが先に呼ばれるが、画面のレイアウトはナビゲーションより後に組まれることがある。登録の順に頼らず、戻る先がある間は受け取らない。
export function useBackToBackground(): void {
  useSubscription(moveToBackOnLastBack);
}
