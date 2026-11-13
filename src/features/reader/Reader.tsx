import { useDeferredValue, useState } from "react";
import { NativeRow } from "@/components/NativeRow";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/Pressable";

import { SafeAreaView } from "react-native-safe-area-context";

import {
  awaitsText,
  isWebNovel,
  type Book,
  type Chapter,
} from "@/features/books/book";
import { Icon } from "@/components/Icon";
import { IconButton } from "@/components/IconButton";
import { colors } from "@/constants/theme";
import { useLibrary } from "@/features/library/Library";
import { usePlayback } from "@/features/player/Playback";
import { Player } from "@/features/player/Player";
import { ReaderSheet, type Sheet } from "./ReaderSheet";
import { browseParams } from "@/features/web/browser";
import { openInBrowser } from "@/features/web/openBrowser";
import { ChapterText } from "./ChapterText";
import { fontSizes, lineHeights, themes, useDisplay } from "./Display";
import { dictionaryParams } from "@/features/dictionary/DictionaryEditScreen";
import { useChapterLoader } from "@/features/loading/ChapterLoader";
import { ParagraphMenu } from "./ParagraphMenu";

interface MenuItem {
  label: string;
  onPress: () => void;
}

interface ReaderMenuProps {
  items: MenuItem[];
  onClose: () => void;
}

/** 「…」ボタンの下のポップオーバー。外側のどこをタップしても閉じる。 */
function ReaderMenu({ items, onClose }: ReaderMenuProps) {
  return (
    <>
      <Pressable
        accessible={false}
        feedback={false}
        testID="reader-menu-backdrop"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <View testID="reader-menu" style={styles.menu}>
        {items.map((item) => (
          <NativeRow
            key={item.label}
            title={item.label}
            onPress={() => {
              onClose();
              item.onPress();
            }}
          />
        ))}
      </View>
    </>
  );
}

interface ChapterBodyProps {
  chapter: Chapter | undefined;
  failed: boolean;
  paragraphIndex: number;
  autoScroll: boolean;
  onManualScroll: () => void;
  /** 読む位置を段落へ動かす。そこから読み始めることもできる。 */
  onSeek: (paragraphIndex: number, play: boolean) => void;
  /** 長押しされた段落のアクションを開く。 */
  onMenu: (paragraphIndex: number) => void;
}

/**
 * リーダーの表示設定で組んだ章の本文。または、まだ読み込んでいない Web の
 * 話の取得状態。
 */
function ChapterBody({ chapter, failed, onSeek, ...text }: ChapterBodyProps) {
  const { settings } = useDisplay();
  // 章は何百もの段落でできていて、すべてを一度に描画する。ビューアーの
  // 最初の render からそれを外すと、ビューアーがすぐに現れ（スライドして
  // 入ってき）て、本文は独立した render で後から続く。
  const showText = useDeferredValue(true, false);
  // 1 回のタップで読み始めるか、1 回目で位置を動かして 2 回目で読み始めるか。
  const playOnTap = settings.playOn === "tap";
  const palette = themes[settings.theme];
  const note = [styles.statusText, { color: palette.dimmed }];
  if (!chapter) {
    return (
      <Text style={[styles.empty, note]}>表示できる本文がありません。</Text>
    );
  }
  if (awaitsText(chapter)) {
    return (
      <View style={styles.status}>
        {failed ? (
          <Text style={note}>本文を取得できませんでした。</Text>
        ) : (
          <>
            <ActivityIndicator color={palette.text} />
            <Text style={note}>次の話を取得しています…</Text>
          </>
        )}
      </View>
    );
  }
  if (!showText) {
    return null;
  }
  return (
    <ChapterText
      key={chapter.id}
      chapter={chapter}
      fontSize={fontSizes[settings.fontSize]}
      lineHeight={lineHeights[settings.lineHeight]}
      palette={palette}
      onSelect={(index) => {
        onSeek(index, playOnTap);
      }}
      onPlay={
        playOnTap
          ? undefined
          : (index) => {
              onSeek(index, true);
            }
      }
      {...text}
    />
  );
}

interface ReaderProps {
  book: Book;
  onClose: () => void;
}

