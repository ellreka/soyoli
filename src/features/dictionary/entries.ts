export interface DictionaryEntry {
  surface: string;
  reading: string;
  regex?: boolean;
  multiline?: true;
  off?: true;
  description?: string;
}

export interface DictionarySet {
  id: string;
  name: string;
  entries: DictionaryEntry[];
}

export interface Dictionary {
  common: DictionaryEntry[];
  sets: DictionarySet[];
  assigned: Record<string, Assignment>;
  systemOff?: string[];
}

export interface Assignment {
  setId: string;
  title?: string;
  url?: string;
}

export type WorkInfo = Pick<Assignment, "title" | "url">;

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
      const item = isRecord(raw) ? raw : { setId: raw };
      const setId = item.setId;
      if (typeof setId === "string" && sets.some((set) => set.id === setId)) {
        assigned[bookId] = {
          setId,
          ...(typeof item.title === "string" &&
            item.title && { title: item.title }),
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

export function setOf(
  dictionary: Dictionary,
  bookId: string | undefined,
): DictionarySet | undefined {
  const id =
    bookId === undefined ? undefined : dictionary.assigned[bookId]?.setId;
  return dictionary.sets.find((set) => set.id === id);
}

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

export function buildPattern(source: string, flags: string): RegExp | Error {
  try {
    return new RegExp(source, flags);
  } catch (error: unknown) {
    return error instanceof Error ? error : new Error("Invalid pattern");
  }
}

export function patternError(source: string): string | null {
  const pattern = buildPattern(source, "u");
  return pattern instanceof Error ? pattern.message : null;
}
