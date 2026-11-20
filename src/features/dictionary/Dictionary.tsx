import { createContext, useContext, type ReactNode } from "react";

import type { Book } from "@/features/books/book";
import { useLibrary } from "@/features/library/Library";
import { createStore, useStore } from "@/lib/store";
import { workPageOf } from "@/features/web/sites";
import {
  addEntry,
  assignSet,
  createSet,
  deleteSet,
  emptyDictionary,
  removeEntry,
  renameSet,
  setEntryEnabled,
  setSystemRule,
  toDictionary,
  type Dictionary,
  type DictionaryEntry,
  type DictionaryScope,
} from "./entries";
import { loadDictionary, saveDictionary } from "./dictionaryStorage";

interface DictionaryValue {
  dictionary: Dictionary;
  current: () => Dictionary;
  add: (scope: DictionaryScope, entry: DictionaryEntry) => void;
  remove: (scope: DictionaryScope, surface: string) => void;
  create: (name: string) => string;
  rename: (setId: string, name: string) => void;
  destroy: (setId: string) => void;
  assign: (bookId: string, setId: string | null) => void;
  setEnabled: (
    scope: DictionaryScope,
    surface: string,
    enabled: boolean,
  ) => void;
  setSystemEnabled: (ruleId: string, enabled: boolean) => void;
  replace: (dictionary: Dictionary) => void;
}

const DictionaryContext = createContext<DictionaryValue>({
  dictionary: emptyDictionary,
  current: () => emptyDictionary,
  add: () => undefined,
  remove: () => undefined,
  create: () => "",
  rename: () => undefined,
  destroy: () => undefined,
  assign: () => undefined,
  setEnabled: () => undefined,
  setSystemEnabled: () => undefined,
  replace: () => undefined,
});

let created = 0;
function newSetId(): string {
  created += 1;
  return `set-${Date.now().toString(36)}-${created}`;
}

function withBookDetails(dictionary: Dictionary, books: Book[]): Dictionary {
  return {
    ...dictionary,
    sets: dictionary.sets.map((set) => {
      const title =
        set.id === `book:${set.name}`
          ? books.find((book) => book.id === set.name)?.title
          : undefined;
      return title ? { ...set, name: title } : set;
    }),
    assigned: Object.fromEntries(
      Object.entries(dictionary.assigned).map(([bookId, item]) => {
        const book = item.title
          ? undefined
          : books.find((candidate) => candidate.id === bookId);
        if (!book) {
          return [bookId, item];
        }
        const url = workPageOf(book.id, book.url);
        return [bookId, { ...item, title: book.title, ...(url && { url }) }];
      }),
    ),
  };
}

export function DictionaryProvider({ children }: { children: ReactNode }) {
  const [dictionary, , store] = useStore(() =>
    createStore(toDictionary(loadDictionary())),
  );
  const { books } = useLibrary();
  const view = withBookDetails(dictionary, books);

  function setDictionary(change: (current: Dictionary) => Dictionary): void {
    const before = store.get();
    store.update(change);
    const after = store.get();
    if (after !== before) {
      saveDictionary(withBookDetails(after, books));
    }
  }

  const value: DictionaryValue = {
    dictionary: view,
    current: store.get,
    add: (scope, entry) => {
      setDictionary((current) => addEntry(current, scope, entry));
    },
    remove: (scope, surface) => {
      setDictionary((current) => removeEntry(current, scope, surface));
    },
    create: (name) => {
      const id = newSetId();
      setDictionary((current) => createSet(current, id, name));
      return id;
    },
    rename: (setId, name) => {
      setDictionary((current) => renameSet(current, setId, name));
    },
    destroy: (setId) => {
      setDictionary((current) => deleteSet(current, setId));
    },
    assign: (bookId, setId) => {
      const book = books.find((item) => item.id === bookId);
      const url = book ? workPageOf(book.id, book.url) : null;
      setDictionary((current) =>
        assignSet(current, bookId, setId, {
          title: book?.title,
          url: url ?? undefined,
        }),
      );
    },
    setEnabled: (scope, surface, enabled) => {
      setDictionary((current) =>
        setEntryEnabled(current, scope, surface, enabled),
      );
    },
    setSystemEnabled: (ruleId, enabled) => {
      setDictionary((current) => setSystemRule(current, ruleId, enabled));
    },
    replace: (next) => {
      setDictionary(() => next);
    },
  };

  return <DictionaryContext value={value}>{children}</DictionaryContext>;
}

export function useDictionary(): DictionaryValue {
  return useContext(DictionaryContext);
}
