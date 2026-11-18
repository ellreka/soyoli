import { Image, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { colors } from "@/constants/theme";
import { listedSites } from "@/features/web/sites";
import { isWebNovel, sourceName, type Book } from "@/features/books/book";

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
  /** 自分の大きさを持たず、親の箱を埋める（重ねた表紙の一番上）。 */
  fill?: boolean;
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
  fill = false,
}: BookCoverProps) {
  if (compact) {
    return (
      <View
        style={[styles.cover, styles.compact, fill && styles.fill]}
        accessible={false}
      >
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
    <View style={[styles.cover, fill && styles.fill]} accessible={false}>
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
          {isWebNovel(book) && sourceName(book.source) && (
            <View style={styles.foot}>
              <SiteIcon book={book} />
              <Text style={styles.source} numberOfLines={1}>
                {sourceName(book.source)}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

interface SeriesCoverProps extends Omit<BookCoverProps, "fill"> {
  /** まとまりの冊数。表紙の隅に出す（サムネイルでは出さない）。 */
  count: number;
}

/**
 * 巻をまとめた作品の表紙: 後ろに 2 枚ずらして重ね、束に見せる。形だけで
 * 単体の作品と見分けられるようにするため。重ねるのは無地の面: ほかの巻の
 * 表紙を覗かせると、絵がばらばらで束に見えない。全体の大きさは単体の表紙と
 * 同じで、一番上の表紙はそのぶん少し小さい。
 */
export function SeriesCover({ count, compact, ...cover }: SeriesCoverProps) {
  // ずらす幅: 後ろの 1 枚ごと。
  const step = compact ? 2 : 4;
  const radius = compact ? 4 : 6;
  // 重なりの境目は、背景の色の細い縁で切る。
  const edge = {
    borderRadius: radius + 1,
    borderWidth: 1,
    borderColor: compact ? colors.surface : colors.background,
  };
  return (
    <View
      style={compact ? styles.compactStack : styles.stack}
      accessible={false}
    >
      <View
        style={[
          styles.layer,
          styles.back,
          { top: 0, right: 0, bottom: step * 2, left: step * 2 },
          { borderRadius: radius },
        ]}
      />
      <View
        style={[
          styles.layer,
          styles.middle,
          { top: step - 1, right: step - 1, bottom: step - 1, left: step - 1 },
          edge,
        ]}
      />
      <View
        style={[
          styles.layer,
          { top: step * 2 - 1, right: step * 2 - 1, bottom: -1, left: -1 },
          edge,
        ]}
      >
        <BookCover {...cover} compact={compact} fill />
        {!compact && (
          <View style={styles.count}>
            <Icon name="layers" size={11} color={colors.text} />
            <Text style={styles.countLabel}>{count}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 単体の表紙と同じ外形。中身はこの中に重ねる。
  stack: { alignSelf: "stretch", aspectRatio: 2 / 3 },
  compactStack: { width: 40, aspectRatio: 2 / 3 },
  layer: { position: "absolute", overflow: "hidden" },
  back: { backgroundColor: colors.selected },
  middle: { backgroundColor: colors.border },
  fill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: undefined,
    aspectRatio: undefined,
    alignSelf: "auto",
  },
  // 冊数: 表紙の右上。どんな表紙の上でも読めるように、背景の色の面に載せる。
  count: {
    position: "absolute",
    top: 5,
    right: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
    backgroundColor: `${colors.background}E6`,
  },
  countLabel: { color: colors.text, fontWeight: "600", fontSize: 10 },
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
