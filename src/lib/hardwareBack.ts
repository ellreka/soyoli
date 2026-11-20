import { BackHandler } from "react-native";

import type { Subscription } from "./subscription";

export function onHardwareBack(handle: () => boolean): Subscription {
  return () => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      handle,
    );
    return () => {
      subscription.remove();
    };
  };
}
