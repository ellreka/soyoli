import { useState, type ReactNode } from "react";
import { Link, useIsFocused, useNavigation } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import {
  ActionSheet,
  type SheetAction,
  type SheetDetail,
  type SheetMenu,
} from "@/components/ActionSheet";
import { Icon } from "@/components/Icon";
import { IconButton } from "@/components/IconButton";
import { NativeButton } from "@/components/NativeButton";
import { NativeTextField } from "@/components/NativeTextField";
import { Pressable } from "@/components/Pressable";
import { RowGroup } from "@/components/RowGroup";
import { EmptyState, Screen, Section } from "@/components/Screen";
import { colors } from "@/constants/theme";
import { onHardwareBack } from "@/lib/hardwareBack";
import { useSubscription } from "@/lib/subscription";
import { usePlayback } from "@/features/player/Playback";
import { displayUrl } from "@/features/web/browser";
import { openInBrowser } from "@/features/web/openBrowser";
import { BookCover, SeriesCover } from "./BookCover";
import { isWebNovel, sourceName, type Book } from "@/features/books/book";
import { bySeries, isSeries, type Series } from "@/features/books/series";
import { byDay, type HistoryItem } from "./history";
import { useLibrary } from "./Library";
import { lastReadChapter } from "./savedWorks";
import { matchesSearch } from "./search";
import { loadShelfView, saveShelfView, type ShelfView } from "./shelfView";

type Tab = "shelf" | "history";

const tabs: { key: Tab; label: string; name: string }[] = [
  { key: "shelf", label: "本棚", name: "本棚の作品" },
  { key: "history", label: "履歴", name: "履歴" },
];
const columns = 3;
const menuHint = "長押しでメニューを開きます";

type ShelfItem = Book | Series;

function rows(items: ShelfItem[]): ShelfItem[][] {
  const result: ShelfItem[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    result.push(items.slice(index, index + columns));
  }
  return result;
}

function volumeCount(series: Series): string {
  return `${series.volumes.length}冊`;
}

function useEpisode(book: Book) {
  const { lastRead } = useLibrary();
  return isWebNovel(book) ? lastReadChapter(book, lastRead) : undefined;
}

interface WorkProps {
  book: Book;
  onMenu: () => void;
}

function BookTile({ book, onMenu }: WorkProps) {
  const episode = useEpisode(book);
  const { revision } = useLibrary();
  return (
    <Link href={{ pathname: "/reader", params: { id: book.id } }} asChild>
      <Pressable
        accessibilityLabel={`${book.title}を開く`}
        accessibilityHint={menuHint}
        onLongPress={onMenu}
        style={styles.tile}
      >
        <BookCover book={book} revision={revision} />
        <Text style={styles.tileTitle} numberOfLines={2}>
          {book.title}
        </Text>
        {book.author !== "" && (
          <Text style={styles.tileDetail} numberOfLines={1}>
            {book.author}
          </Text>
        )}
        {episode && (
          <Text style={styles.tileDetail} numberOfLines={1}>
            {episode.title}
          </Text>
        )}
      </Pressable>
    </Link>
  );
}

interface SeriesProps {
  series: Series;
  onOpen: () => void;
}

function SeriesTile({ series, onOpen }: SeriesProps) {
  const { revision } = useLibrary();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${series.title}の巻を見る`}
      accessibilityHint={volumeCount(series)}
      onPress={onOpen}
      style={styles.tile}
    >
      <SeriesCover
        book={series.latest}
        count={series.volumes.length}
        revision={revision}
      />
      <Text style={styles.tileTitle} numberOfLines={2}>
        {series.title}
      </Text>
      {series.author !== "" && (
        <Text style={styles.tileDetail} numberOfLines={1}>
          {series.author}
        </Text>
      )}
    </Pressable>
  );
}

function SeriesRow({ series, onOpen }: SeriesProps) {
  const { revision } = useLibrary();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${series.title}の巻を見る`}
      onPress={onOpen}
      style={styles.workRow}
    >
      <SeriesCover
        book={series.latest}
        count={series.volumes.length}
        compact
        revision={revision}
      />
      <View style={styles.workText}>
        <Text style={styles.workTitle} numberOfLines={1}>
          {series.title}
        </Text>
        <Text style={styles.workDetail} numberOfLines={1}>
          {[series.author, volumeCount(series)].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Icon name="chevron-right" size={16} color={colors.secondary} />
    </Pressable>
  );
}

