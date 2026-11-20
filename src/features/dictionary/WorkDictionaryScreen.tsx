import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { IconButton } from "@/components/IconButton";
import { NativeButton } from "@/components/NativeButton";
import { NativeRow } from "@/components/NativeRow";
import { Section } from "@/components/Screen";
import { colors, gutter } from "@/constants/theme";
import { useLibrary } from "@/features/library/Library";
import { useDictionary } from "./Dictionary";
import { dictionaryParams } from "./DictionaryEditScreen";
import { setOf } from "./entries";
import { entryRows, ReadingList } from "./ReadingList";

function close(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}

export default function WorkDictionaryScreen() {
  const { bookId } = useLocalSearchParams<{ bookId?: string }>();
  const { dictionary, setEnabled } = useDictionary();
  const { books } = useLibrary();
  const book = books.find((item) => item.id === bookId);
  const set = setOf(dictionary, bookId);
  const own = set ? entryRows(set.entries, { setId: set.id }, setEnabled) : [];
  const shared = entryRows(dictionary.common, "common", setEnabled);

  return (
    // WORKAROUND: 全画面モーダルは独立したネイティブのウィンドウで、セーフエリアを下の画面から受け継がない。
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <IconButton icon="x" label="閉じる" onPress={close} />
          <Text accessibilityRole="header" style={styles.title}>
            読み方辞書
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {bookId === undefined ? (
            <Text style={styles.note}>作品が見つかりません。</Text>
          ) : (
            <>
              <Text style={styles.work} numberOfLines={2}>
                {book?.title ?? bookId}
              </Text>
              <View style={styles.card}>
                <NativeRow
                  title="使う辞書"
                  detail={set ? set.name : "使わない"}
                  onPress={() => {
                    router.push({
                      pathname: "/dictionary-select",
                      params: { bookId },
                    });
                  }}
                />
              </View>
              <Section title={`この作品の読み（${own.length}件）`}>
                {own.length === 0 && (
                  <Text style={styles.note}>
                    登録された読みはありません。本文を長押しするか、下のボタンから登録できます。
                  </Text>
                )}
                <ReadingList rows={own} />
                <NativeButton
                  label="読みを追加"
                  variant="outlined"
                  fill
                  onPress={() => {
                    router.push({
                      pathname: "/dictionary",
                      params: dictionaryParams({ surface: "", bookId }),
                    });
                  }}
                />
              </Section>
              <Section title={`すべての作品の読み（${shared.length}件）`}>
                {shared.length === 0 && (
                  <Text style={styles.note}>登録された読みはありません。</Text>
                )}
                <ReadingList rows={shared} />
              </Section>
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
  content: { gap: 24, paddingHorizontal: gutter, paddingVertical: 16 },
  work: { color: colors.text, fontSize: 15, fontWeight: "600" },
  note: { color: colors.secondary, fontSize: 13, lineHeight: 22 },
  card: {
    flexDirection: "row",
    borderRadius: 10,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
});