/** 共通のビューアー: 章の本文と、その下に固定したプレーヤー。 */
export function Reader({ book, onClose }: ReaderProps) {
  const { state, seekParagraph } = usePlayback();
  const { failedChapter, expandToc, reload } = useChapterLoader();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // アクションを表示している、長押しされた段落。
  const [menuAt, setMenuAt] = useState<{
    chapterId: string;
    index: number;
  } | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const { settings } = useDisplay();
  const { isBookmarked, setBookmarked } = useLibrary();

  if (state.book !== book) {
    return (
      <SafeAreaView style={[styles.screen, styles.status]}>
        <ActivityIndicator color={colors.text} />
        <Text style={styles.statusText}>作品を準備しています。</Text>
      </SafeAreaView>
    );
  }
  const chapter = book.chapters[state.chapterIndex];
  const bookmarked = isBookmarked(book.id);
  // メニューが出ている間に、読み上げが別の章へ進むことがある。そのとき
  // メニューはもう当てはまらない。
  const menuParagraph =
    menuAt && menuAt.chapterId === chapter?.id ? menuAt.index : null;
  const paragraphText =
    menuParagraph === null
      ? undefined
      : state.chapters[state.chapterIndex]?.[menuParagraph]?.text.trim();
  const url = book.url;
  const menuItems: MenuItem[] = [
    {
      // この作品に適用される読みと、作品が使う辞書。
      label: "読み方辞書",
      onPress: () => {
        router.push({
          pathname: "/work-dictionary",
          params: { bookId: book.id },
        });
      },
    },
    // 戻る先の元ページがあるのは Web 小説だけ。
    ...(url
      ? [
          {
            label: "元のサイトで開く",
            onPress: () => {
              // リーダーは、その下のタブにあるブラウザに場所を譲る。
              if (router.canGoBack()) {
                router.back();
                openInBrowser(url);
              } else {
                // 直リンクで開かれ、リーダーの下にまだタブがない: ブラウザと
                // そのタブが、リーダーに取って代わる。
                router.replace({
                  pathname: "/home/browse",
                  params: browseParams(url),
                });
              }
            },
          },
          { label: "再取得", onPress: reload },
          {
            label: "URLをコピー",
            onPress: () => {
              Clipboard.setStringAsync(url).catch(() => undefined);
            },
          },
        ]
      : []),
  ];

  return (
    <SafeAreaView style={styles.screen}>
      {/* すべてをセーフエリアの中の 1 つの箱に入れる。どのプラットフォーム
      でも、メニューの位置をステータスバーの下から測れるようにするため。 */}
      <View style={styles.inner}>
        <View style={styles.header}>
          {/* 矢印とタイトルは 1 つのボタン: どちらもビューアーを閉じる。 */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ビューアーを閉じる"
            onPress={onClose}
            style={styles.close}
          >
            <View style={styles.closeIcon}>
              <Icon name="chevron-down" size={24} />
            </View>
            <View style={styles.titles}>
              <Text style={styles.bookTitle} numberOfLines={1}>
                {book.title}
              </Text>
              <Text
                accessibilityRole="header"
                style={styles.chapterTitle}
                numberOfLines={1}
              >
                {chapter?.title ?? "話がありません"}
              </Text>
            </View>
          </Pressable>
          {isWebNovel(book) && (
            // Web 小説は、ブックマークするまで本棚に入れずに読める。
            <IconButton
              icon={bookmarked ? "bookmark-on" : "bookmark"}
              label={bookmarked ? "本棚から削除" : "本棚に追加"}
              onPress={() => {
                setBookmarked(book, !bookmarked);
              }}
            />
          )}
          <IconButton
            icon="list"
            label="目次"
            onPress={() => {
              setSheet("contents");
            }}
          />
          <IconButton
            icon="type"
            label="リーダー設定"
            onPress={() => {
              setSheet("display");
            }}
          />
          {menuItems.length > 0 && (
            <IconButton
              icon="ellipsis"
              label="その他"
              onPress={() => {
                setMenuOpen(true);
              }}
            />
          )}
        </View>
        <View
          style={[
            styles.body,
            { backgroundColor: themes[settings.theme].background },
          ]}
        >
          <ChapterBody
            chapter={chapter}
            failed={failedChapter === chapter?.url}
            paragraphIndex={state.paragraphIndex}
            autoScroll={autoScroll}
            onManualScroll={() => {
              setAutoScroll(false);
            }}
            onSeek={seekParagraph}
            onMenu={(index) => {
              if (chapter) {
                setMenuAt({ chapterId: chapter.id, index });
                setSheet("paragraph");
              }
            }}
          />
          {!autoScroll && (
            // 素の React Native のピル: 本文の上に浮かぶもので、プラットフォームの
            // ボタンはそういう用途に作られていない。
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="読み上げ位置に戻る"
              onPress={() => {
                setAutoScroll(true);
              }}
              style={styles.follow}
            >
              <Icon name="arrow-down" size={12} />
              <Text style={styles.followLabel}>読み上げ位置へ</Text>
            </Pressable>
          )}
        </View>
        <Player onOpen={setSheet} />
        {menuOpen && (
          <ReaderMenu
            items={menuItems}
            onClose={() => {
              setMenuOpen(false);
            }}
          />
        )}
        <ReaderSheet
          sheet={sheet}
          onChange={setSheet}
          onExpandToc={expandToc}
          paragraphMenu={
            menuParagraph !== null &&
            paragraphText !== undefined && (
              <ParagraphMenu
                key={`${menuAt?.chapterId}:${menuParagraph}`}
                text={paragraphText}
                onPlay={() => {
                  seekParagraph(menuParagraph, true);
                }}
                onCopy={(text) => {
                  Clipboard.setStringAsync(text).catch(() => undefined);
                }}
                onRegister={() => {
                  // 段落はエディタの初期値にすぎない。
                  setSheet(null);
                  router.push({
                    pathname: "/dictionary",
                    params: dictionaryParams({
                      surface: paragraphText,
                      bookId: book.id,
                    }),
                  });
                }}
                onClose={() => {
                  setSheet(null);
                }}
              />
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1 },
  status: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  statusText: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 13,
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  close: { flex: 1, flexDirection: "row", alignItems: "center" },
  closeIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  titles: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 4,
  },
  bookTitle: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 11,
  },
  chapterTitle: {
    flexShrink: 1,
    color: colors.text,
    fontWeight: "600",
    fontSize: 15,
  },
  body: { flex: 1 },
  follow: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  followLabel: { color: colors.text, fontWeight: "500", fontSize: 13 },
  menu: {
    position: "absolute",
    top: 56,
    right: 8,
    minWidth: 180,
    borderRadius: 12,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  empty: { flex: 1, padding: 24 },
});
