import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { IconButton } from "@/components/IconButton";
import { colors, gutter } from "@/constants/theme";
import { useLibrary } from "@/features/library/Library";
import { useDictionary } from "./Dictionary";
import { DictionaryForm, type DictionaryTarget } from "./DictionaryForm";
import { setOf, type DictionaryEntry, type DictionaryScope } from "./entries";

interface EditTarget {
  surface: string;
  bookId?: string;
  set?: string;
  edit?: boolean;
}

export function dictionaryParams(target: EditTarget): Record<string, string> {
  return {
    surface: encodeURIComponent(target.surface),
    ...(target.bookId !== undefined && {
      bookId: encodeURIComponent(target.bookId),
    }),
    ...(target.set !== undefined && { set: encodeURIComponent(target.set) }),
    ...(target.edit && { edit: "1" }),
  };
}

function fromParam(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function close() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/settings/dictionary");
  }
}

const commonKey = "common";
const bookKey = "book";

function scopeOf(key: string): DictionaryScope {
  return key === commonKey ? "common" : { setId: key };
}

export default function DictionaryEditScreen() {
  const params = useLocalSearchParams<{
    surface?: string;
    bookId?: string;
    set?: string;
    edit?: string;
  }>();
  const { dictionary, add, remove, create, assign } = useDictionary();
  const { books } = useLibrary();
  const surface = fromParam(params.surface) ?? "";
  const bookId = fromParam(params.bookId);
  const fromSet = fromParam(params.set);
  const book = books.find((item) => item.id === bookId);
  const assigned = setOf(dictionary, bookId);
  const original: DictionaryScope | null =
    params.edit === "1" && fromSet !== undefined ? scopeOf(fromSet) : null;
  const existing = original
    ? (original === "common"
        ? dictionary.common
        : (dictionary.sets.find((set) => set.id === original.setId)?.entries ??
          [])
      ).find((entry) => entry.surface === surface)
    : undefined;
  const common: DictionaryTarget = { key: commonKey, label: "すべての作品" };
  const targets: DictionaryTarget[] =
    bookId !== undefined
      ? [
          {
            key: bookKey,
            label: "この作品の辞書",
            detail: assigned
              ? assigned.name
              : `新しく作成：${book?.title ?? bookId}`,
          },
          common,
        ]
      : [
          ...dictionary.sets
            .filter((set) => set.id === fromSet)
            .map((set) => ({ key: set.id, label: set.name })),
          common,
        ];
  const initialTarget = bookId !== undefined ? bookKey : (fromSet ?? commonKey);

  function save(target: string, edited: DictionaryEntry): void {
    const entry = existing?.off ? { ...edited, off: true as const } : edited;
    if (original) {
      remove(original, surface);
    }
    if (target === bookKey && bookId !== undefined) {
      let setId = assigned?.id;
      if (setId === undefined) {
        setId = create(book?.title ?? bookId);
        assign(bookId, setId);
      }
      add({ setId }, entry);
    } else {
      add(scopeOf(target), entry);
    }
    close();
  }

  return (
    // WORKAROUND: 全画面モーダルは独立したネイティブのウィンドウで、セーフエリアを下の画面から受け継がない。
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <IconButton icon="x" label="閉じる" onPress={close} />
          <Text accessibilityRole="header" style={styles.title}>
            {original ? "読みを編集" : "辞書登録"}
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {book && (
            <Text style={styles.book} numberOfLines={2}>
              {book.title}
            </Text>
          )}
          <DictionaryForm
            initialSurface={surface}
            initialReading={existing?.reading}
            initialRegex={existing?.regex}
            initialMultiline={existing?.multiline}
            initialDescription={existing?.description}
            targets={targets}
            initialTarget={initialTarget}
            submitLabel={original ? "保存" : "登録"}
            onDelete={
              original
                ? () => {
                    remove(original, surface);
                    close();
                  }
                : undefined
            }
            onSave={save}
          />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 52,
    paddingHorizontal: 8,
  },
  title: { color: colors.text, fontWeight: "600", fontSize: 17 },
  content: { gap: 16, paddingHorizontal: gutter, paddingVertical: 16 },
  book: { color: colors.secondary, fontWeight: "400", fontSize: 13 },
});