interface ShelfItemsProps {
  items: ShelfItem[];
  onMenu: (book: Book) => void;
  onOpenSeries: (series: Series) => void;
}

function Grid({ items, onMenu, onOpenSeries }: ShelfItemsProps) {
  return (
    <View style={styles.grid}>
      {rows(items).map((row) => (
        <View key={row[0].id} style={styles.gridRow}>
          {row.map((item) =>
            isSeries(item) ? (
              <SeriesTile
                key={item.id}
                series={item}
                onOpen={() => {
                  onOpenSeries(item);
                }}
              />
            ) : (
              <BookTile
                key={item.id}
                book={item}
                onMenu={() => {
                  onMenu(item);
                }}
              />
            ),
          )}
          {Array.from({ length: columns - row.length }, (_, index) => (
            <View key={index} style={styles.tile} />
          ))}
        </View>
      ))}
    </View>
  );
}

interface WorkRowProps extends WorkProps {
  details: string[];
  leading?: ReactNode;
  trailing?: ReactNode;
}

function WorkRow({ book, details, leading, trailing, onMenu }: WorkRowProps) {
  return (
    <Link href={{ pathname: "/reader", params: { id: book.id } }} asChild>
      <Pressable
        accessibilityLabel={`${book.title}を開く`}
        accessibilityHint={menuHint}
        onLongPress={onMenu}
        style={styles.workRow}
      >
        {leading}
        <View style={styles.workText}>
          <Text style={styles.workTitle} numberOfLines={1}>
            {book.title}
          </Text>
          {details.map((detail) => (
            <Text key={detail} style={styles.workDetail} numberOfLines={1}>
              {detail}
            </Text>
          ))}
        </View>
        {trailing}
      </Pressable>
    </Link>
  );
}

function ShelfRow({ book, onMenu }: WorkProps) {
  const episode = useEpisode(book);
  const { revision } = useLibrary();
  return (
    <WorkRow
      book={book}
      onMenu={onMenu}
      leading=<BookCover book={book} compact revision={revision} />
      details={[
        [book.author, isWebNovel(book) ? sourceName(book.source) : ""]
          .filter(Boolean)
          .join(" · "),
        ...(episode ? [episode.title] : []),
      ]}
    />
  );
}

function ShelfItems({
  view,
  items,
  onMenu,
  onOpenSeries,
}: ShelfItemsProps & { view: ShelfView }) {
  if (view === "grid") {
    return <Grid items={items} onMenu={onMenu} onOpenSeries={onOpenSeries} />;
  }
  return (
    <RowGroup>
      {items.map((item) =>
        isSeries(item) ? (
          <SeriesRow
            key={item.id}
            series={item}
            onOpen={() => {
              onOpenSeries(item);
            }}
          />
        ) : (
          <ShelfRow
            key={item.id}
            book={item}
            onMenu={() => {
              onMenu(item);
            }}
          />
        ),
      )}
    </RowGroup>
  );
}

function HistoryRow({ book, onMenu }: WorkProps) {
  const { isBookmarked, setBookmarked } = useLibrary();
  const episode = useEpisode(book);
  return (
    <WorkRow
      book={book}
      onMenu={onMenu}
      details={[
        [sourceName(book.source), episode?.title].filter(Boolean).join(" · "),
      ]}
      trailing={
        isBookmarked(book.id) ? (
          <Text style={styles.onShelf}>本棚にあります</Text>
        ) : (
          <NativeButton
            label="本棚に追加"
            accessibilityLabel={`${book.title}を本棚に追加`}
            variant="outlined"
            onPress={() => {
              setBookmarked(book, true);
            }}
          />
        )
      }
    />
  );
}

