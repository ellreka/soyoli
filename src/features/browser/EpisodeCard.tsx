import { StyleSheet, Text, View } from "react-native";
import { NativeButton } from "@/components/NativeButton";

import { IconButton } from "@/components/IconButton";
import { colors } from "@/constants/theme";
import type { WebEpisode } from "@/features/web/episode";

interface EpisodeCardProps {
  episode: WebEpisode;
  /** 作品が本棚にあるかどうか。 */
  bookmarked: boolean;
  onBookmark: (on: boolean) => void;
  onOpen: () => void;
}

/**
 * 対応サイトの話を開いている間、ページの下に浮かぶカード: ビューアーで読む、
 * 作品をブックマークして本棚に入れる。幅は中身に合わせ、全幅にはしない。
 */
export function EpisodeCard({
  episode,
  bookmarked,
  onBookmark,
  onOpen,
}: EpisodeCardProps) {
  const heading = [episode.chapterTitle, episode.title]
    .filter(Boolean)
    .join(" · ");
  // 短編のタイトルは作品タイトルと同じ。1 回だけ出す。
  const details = [
    episode.title === episode.workTitle ? "" : episode.workTitle,
    episode.author,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    // ラッパーがページの幅いっぱいなのは、カードを中央に置くためだけ。
    // カードの横へのタッチはページに抜ける。
    <View pointerEvents="box-none" style={styles.anchor}>
      <View testID="episode-card" style={styles.card}>
        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.title}>
            {heading}
          </Text>
          {details ? (
            <Text numberOfLines={1} style={styles.details}>
              {details}
            </Text>
          ) : null}
        </View>
        <IconButton
          icon={bookmarked ? "bookmark-on" : "bookmark"}
          label={bookmarked ? "本棚から削除" : "本棚に追加"}
          onPress={() => {
            onBookmark(!bookmarked);
          }}
        />
        <NativeButton
          label="リーダーで開く"
          accessibilityLabel={`${episode.title}をリーダーで開く`}
          onPress={onOpen}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: "center",
  },
  card: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    // どんな色のページの上でも、カードを浮き上がらせる。
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: { flexShrink: 1, gap: 2, marginRight: 4 },
  title: { color: colors.text, fontWeight: "600", fontSize: 14 },
  details: { color: colors.secondary, fontWeight: "400", fontSize: 11 },
});
