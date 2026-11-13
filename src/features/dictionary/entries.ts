/** 読みのルール 1 つ: ある文字をどう読み上げるか。 */
export interface DictionaryEntry {
  /** 書かれたとおりの文字。`regex` が付いていれば正規表現。 */
  surface: string;
  /**
   * どう読むか。空なら「読まない」。正規表現では `$1`、`$<name>`、`$&` が
   * 一致した部分を差し込む。
   */
  reading: string;
  regex?: boolean;
  /**
   * 章全体に対して照合するので、一致がいくつかの段落（改行でつないだもの）に
   * またがることがある。正規表現では、`^` と `$` が各段落の始まりと終わりに
   * なる。
   */
  multiline?: true;
  /** 辞書には残っているが、適用されない。 */
  off?: true;
  /** ルールが何のためのものか。辞書では入力の代わりに表示される。 */
  description?: string;
}

/** 作品どうしで共有できる、名前の付いた読みの集まり。 */
export interface DictionarySet {
  id: string;
  name: string;
  entries: DictionaryEntry[];
}

/**
 * 読み方辞書。`common` は全作品に適用される。各作品が使う名前付きの辞書は
 * 多くても 1 つ（`assigned`、本の id ごと）で、1 つの辞書をいくつかの作品が
 * 使える — 2 つのサイトにある同じ物語や、シリーズの各巻。
 */
export interface Dictionary {
  common: DictionaryEntry[];
  sets: DictionarySet[];
  assigned: Record<string, Assignment>;
  /** アプリ自身のルール（`systemRules`）のうち、オフにしたものの id。 */
  systemOff?: string[];
}

/**
 * 作品が使う辞書。作品のタイトルとページも一緒に保存するので、作品が
 * ライブラリからなくなった後も名前を出せる。
 */
export interface Assignment {
  setId: string;
  title?: string;
  /** 作品のページ。Web 小説の場合。 */
  url?: string;
}

/** 作品に辞書を割り当てるときに分かっている、作品の情報。 */
export type WorkInfo = Pick<Assignment, "title" | "url">;

/** ルールの置き場所: 名前付きの辞書か、全作品共通の辞書。 */
export type DictionaryScope = { setId: string } | "common";

export const emptyDictionary: Dictionary = {
  common: [],
  sets: [],
  assigned: {},
};