export default function BookshelfScreen() {
  const library = useLibrary();
  const { closeBook } = usePlayback();
  function unshelve(book: Book): void {
    if (!isWebNovel(book)) {
      library.removeFileBook(book.id);
    } else {
      library.setBookmarked(book, false);
    }
    closeBook(book.id);
  }
  const { lastRead } = library;
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const shelf = library.shelf.filter((book) => matchesSearch(book, query));
  const recent = library.recent.filter((item) =>
    matchesSearch(item.book, query),
  );
  const filtered = query.trim() !== "";
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const series = bySeries(library.shelf)
    .filter(isSeries)
    .find((item) => item.id === seriesId);
  const inSeries = series !== undefined;
  const focused = useIsFocused();
  const [backToShelf] = useState(() =>
    onHardwareBack(() => {
      setSeriesId(null);
      return true;
    }),
  );
  useSubscription(focused && inSeries ? backToShelf : null);
  const navigation = useNavigation();
  const [shelfOnTabPress] = useState(
    () => () =>
      navigation.addListener("tabPress" as never, () => {
        setSeriesId(null);
      }),
  );
  useSubscription(shelfOnTabPress);
  const [tab, setTab] = useState<Tab>("shelf");
  const [view, setView] = useState<ShelfView>(loadShelfView);
  const [menu, setMenu] = useState<SheetMenu | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  function changeView(next: ShelfView) {
    setView(next);
    saveShelfView(next);
  }

  function siteAction(book: Book): SheetAction[] {
    const url = lastReadChapter(book, lastRead)?.url ?? book.url;
    if (!isWebNovel(book) || !url) {
      return [];
    }
    return [
      {
        key: "site",
        label: "元のサイトで開く",
        onPress: () => {
          openInBrowser(url);
        },
      },
    ];
  }

  function facts(book: Book): SheetDetail[] {
    const web = isWebNovel(book);
    const episode = web ? lastReadChapter(book, lastRead) : undefined;
    const url = episode?.url ?? book.url;
    const site = web ? sourceName(book.source) : undefined;
    return [
      ...(book.author ? [{ label: "著者", value: book.author }] : []),
      ...(site ? [{ label: "サイト", value: site }] : []),
      ...(episode ? [{ label: "読んでいる話", value: episode.title }] : []),
      ...(web && url
        ? [{ label: "URL", value: displayUrl(url), copy: url }]
        : []),
    ];
  }

  function shelfMenu(book: Book): SheetMenu {
    return {
      title: book.title,
      details: facts(book),
      actions: [
        ...siteAction(book),
        {
          key: "unshelve",
          label: "本棚から削除",
          onPress: () => {
            if (isWebNovel(book)) {
              unshelve(book);
              return;
            }
            Alert.alert(
              "本棚から削除しますか？",
              `「${book.title}」と、取り込んだファイルを端末から削除します。読んでいた位置と辞書は残ります。`,
              [
                { text: "キャンセル", style: "cancel" },
                {
                  text: "削除",
                  style: "destructive",
                  onPress: () => {
                    unshelve(book);
                  },
                },
              ],
            );
          },
        },
      ],
    };
  }

  function historyMenu({ book }: HistoryItem): SheetMenu {
    const onShelf = library.isBookmarked(book.id);
    return {
      title: book.title,
      details: facts(book),
      actions: [
        {
          key: onShelf ? "unshelve" : "shelve",
          label: onShelf ? "本棚から削除" : "本棚に追加",
          onPress: () => {
            library.setBookmarked(book, !onShelf);
            if (onShelf) {
              closeBook(book.id);
            }
          },
        },
        ...siteAction(book),
        {
          key: "forget",
          label: "履歴から削除",
          onPress: () => {
            library.removeHistory(book.id);
          },
        },
      ],
    };
  }

  const historyActions: SheetMenu = {
    title: "履歴",
    actions: [
      {
        key: "clear",
        label: "すべての履歴を削除",
        onPress: () => {
          Alert.alert(
            "すべての履歴を削除しますか？",
            "本棚の作品と、読んでいた位置は消えません。この操作は取り消せません。",
            [
              { text: "キャンセル", style: "cancel" },
              {
                text: "削除",
                style: "destructive",
                onPress: library.clearHistory,
              },
            ],
          );
        },
      },
    ],
  };

  const viewToggle = (
    <IconButton
      icon={view === "grid" ? "list" : "grid"}
      label={view === "grid" ? "リスト表示にする" : "グリッド表示にする"}
      size={20}
      color={colors.secondary}
      onPress={() => {
        changeView(view === "grid" ? "list" : "grid");
      }}
    />
  );
  const sheet = (
    <ActionSheet
      menu={menu}
      onClose={() => {
        setMenu(null);
      }}
    />
  );

  const volumes = series && (
    <Screen
      title={series.title}
      subtitle={[series.author, volumeCount(series)]
        .filter(Boolean)
        .join(" · ")}
      onBack={() => {
        setSeriesId(null);
      }}
    >
      <View style={styles.bar}>
        <Text style={styles.barLabel}>巻の順</Text>
        {viewToggle}
      </View>
      <ShelfItems
        view={view}
        items={series.volumes}
        onMenu={(book) => {
          setMenu(shelfMenu(book));
        }}
        onOpenSeries={() => undefined}
      />
    </Screen>
  );

  return (
    <View style={styles.root}>
      <View
        style={[styles.root, inSeries && styles.hidden]}
        accessibilityElementsHidden={inSeries}
        importantForAccessibility={inSeries ? "no-hide-descendants" : "auto"}
      >
        <Screen
          title="本棚"
          actions=<IconButton
            icon={searching ? "x" : "search"}
            label={searching ? "検索を閉じる" : "検索"}
            onPress={() => {
              setSearching(!searching);
              setQuery("");
            }}
          />
          refreshing={refreshing}
          onRefresh={() => {
            library.reload();
            setNow(Date.now());
            setRefreshing(true);
            setTimeout(() => {
              setRefreshing(false);
            }, 500);
          }}
        >
          <View style={styles.controls}>
            {searching && (
              <View style={styles.field}>
                <Icon name="search" size={16} color={colors.secondary} />
                <NativeTextField
                  accessibilityLabel="作品を検索"
                  placeholder="書名・著者で検索"
                  returnKeyType="search"
                  autoFocus
                  onChangeText={setQuery}
                />
              </View>
            )}
            <View style={styles.tabs} accessibilityRole="tablist">
              {tabs.map((item) => (
                <View key={item.key} style={styles.tab}>
                  <NativeButton
                    label={item.label}
                    accessibilityLabel={item.name}
                    variant="outlined"
                    role="tab"
                    selected={item.key === tab}
                    fill
                    onPress={() => {
                      setTab(item.key);
                      setNow(Date.now());
                    }}
                  />
                </View>
              ))}
            </View>
            <View style={styles.bar}>
              <Text style={styles.barLabel}>
                {tab === "shelf" ? "最近開いた順" : "読んだ順"}
              </Text>
              {tab === "shelf" ? (
                viewToggle
              ) : (
                <IconButton
                  icon="ellipsis"
                  label="履歴のメニュー"
                  size={20}
                  color={colors.secondary}
                  disabled={library.recent.length === 0}
                  onPress={() => {
                    setMenu(historyActions);
                  }}
                />
              )}
            </View>
          </View>
          {tab === "shelf" && shelf.length > 0 && (
            <ShelfItems
              view={view}
              items={bySeries(shelf)}
              onMenu={(book) => {
                setMenu(shelfMenu(book));
              }}
              onOpenSeries={(item) => {
                setSeriesId(item.id);
              }}
            />
          )}
          {filtered && (tab === "shelf" ? shelf : recent).length === 0 && (
            <EmptyState
              icon="search"
              title="見つかりませんでした"
              description="書名か著者の一部を入れてください。"
            />
          )}
          {tab === "shelf" && !filtered && shelf.length === 0 && (
            <EmptyState
              icon="library"
              title="本棚は空です"
              description="ホームでWeb小説を探すか、ファイルを取り込むと、ここに並びます。"
            />
          )}
          {tab === "history" &&
            byDay(recent, now).map((day) => (
              <Section key={day.label} title={day.label}>
                <RowGroup>
                  {day.items.map((item) => (
                    <HistoryRow
                      key={item.book.id}
                      book={item.book}
                      onMenu={() => {
                        setMenu(historyMenu(item));
                      }}
                    />
                  ))}
                </RowGroup>
              </Section>
            ))}
          {tab === "history" && !filtered && recent.length === 0 && (
            <EmptyState
              icon="library"
              title="履歴はありません"
              description="Web小説を読むと、本棚に追加していない作品もここに並びます。"
            />
          )}
        </Screen>
      </View>
      {volumes}
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: "none" },
  controls: { gap: 4 },
  field: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1 },
  bar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginRight: -10,
  },
  barLabel: { color: colors.secondary, fontWeight: "400", fontSize: 12 },
  grid: { gap: 24 },
  gridRow: { flexDirection: "row", gap: 14 },
  tile: { flex: 1, gap: 6 },
  tileTitle: {
    color: colors.text,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 18,
  },
  tileDetail: { color: colors.secondary, fontWeight: "400", fontSize: 11 },
  workRow: {
    flex: 1,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  workText: { flex: 1, gap: 2 },
  workTitle: { color: colors.text, fontSize: 15, fontWeight: "500" },
  workDetail: { color: colors.secondary, fontSize: 12 },
  onShelf: { color: colors.secondary, fontSize: 12 },
});
