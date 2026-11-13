import { Image, StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";
import { listedSites } from "@/features/web/sites";
import { isWebNovel, sourceLabels, type Book } from "@/features/books/book";

/** サイト名の上で、カードに入るだけの行数。 */
const titleLines = 7;

/**
 * サムネイルがタイトルの代わりに出す 1 文字: 先頭の開きカッコや記号を
 * 飛ばした、最初の文字か数字（【書籍化】… なら 書）。
 */
export function initial(title: string): string {
  return /[\p{L}\p{N}]/u.exec(title)?.[0] ?? "";
}

/** Web 小説の出どころのサイトのアイコン。表紙の下に小さく出す。 */
function SiteIcon({ book }: { book: Book }) {
  const uri = listedSites.find((site) => site.id === book.source)?.iconUrl;
  return uri ? (
    <Image source={{ uri }} style={styles.siteIcon} resizeMode="cover" />
  ) : null;
}

interface BookCoverProps {
  book: Book;
  /** 行の文字の横に置くサムネイル: タイトルを載せるには小さすぎる。 */
  compact?: boolean;
  /** 変えると画像を読み込み直す（本棚を読み込み直した後）。 */
  revision?: number;
}

/**
 * 表紙の画像。画像のない作品（Web 小説はすべて）には、タイトルそのものを
 * カードにする: 長いタイトルをできるだけ多く読めるように高さをすべて
 * タイトルに使い、下にサイト名を控えめに出す。
 */
export function BookCover({
  book,
  compact = false,
  revision = 0,
}: BookCoverProps) {
  if (compact) {
    return (
      <View style={[styles.cover, styles.compact]} accessible={false}>
        {book.cover ? (
          <Image
            key={revision}
            source={{ uri: book.cover }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            resizeMethod="scale"
          />
        ) : (
          <Text style={styles.initial} numberOfLines={1}>
            {initial(book.title)}
          </Text>
        )}
        <View style={styles.badge}>
          <SiteIcon book={book} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.cover} accessible={false}>
      {book.cover ? (
        <Image
          key={revision}
          source={{ uri: book.cover }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          // Android の既定のリサイズは、CMYK の JPEG（印刷用の表紙）を落としてしまう。
          resizeMethod="scale"
        />
      ) : (
        <>
          {/* とても長いタイトルは、切る前に少し縮める。 */}
          <Text
            style={styles.title}
            numberOfLines={titleLines}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {book.title}
          </Text>
          {isWebNovel(book) && (
            <View style={styles.foot}>
              <SiteIcon book={book} />
              <Text style={styles.source} numberOfLines={1}>
                {sourceLabels[book.source]}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    alignSelf: "stretch",
    aspectRatio: 2 / 3,
    padding: 8,
    gap: 4,
    justifyContent: "space-between",
    overflow: "hidden",
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 17,
  },
  // 左下にサイト: アイコン、続いて正式な名前。
  foot: { flexDirection: "row", alignItems: "center", gap: 4 },
  source: {
    flexShrink: 1,
    color: colors.secondary,
    fontWeight: "500",
    fontSize: 10,
  },
  siteIcon: { width: 14, height: 14, borderRadius: 3 },
  // サムネイルでは、アイコンは左下の隅に置く。
  badge: { position: "absolute", left: 2, bottom: 2 },
  compact: {
    alignSelf: "auto",
    width: 40,
    padding: 3,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    // 行のカードの上では、表紙が 2 つの面のうち暗いほうになる。
    backgroundColor: colors.background,
  },
  initial: { color: colors.secondary, fontWeight: "600", fontSize: 20 },
});