function entriesOf(value: unknown): DictionaryEntry[] {
  const entries: DictionaryEntry[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    const { surface, reading, regex, multiline, off, description } = (item ??
      {}) as Partial<DictionaryEntry>;
    if (
      typeof surface === "string" &&
      // 空の読みもルールの一つ: その文字は読まれない。
      typeof reading === "string" &&
      surface &&
      !entries.some((entry) => entry.surface === surface)
    ) {
      entries.push({
        surface,
        reading,
        ...(regex === true && { regex }),
        ...(multiline === true && { multiline }),
        ...(off === true && { off }),
        ...(typeof description === "string" && description && { description }),
      });
    }
  }
  return entries;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * ディスクから読み戻した辞書。壊れたものは落とす。辞書を共有できるように
 * なる前に書かれたファイルは、読みを作品ごと（`books`）に持っていた:
 * それぞれが 1 つの辞書になり、その作品が使い、作品のタイトルが分かるまで
 * 作品の id が名前になる。
 */
export function toDictionary(value: unknown): Dictionary {
  if (!isRecord(value)) {
    return emptyDictionary;
  }
  const sets: DictionarySet[] = [];
  for (const item of Array.isArray(value.sets) ? value.sets : []) {
    if (
      isRecord(item) &&
      typeof item.id === "string" &&
      item.id &&
      typeof item.name === "string" &&
      !sets.some((set) => set.id === item.id)
    ) {
      sets.push({
        id: item.id,
        name: item.name,
        entries: entriesOf(item.entries),
      });
    }
  }
  const assigned: Record<string, Assignment> = {};
  if (isRecord(value.assigned)) {
    for (const [bookId, raw] of Object.entries(value.assigned)) {
      // 以前のファイルは、辞書の id だけを持っていた。
      const item = isRecord(raw) ? raw : { setId: raw };
      const setId = item.setId;
      if (typeof setId === "string" && sets.some((set) => set.id === setId)) {
        assigned[bookId] = {
          setId,
          ...(typeof item.title === "string" &&
            item.title && { title: item.title }),
          // 保存するのは Web ページだけ。後で表示したり開いたりすることがある。
          ...(typeof item.url === "string" &&
            item.url.startsWith("https://") && { url: item.url }),
        };
      }
    }
  }
  if (isRecord(value.books)) {
    for (const [bookId, raw] of Object.entries(value.books)) {
      const entries = entriesOf(raw);
      if (entries.length && !(bookId in assigned)) {
        const id = `book:${bookId}`;
        sets.push({ id, name: bookId, entries });
        assigned[bookId] = { setId: id };
      }
    }
  }
  const systemOff = [
    ...new Set(
      (Array.isArray(value.systemOff) ? value.systemOff : []).filter(
        (id): id is string => typeof id === "string" && id !== "",
      ),
    ),
  ];
  return {
    common: entriesOf(value.common),
    sets,
    assigned,
    ...(systemOff.length > 0 && { systemOff }),
  };
}

/** アプリ自身のルールの 1 つをオン／オフにする。オフにしない限りオン。 */
export function setSystemRule(
  dictionary: Dictionary,
  ruleId: string,
  enabled: boolean,
): Dictionary {
  const { systemOff = [], ...rest } = dictionary;
  const others = systemOff.filter((id) => id !== ruleId);
  const next = enabled ? others : [...others, ruleId];
  return next.length > 0 ? { ...rest, systemOff: next } : rest;
}

/** 作品が使う辞書。使っていれば。 */
export function setOf(
  dictionary: Dictionary,
  bookId: string | undefined,
): DictionarySet | undefined {
  const id =
    bookId === undefined ? undefined : dictionary.assigned[bookId]?.setId;
  return dictionary.sets.find((set) => set.id === id);
}

/** ある辞書を使っている作品の id。 */
export function booksUsing(dictionary: Dictionary, setId: string): string[] {
  return Object.keys(dictionary.assigned).filter(
    (bookId) => dictionary.assigned[bookId]?.setId === setId,
  );
}

function scoped(dictionary: Dictionary, scope: DictionaryScope) {
  return scope === "common"
    ? dictionary.common
    : (dictionary.sets.find((set) => set.id === scope.setId)?.entries ?? []);
}

function withScope(
  dictionary: Dictionary,
  scope: DictionaryScope,
  entries: DictionaryEntry[],
): Dictionary {
  if (scope === "common") {
    return { ...dictionary, common: entries };
  }
  return {
    ...dictionary,
    sets: dictionary.sets.map((set) =>
      set.id === scope.setId ? { ...set, entries } : set,
    ),
  };
}

/** ルールを追加する。同じスコープに同じ文字のルールがあれば置き換える。 */
export function addEntry(
  dictionary: Dictionary,
  scope: DictionaryScope,
  entry: DictionaryEntry,
): Dictionary {
  return withScope(dictionary, scope, [
    entry,
    ...scoped(dictionary, scope).filter(
      (item) => item.surface !== entry.surface,
    ),
  ]);
}

/** ルールをその場でオン／オフにする。ルールは辞書に残る。 */
export function setEntryEnabled(
  dictionary: Dictionary,
  scope: DictionaryScope,
  surface: string,
  enabled: boolean,
): Dictionary {
  return withScope(
    dictionary,
    scope,
    scoped(dictionary, scope).map((item) => {
      if (item.surface !== surface) {
        return item;
      }
      const { off: _, ...rest } = item;
      return enabled ? rest : { ...rest, off: true as const };
    }),
  );
}

export function removeEntry(
  dictionary: Dictionary,
  scope: DictionaryScope,
  surface: string,
): Dictionary {
  return withScope(
    dictionary,
    scope,
    scoped(dictionary, scope).filter((item) => item.surface !== surface),
  );
}

/** 空の辞書を追加する。新しい id は呼び出し側が用意する。 */
export function createSet(
  dictionary: Dictionary,
  id: string,
  name: string,
): Dictionary {
  return dictionary.sets.some((set) => set.id === id)
    ? dictionary
    : { ...dictionary, sets: [...dictionary.sets, { id, name, entries: [] }] };
}

export function renameSet(
  dictionary: Dictionary,
  setId: string,
  name: string,
): Dictionary {
  return {
    ...dictionary,
    sets: dictionary.sets.map((set) =>
      set.id === setId ? { ...set, name } : set,
    ),
  };
}

/** 辞書を削除する。使っていた作品は辞書なしになる。 */
export function deleteSet(dictionary: Dictionary, setId: string): Dictionary {
  return {
    ...dictionary,
    sets: dictionary.sets.filter((set) => set.id !== setId),
    assigned: Object.fromEntries(
      Object.entries(dictionary.assigned).filter(
        ([, item]) => item.setId !== setId,
      ),
    ),
  };
}

/**
 * 作品に辞書を使わせる。使わない場合は `null`。`work` は作品について
 * 覚えておくもの: タイトルとページ。
 */
export function assignSet(
  dictionary: Dictionary,
  bookId: string,
  setId: string | null,
  work: WorkInfo = {},
): Dictionary {
  const assigned = { ...dictionary.assigned };
  if (setId !== null && dictionary.sets.some((set) => set.id === setId)) {
    assigned[bookId] = {
      setId,
      ...(work.title && { title: work.title }),
      ...(work.url && { url: work.url }),
    };
  } else {
    delete assigned[bookId];
  }
  return { ...dictionary, assigned };
}

/** ルールのパターンを指定のフラグでコンパイルしたもの。できなければその理由。 */
export function buildPattern(source: string, flags: string): RegExp | Error {
  try {
    return new RegExp(source, flags);
  } catch (error: unknown) {
    return error instanceof Error ? error : new Error("Invalid pattern");
  }
}

/** 正規表現ルールのパターンが使えない理由。使えるなら null。 */
export function patternError(source: string): string | null {
  const pattern = buildPattern(source, "u");
  return pattern instanceof Error ? pattern.message : null;
}
