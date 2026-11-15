import { useState, type ReactNode } from "react";
import { Link } from "expo-router";
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
import { usePlayback } from "@/features/player/Playback";
import { displayUrl } from "@/features/web/browser";
import { openInBrowser } from "@/features/web/openBrowser";
import { BookCover } from "./BookCover";
import { isWebNovel, sourceLabels, type Book } from "@/features/books/book";
import { byDay, type HistoryItem } from "./history";
import { useLibrary } from "./Library";
import { lastReadChapter } from "./savedWorks";
import { matchesSearch } from "./search";
import { loadShelfView, saveShelfView, type ShelfView } from "./shelfView";

type Tab = "shelf" | "history";

/** 見える言葉と、スクリーンリーダーが読む言葉（タブバーにも 本棚 がある）。 */
const tabs: { key: Tab; label: string; name: string }[] = [
  { key: "shelf", label: "本棚", name: "本棚の作品" },
  { key: "history", label: "履歴", name: "履歴" },
];
const columns = 3;
const menuHint = "長押しでメニューを開きます";

function rows(books: Book[]): Book[][] {
  const result: Book[][] = [];
  for (let index = 0; index < books.length; index += columns) {
    result.push(books.slice(index, index + columns));
  }
  return result;
}

/** Web 小説の中で読者がいる場所: 最後に読んだ話。 */
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
        {/* どの表紙の下にも出す。すでにタイトルが載っているカードでも同じ。 */}
        <Text style={styles.tileTitle} numberOfLines={2}>
          {book.title}
        </Text>
        {/* 読みかけの場所。それができるまでは著者。 */}
        <Text style={styles.tileDetail} numberOfLines={1}>
          {episode?.title ?? book.author}
        </Text>
      </Pressable>
    </Link>
  );
}

function Grid({
  books,
  onMenu,
}: {
  books: Book[];
  onMenu: (book: Book) => void;
}) {
  return (
    <View style={styles.grid}>
      {rows(books).map((row) => (
        <View key={row[0].id} style={styles.gridRow}>
          {row.map((book) => (
            <BookTile
              key={book.id}
              book={book}
              onMenu={() => {
                onMenu(book);
              }}
            />
          ))}
          {Array.from({ length: columns - row.length }, (_, index) => (
            <View key={index} style={styles.tile} />
          ))}
        </View>
      ))}
    </View>
  );
}

interface WorkRowProps extends WorkProps {
  /** タイトルの下の、控えめな行。 */
  details: string[];
  /** 文字の前に出すもの: 本棚のリストでの表紙。 */
  leading?: ReactNode;
  /** 文字の後ろに出すもの。ここのボタンは単独で押される。 */
  trailing?: ReactNode;
}

/**
 * 作品をカードの 1 行にしたもの。行全体が作品を開き、1 つの面として
 * リップルが出る。長押しでメニューが出る。
 */
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
        // サイトは名前を出す価値がある。ファイル由来であることには、ない。
        [book.author, isWebNovel(book) ? sourceLabels[book.source] : ""]
          .filter(Boolean)
          .join(" · "),
        ...(episode ? [episode.title] : []),
      ]}
    />
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
        [sourceLabels[book.source], episode?.title].filter(Boolean).join(" · "),
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

/** 本棚タブ: 読者が残している作品と、読んだ作品。 */
export default function BookshelfScreen() {
  const library = useLibrary();
  const { closeBook } = usePlayback();
  /**
   * 本棚から外し、ミニプレーヤーにあるのがその本ならそこからも外す:
   * 外したばかりのものを、続きを読むものとして出さない。
   */
  function unshelve(book: Book): void {
    if (!isWebNovel(book)) {
      library.removeFileBook(book.id);
    } else {
      library.setBookmarked(book, false);
    }
    closeBook(book.id);
  }
  const { lastRead } = library;
  // 検索の欄は、虫めがねを押している間だけ出る。閉じると言葉も消える。
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const shelf = library.shelf.filter((book) => matchesSearch(book, query));
  const recent = library.recent.filter((item) =>
    matchesSearch(item.book, query),
  );
  const filtered = query.trim() !== "";
  const [tab, setTab] = useState<Tab>("shelf");
  const [view, setView] = useState<ShelfView>(loadShelfView);
  const [menu, setMenu] = useState<SheetMenu | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // 履歴の日付にとっての「今日」。訪れるたびに取り直す。
  const [now, setNow] = useState(() => Date.now());

  function changeView(next: ShelfView) {
    setView(next);
    saveShelfView(next);
  }

  /** 作品を読んだ元のページ。Web 小説の場合。 */
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

  /** 作品について分かっていること。メニューの表に出す。 */
  function facts(book: Book): SheetDetail[] {
    const web = isWebNovel(book);
    const episode = web ? lastReadChapter(book, lastRead) : undefined;
    const url = episode?.url ?? book.url;
    return [
      ...(book.author ? [{ label: "著者", value: book.author }] : []),
      ...(web ? [{ label: "サイト", value: sourceLabels[book.source] }] : []),
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
            // ファイルも一緒に消える。戻すには取り込み直すしかない。
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

  return (
    <View style={styles.root}>
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
        // 引き下げると、本棚を端末から読み直す。
        refreshing={refreshing}
        onRefresh={() => {
          library.reload();
          setNow(Date.now());
          // 読み込みは一瞬で終わる。スピナーは、引き下げへの応答として見える
          // だけの時間残す。
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
              <IconButton
                // 押すと切り替わる先のレイアウトを示す。
                icon={view === "grid" ? "list" : "grid"}
                label={
                  view === "grid" ? "リスト表示にする" : "グリッド表示にする"
                }
                size={20}
                color={colors.secondary}
                onPress={() => {
                  changeView(view === "grid" ? "list" : "grid");
                }}
              />
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
        {tab === "shelf" &&
          shelf.length > 0 &&
          (view === "grid" ? (
            <Grid
              books={shelf}
              onMenu={(book) => {
                setMenu(shelfMenu(book));
              }}
            />
          ) : (
            <RowGroup>
              {shelf.map((book) => (
                <ShelfRow
                  key={book.id}
                  book={book}
                  onMenu={() => {
                    setMenu(shelfMenu(book));
                  }}
                />
              ))}
            </RowGroup>
          ))}
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
      <ActionSheet
        menu={menu}
        onClose={() => {
          setMenu(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  // 端にあるアイコンボタンと同じ高さ。ボタンは余白の端まで届く。
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
