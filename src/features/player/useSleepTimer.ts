import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * 読み上げが自動で止まるとき: ある時刻（ms）、読んでいる章の終わり、
 * または止まらない。
 */
export type SleepTimer = number | "chapter" | null;

interface SleepTimerState {
  timer: SleepTimer;
  /** 読み上げが段落の合間に確かめるタイマー。 */
  timerRef: RefObject<SleepTimer>;
  setSleepTimer: (value: SleepTimer) => void;
}

/**
 * スリープタイマー。読み上げ中は、読み上げの側が段落の終わりでそれに
 * 従う（`useReadAloud`）。何も読んでいない間に切れたタイマーは、ここで
 * 単に解除する。
 */
export function useSleepTimer(playing: boolean): SleepTimerState {
  const [timer, setTimer] = useState<SleepTimer>(null);
  const timerRef = useRef<SleepTimer>(null);
  const setSleepTimer = useCallback((value: SleepTimer) => {
    timerRef.current = value;
    setTimer(value);
  }, []);

  useEffect(() => {
    if (playing || typeof timer !== "number") {
      return;
    }
    const expiry = setTimeout(
      () => {
        setSleepTimer(null);
      },
      Math.max(0, timer - Date.now()),
    );
    return () => {
      clearTimeout(expiry);
    };
  }, [playing, timer, setSleepTimer]);

  return { timer, timerRef, setSleepTimer };
}
