import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import { NativeButton } from "@/components/NativeButton";
import { NativeTextField } from "@/components/NativeTextField";
import { Screen, Section } from "@/components/Screen";
import { colors } from "@/constants/theme";
import { sourceName } from "@/features/books/book";
import { useLibrary } from "@/features/library/Library";
import { displayUrl } from "@/features/web/browser";
import { workUrlOf } from "@/features/web/sites";
import { useDictionary } from "./Dictionary";
import { dictionaryParams } from "./DictionaryEditScreen";
import { booksUsing, type DictionaryScope } from "./entries";
import {
  entryRows,
  ReadingList,
  readingOf,
  type ReadingRow,
} from "./ReadingList";
import { activeSystemRules, systemRules } from "./system";

function back(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/settings/dictionary");
  }
}

/**
 * 設定 › 読み方辞書 › 辞書 1 つ: その名前、使っている作品、読み。読みには
 * それぞれオン／オフのスイッチが付く。作品は一覧に出るだけ: 作品が辞書を
 * 選ぶ（外す）のはリーダーのメニューから。
 *
 * アプリ自身の辞書（`system`）も同じページ。違いは、読みを編集・追加・
 * 削除できないことだけ。
 */
export default function DictionarySetScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { dictionary, rename, destroy, setEnabled, setSystemEnabled } =
    useDictionary();
  const { books } = useLibrary();
  const system = id === "system";
  const common = id === "common";
  const set = dictionary.sets.find((item) => item.id === id);
  if (!system && !common && !set) {
    return (
      <Screen title="読み方辞書" onBack={back}>
        <Text style={styles.note}>この辞書は見つかりません。</Text>
      </Screen>
    );
  }
  const users = set ? booksUsing(dictionary, set.id) : [];
  const key = set ? set.id : "common";
  const scope: DictionaryScope = set ? { setId: set.id } : "common";
  const active = activeSystemRules(dictionary.systemOff);
  const rows: ReadingRow[] = system
    ? systemRules.map((rule) => ({
        key: rule.id,
        name: rule.description,
        input: rule.surface,
        reading: readingOf(rule),
        description: rule.description,
        enabled: active.includes(rule),
        setEnabled: (enabled) => {
          setSystemEnabled(rule.id, enabled);
        },
      }))
    : entryRows(set ? set.entries : dictionary.common, scope, setEnabled);
  const title = system ? "システム辞書" : set ? set.name : "すべての作品";

  return (
    <Screen title={title} onBack={back}>
      {system && (
        <Text style={styles.note}>
          アプリに組み込まれた読み方です。すべての作品に適用され、登録した読みやルビの読みが優先されます。編集はできません。
        </Text>
      )}
      {set && (
        <Section title="名前">
          <View style={styles.input}>
            <NativeTextField
              accessibilityLabel="辞書の名前"
              defaultValue={set.name}
              onChangeText={(name) => {
                if (name.trim()) {
                  rename(set.id, name.trim());
                }
              }}
            />
          </View>
        </Section>
      )}
      {set && (
        <Section title="この辞書を使う作品">
          {users.length === 0 ? (
            <Text style={styles.note}>
              使っている作品はありません。作品を開き、メニューの「読み方辞書」から選べます。
            </Text>
          ) : (
            <View style={styles.card}>
              {users.map((bookId) => {
                const book = books.find((item) => item.id === bookId);
                // ライブラリにない作品は、この辞書を選んだときに保存したもので
                // 表示する: タイトルとページ。
                const kept = dictionary.assigned[bookId];
                const url = kept?.url ?? workUrlOf(bookId);
                const title = book?.title ?? kept?.title;
                return (
                  <View key={bookId} style={styles.user}>
                    <Text style={styles.userTitle} numberOfLines={2}>
                      {title ?? (url ? displayUrl(url) : bookId)}
                    </Text>
                    <Text style={styles.userDetail} numberOfLines={1}>
                      {book
                        ? // 名前を出さないサイトの作品は、アドレスで見分ける。
                          (sourceName(book.source) ??
                          (url ? displayUrl(url) : ""))
                        : [
                            "本棚にない作品",
                            title && url ? displayUrl(url) : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Section>
      )}
      <Section title={`読み（${rows.length}件）`}>
        <ReadingList rows={rows} />
        {!system && (
          <NativeButton
            label="読みを追加"
            variant="outlined"
            fill
            onPress={() => {
              router.push({
                pathname: "/dictionary",
                params: dictionaryParams({ surface: "", set: key }),
              });
            }}
          />
        )}
      </Section>
      {set && (
        <NativeButton
          label="この辞書を削除"
          variant="text"
          fill
          onPress={() => {
            // 削除するとすべての読みも一緒に消え、取り消せない。
            Alert.alert(
              "この辞書を削除しますか？",
              `「${set.name}」と、登録されている読み${set.entries.length}件を削除します。この操作は取り消せません。`,
              [
                { text: "キャンセル", style: "cancel" },
                {
                  text: "削除",
                  style: "destructive",
                  onPress: () => {
                    destroy(set.id);
                    back();
                  },
                },
              ],
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.secondary, fontSize: 13, lineHeight: 22 },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  card: {
    borderRadius: 10,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  user: {
    justifyContent: "center",
    gap: 2,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  userTitle: { color: colors.text, fontSize: 15 },
  userDetail: { color: colors.secondary, fontSize: 12 },
});
