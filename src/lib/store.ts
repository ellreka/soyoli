import { useState, useSyncExternalStore } from "react";

export interface Store<T> {
  get: () => T;
  subscribe: (listener: () => void) => () => void;
  update: (change: (current: T) => T) => void;
}

export function createStore<T>(
  initial: T,
  onChange?: (next: T, previous: T) => void,
): Store<T> {
  const listeners = new Set<() => void>();
  const store = { value: initial };
  return {
    get: () => store.value,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(change) {
      const previous = store.value;
      const next = change(previous);
      if (Object.is(next, previous)) {
        return;
      }
      store.value = next;
      onChange?.(next, previous);
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

type StoredValue<S> = S extends Store<infer T> ? T : never;

export function useStore<S extends Store<StoredValue<S>>>(
  create: () => S,
): [StoredValue<S>, S["update"], S] {
  const [store] = useState(create);
  const value = useSyncExternalStore(store.subscribe, store.get);
  return [value, store.update, store];
}
