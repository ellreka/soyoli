import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useLibrary } from "@/features/library/Library";
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
  /** ルールを追加する。同じスコープに同じ文字のルールがあれば置き換える。 */
  add: (scope: DictionaryScope, entry: DictionaryEntry) => void;
  remove: (scope: DictionaryScope, surface: string) => void;
  /** 空の辞書を作り、その id を返す。 */
  create: (name: string) => string;
  rename: (setId: string, name: string) => void;
  /** 辞書を削除する。使っていた作品は辞書なしになる。 */
  destroy: (setId: string) => void;
  /** 作品に辞書を使わせる。使わない場合は `null`。 */
  assign: (bookId: string, setId: string | null) => void;
  /** ルールをオン／オフにする。ルールは辞書に残る。 */
  setEnabled: (
    scope: DictionaryScope,
    surface: string,
    enabled: boolean,
  ) => void;
  /** アプリ自身のルールの 1 つをオン／オフにする。 */
  setSystemEnabled: (ruleId: string, enabled: boolean) => void;
  /** 辞書を丸ごと入れ替える。バックアップから取り込むときのためのもの。 */
  replace: (dictionary: Dictionary) => void;
}

// プロバイダーがなければ、単にルールがないだけ: 読み上げは、辞書が
// 用意されていることに依存しない。
const DictionaryContext = createContext<DictionaryValue>({
  dictionary: emptyDictionary,
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
/** 新しい辞書の id。イベントハンドラからだけ呼ぶ。 */
function newSetId(): string {
  created += 1;
  return `set-${Date.now().toString(36)}-${created}`;
}

/** 読み方辞書を持ち、起動をまたいで保存する。 */
export function DictionaryProvider({ children }: { children: ReactNode }) {
  const [dictionary, setDictionary] = useState<Dictionary>(() =>
    toDictionary(loadDictionary()),
  );
  const [loaded] = useState(dictionary);
  const { books } = useLibrary();

  // 作品ごとの形式から引き継いだ辞書は、作品のタイトルが分かるまで作品の
  // id が名前になっている。分かったらタイトルを表示（し、保存）する。
  const view: Dictionary = {
    ...dictionary,
    sets: dictionary.sets.map((set) => {
      const title =
        set.id === `book:${set.name}`
          ? books.find((book) => book.id === set.name)?.title
          : undefined;
      return title ? { ...set, name: title } : set;
    }),
    // タイトルを保存するようになる前の選択には、その作品が初めてライブラリに
    // 現れたときに、タイトルとページを入れる。
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
  const saved = JSON.stringify(view);
  useEffect(() => {
    // 何かが変わるまで、書くものはない。
    if (dictionary !== loaded) {
      saveDictionary(JSON.parse(saved) as Dictionary);
    }
  }, [dictionary, loaded, saved]);

  const value: DictionaryValue = {
    dictionary: view,
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
      // 作品のタイトルとページを、選択と一緒に覚えておく。
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
    replace: setDictionary,
  };

  return <DictionaryContext value={value}>{children}</DictionaryContext>;
}

export function useDictionary(): DictionaryValue {
  return useContext(DictionaryContext);
}
