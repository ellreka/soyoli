import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import { useSubscription } from "@/lib/subscription";

const keepAwakeTag = "reading-aloud";

function screenTurnsOffAsUsual(): void {}

function keepScreenOn(): () => void {
  activateKeepAwakeAsync(keepAwakeTag).catch(screenTurnsOffAsUsual);
  return () => {
    deactivateKeepAwake(keepAwakeTag).catch(screenTurnsOffAsUsual);
  };
}

export function useKeepAwake(awake: boolean): void {
  useSubscription(awake ? keepScreenOn : null);
}
