import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { IconButton } from "@/components/IconButton";
import { NativeButton } from "@/components/NativeButton";
import { NativeRow } from "@/components/NativeRow";
import { colors, gutter } from "@/constants/theme";
import { useLibrary } from "@/features/library/Library";
import { useDictionary } from "./Dictionary";
import { booksUsing, setOf } from "./entries";

function close(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}

/**
 * 1 つの作品が使う辞書を選ぶ: なし、または既存の辞書 — 作品はこれで別の
 * 作品（別のサイトにある同じ物語、続きの巻）と読みを共有する。辞書は
 * ここでは作らない: 作品から初めて読みを登録したときに作られる。作品の
 * 読み（リーダーのメニュー）から開く。
 * 行を選んでも印が付くだけ: 作品の辞書が変わるのは 決定 のときで、画面を
 * 閉じれば元のまま。
 */
export default function DictionarySelectScreen() {
  const { bookId } = useLocalSearchParams<{ bookId?: string }>();
  const { dictionary, assign } = useDictionary();
  const { books } = useLibrary();
  const book = books.find((item) => item.id === bookId);
  const current = setOf(dictionary, bookId);
  // 選んでいる途中の選択。確定するまで何も変わらない。
  const [picked, setPicked] = useState<string | null>(current?.id ?? null);
  const changed = picked !== (current?.id ?? null);

  return (
    // 全画面モーダルは独立したネイティブのウィンドウ: セーフエリアは下の
    // 画面から受け継がず、ここで計測する。
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <IconButton icon="x" label="閉じる" onPress={close} />
          <Text accessibilityRole="header" style={styles.title}>
            使う辞書
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {bookId === undefined ? (
            <Text style={styles.note}>作品が見つかりません。</Text>
          ) : (
            <>
              <View style={styles.intro}>
                <Text style={styles.work} numberOfLines={2}>
                  {book?.title ?? bookId}
                </Text>
                <Text style={styles.note}>
                  この作品で使う辞書を選びます。「すべての作品」の読みは、どれを選んでも適用されます。辞書は、本文を長押しして読みを登録すると作られます。
                </Text>
              </View>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="この作品で使う辞書"
                style={styles.card}
              >
                <View style={styles.row}>
                  <NativeRow
                    title="使わない"
                    selected={picked === null}
                    onPress={() => {
                      setPicked(null);
                    }}
                  />
                </View>
                {dictionary.sets.map((set) => (
                  <View key={set.id} style={styles.row}>
                    <NativeRow
                      title={set.name}
                      detail={`${set.entries.length}件 · ${booksUsing(dictionary, set.id).length}作品で使用`}
                      selected={picked === set.id}
                      onPress={() => {
                        setPicked(set.id);
                      }}
                    />
                  </View>
                ))}
              </View>
              <NativeButton
                label="決定"
                fill
                disabled={!changed}
                onPress={() => {
                  assign(bookId, picked);
                  close();
                }}
              />
            </>
          )}
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
  intro: { gap: 6 },
  work: { color: colors.text, fontSize: 15, fontWeight: "600" },
  note: { color: colors.secondary, fontSize: 13, lineHeight: 22 },
  card: {
    borderRadius: 10,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
