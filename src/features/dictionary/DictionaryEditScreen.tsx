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
  /** 新しい読みの初期値、または編集中の読みの文字。 */
  surface: string;
  /** 作品から開いた: 読みはその作品の辞書に入る。 */
  bookId?: string;
  /** 読みが入っている、または最初に入る辞書（"common" か id）。 */
  set?: string;
  /** `set` にすでにある読みを編集している。 */
  edit?: boolean;
}

/**
 * エディタを開くルートのパラメータ。文字は URL を通るので、ここで
 * エスケープし、画面側で戻す。
 */
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
/** 「この作品の辞書」を指すキー。辞書はまだないかもしれない。 */
const bookKey = "book";

function scopeOf(key: string): DictionaryScope {
  return key === commonKey ? "common" : { setId: key };
}

/**
 * 読み 1 件の全画面エディタ。リーダーは、段落を初期値にして新しい読みを
 * 登録するために開く: 読みは作品の辞書（なければ、その場で作品名を付けて
 * 作る）か、全作品共通の辞書に入る。辞書のページは既存の読みを編集する
 * ために開き、そこではその辞書と全作品共通の辞書の間で読みを移せる。
 */
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
  // 読みが入るのは手元の辞書か共通辞書で、ほかの辞書には入らない。作品から
  // 開いたときの手元の辞書は、その作品自身の辞書。作品がどの辞書を使うかは
  // 別の場所（リーダーのメニュー）で選ぶ。
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
      : // 辞書のページから: その辞書か共通辞書。ほかの辞書は出さない —
        // 出すと、辞書が増えるほど一覧が長くなる。
        [
          ...dictionary.sets
            .filter((set) => set.id === fromSet)
            .map((set) => ({ key: set.id, label: set.name })),
          common,
        ];
  const initialTarget = bookId !== undefined ? bookKey : (fromSet ?? commonKey);

  function save(target: string, edited: DictionaryEntry): void {
    // 読みを適用するかどうかは辞書のページで切り替える。編集しても
    // そのままにする。
    const entry = existing?.off ? { ...edited, off: true as const } : edited;
    // 編集で文字が変わったり、読みが別の辞書へ移ったりすることがある:
    // 元のものは横に残さず、置き換える。
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
    // 全画面モーダルは独立したネイティブのウィンドウ: セーフエリアは下の
    // 画面から受け継がず、ここで計測する。
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
