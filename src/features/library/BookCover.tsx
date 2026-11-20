import { Image, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { colors } from "@/constants/theme";
import { listedSites } from "@/features/web/sites";
import { isWebNovel, sourceName, type Book } from "@/features/books/book";

const titleLines = 7;

export function initial(title: string): string {
  return /[\p{L}\p{N}]/u.exec(title)?.[0] ?? "";
}

function SiteIcon({ book }: { book: Book }) {
  const uri = listedSites.find((site) => site.id === book.source)?.iconUrl;
  return uri ? (
    <Image source={{ uri }} style={styles.siteIcon} resizeMode="cover" />
  ) : null;
}

interface BookCoverProps {
  book: Book;
  compact?: boolean;
  revision?: number;
  fill?: boolean;
}

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
          // WORKAROUND: Android の既定のリサイズは、CMYK の JPEG（印刷用の表紙）を落とす。
          resizeMethod="scale"
        />
      ) : (
        <>
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
  count: number;
}

export function SeriesCover({ count, compact, ...cover }: SeriesCoverProps) {
  const step = compact ? 2 : 4;
  const radius = compact ? 4 : 6;
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
  foot: { flexDirection: "row", alignItems: "center", gap: 4 },
  source: {
    flexShrink: 1,
    color: colors.secondary,
    fontWeight: "500",
    fontSize: 10,
  },
  siteIcon: { width: 14, height: 14, borderRadius: 3 },
  badge: { position: "absolute", left: 2, bottom: 2 },
  compact: {
    alignSelf: "auto",
    width: 40,
    padding: 3,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  initial: { color: colors.secondary, fontWeight: "600", fontSize: 20 },
});
