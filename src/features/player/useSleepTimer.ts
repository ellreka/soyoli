import { useState } from "react";

import { createStore, useStore } from "@/lib/store";
import { useSubscription, type Subscription } from "@/lib/subscription";

export type SleepTimer = number | "chapter" | null;

interface SleepTimerState {
  timer: SleepTimer;
  setSleepTimer: (value: SleepTimer) => void;
  timerNow: () => SleepTimer;
}

interface Sleep {
  timer: SleepTimer;
  expire: Subscription | null;
}

const noTimer: Sleep = { timer: null, expire: null };

export function useSleepTimer(playing: boolean): SleepTimerState {
  const [sleep, setSleep, store] = useStore(() => createStore(noTimer));
  const [setSleepTimer] = useState(() => {
    function clearAt(deadline: number): Subscription {
      return () => {
        const expiry = setTimeout(
          () => {
            setSleep((current) =>
              current.timer === deadline ? noTimer : current,
            );
          },
          Math.max(0, deadline - Date.now()),
        );
        return () => {
          clearTimeout(expiry);
        };
      };
    }
    return (value: SleepTimer): void => {
      setSleep(() => ({
        timer: value,
        expire: typeof value === "number" ? clearAt(value) : null,
      }));
    };
  });
  useSubscription(playing ? null : sleep.expire);

  return {
    timer: sleep.timer,
    setSleepTimer,
    timerNow: () => store.get().timer,
  };
}
