import { useSyncExternalStore } from "react";

export type Subscription = (notify: () => void) => () => void;

export function unsubscribeNothing(): void {}

function stayUnsubscribed(): () => void {
  return unsubscribeNothing;
}

function noSnapshot(): null {
  return null;
}

export function useSubscription(subscribe: Subscription | null): void {
  useSyncExternalStore(subscribe ?? stayUnsubscribed, noSnapshot);
}
