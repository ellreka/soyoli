import { useState } from "react";
import { Link } from "expo-router";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/Pressable";

import { Icon } from "@/components/Icon";
import { colors, gutter } from "@/constants/theme";
import { isWebNovel, type Book } from "@/features/books/book";
import { listedSites } from "@/features/web/sites";
import { usePlayback } from "./Playback";
import { Transport } from "./Transport";

/**
 * 本の出どころ: Web 小説のサイトのアイコンか、ファイルの表紙。見せる画像が
 * ない間は、ただの記号が代わりに出る。
 */
function Thumbnail({ book }: { book: Book }) {
  const [failed, setFailed] = useState(false);
  const uri = isWebNovel(book)
    ? listedSites.find((site) => site.id === book.source)?.iconUrl
    : book.cover;
  return (
    <View style={styles.thumbnail}>
      {uri && !failed ? (
        <Image
          testID="mini-player-thumbnail"
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          resizeMethod="scale"
          onError={() => {
            setFailed(true);
          }}
        />
      ) : (
        <Icon
          name={isWebNovel(book) ? "globe" : "file"}
          size={18}
          color={colors.secondary}
        />
      )}
    </View>
  );
}

/**
 * タブバーの上の「続きから」バー: 最後に開いた本 — タイトルと、今いる章や
 * 話 — と、その操作。
 */
export function MiniPlayer() {
  const { state } = usePlayback();
  // iOS にはリップルがない: 指が触れている間、バーの中身を薄くする。
  const [pressed, setPressed] = useState(false);
  const book = state.book;
  if (!book) {
    return null;
  }
  return (
    <View style={styles.container} testID="mini-player">
      {/* バー全体がビューアーを開く。端も、ボタンの周りの余白も含む:
      リンクはすべての下に敷いてあり、その上に描かれたボタンだけが
      自分でタップを受ける。 */}
      <Link href={{ pathname: "/reader", params: { id: book.id } }} asChild>
        <Pressable
          accessibilityLabel="ビューアーを開く"
          style={StyleSheet.absoluteFill}
          onPressIn={() => {
            setPressed(true);
          }}
          onPressOut={() => {
            setPressed(false);
          }}
        />
      </Link>
      <View
        pointerEvents="none"
        style={[
          styles.details,
          pressed && Platform.OS !== "android" && styles.pressed,
        ]}
      >
        <Thumbnail key={book.id} book={book} />
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {book.chapters[state.chapterIndex]?.title}
          </Text>
        </View>
      </View>
      <Transport compact />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: gutter,
    paddingRight: 8,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  details: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pressed: { opacity: 0.55 },
  thumbnail: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  titles: { flex: 1, gap: 2 },
  title: { color: colors.text, fontWeight: "600", fontSize: 14 },
  subtitle: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 12,
  },
});
