import type { Store } from "@/lib/store";

type Subscribe = (listener: () => void) => () => void;

export interface Reading {
  paragraphIndex: () => number;
  follows: () => boolean;
  stopFollowing: () => void;
  subscribe: Subscribe;
}

interface Position {
  get: () => number;
  subscribe: Subscribe;
}

export function readingFrom(
  position: Position,
  following: Store<boolean>,
): Reading {
  return {
    paragraphIndex: position.get,
    follows: following.get,
    stopFollowing() {
      following.update(() => false);
    },
    subscribe(listener) {
      const stopPosition = position.subscribe(listener);
      const stopFollowing = following.subscribe(listener);
      return () => {
        stopPosition();
        stopFollowing();
      };
    },
  };
}
