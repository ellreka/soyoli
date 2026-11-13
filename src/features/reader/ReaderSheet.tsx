import {
  BottomSheet,
  Column,
  Host,
  List,
  ListItem,
  RNHostView,
  Row,
  Spacer,
  Text as UIText,
} from "@expo/ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Pressable } from "@/components/Pressable";
import { SelectionMark } from "@/components/SelectionMark";
import {
  NativeList,
  rowModifiers,
  sheetHeaderModifiers,
} from "@/components/NativeList";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { isTocPageUrl } from "@/features/web/episode";
import { usePlayback } from "@/features/player/Playback";
import { DisplaySettings } from "@/features/reader/DisplaySettings";
import { AudioSettings } from "@/features/player/AudioSettings";

export type Sheet =
  | "audio"
  | "timer"
  | "contents"
  | "display"
  | "paragraph"
  | null;
type Choice = {
  key: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 押した後もシートを開いたままにする（目次の「次の100話」の行）。 */
  keepOpen?: boolean;
};

const titles: Record<Exclude<Sheet, null>, string> = {
  audio: "音声設定",
  timer: "タイマー",
  contents: "目次",
  display: "リーダー設定",
  paragraph: "段落",
};

function useChoices(
  sheet: Sheet,
  onExpandToc?: (url: string) => void,
): Choice[] {
  const playback = usePlayback();
  const { state, timer } = playback;
  if (sheet === "timer") {
    return [
      {
        key: "off",
        label: "オフ",
        selected: timer === null,
        onPress: () => {
          playback.setSleepTimer(null);
        },
      },
      ...[5, 10, 20, 30, 60].map((minutes) => ({
        key: String(minutes),
        label: `${minutes}分`,
        selected: false,
        onPress: () => {
          playback.setSleepTimer(Date.now() + minutes * 60_000);
        },
      })),
      {
        key: "chapter",
        label: "この話の終わりまで",
        selected: timer === "chapter",
        onPress: () => {
          playback.setSleepTimer("chapter");
        },
      },
    ];
  }
  if (sheet === "contents") {
    return (state.book?.chapters ?? []).map((item, index) => {
      // 「次の100話」の行は一覧をその場で伸ばす。移動はしない。
      const expandable =
        onExpandToc !== undefined &&
        item.content.length === 0 &&
        isTocPageUrl(item.url);
      return {
        key: item.id,
        label: item.title,
        selected: index === state.chapterIndex,
        keepOpen: expandable,
        onPress: () => {
          if (expandable && item.url) {
            onExpandToc(item.url);
          } else {
            playback.seekChapter(index);
          }
        },
      };
    });
  }
  return [];
}

const halfOrFull: ("half" | "full")[] = ["half", "full"];
const fullOnly: "full"[] = ["full"];

/** 目次の 1 行の高さ。タイトルは 1 行。 */
const contentsRow = 52;

interface ContentsListProps {
  choices: Choice[];
  /** シートが出ている: 出てくるたびに、一覧を所定の位置に戻す。 */
  presented: boolean;
  /** ナビゲーションボタンやホームインジケーターのための余白。 */
  bottom: number;
  onClose: () => void;
}

/**
 * 目次。読んでいる章が見える範囲の真ん中に来るように開くので、本がどれだけ
 * 長くても、前後の章がひと目で分かる。プラットフォームのリスト（Expo UI）は
 * ここからスクロールさせられないので、これはプラットフォームのシートに
 * 入れた React Native のリスト。読んでいる章は一段明るく塗る: 設定ではなく、
 * 場所を示すもの。
 */
function ContentsList({
  choices,
  presented,
  bottom,
  onClose,
}: ContentsListProps) {
  const list = useRef<FlatList<Choice>>(null);
  const height = useRef(0);
  const pending = useRef(false);
  const current = choices.findIndex((choice) => choice.selected);
  const center = useCallback(() => {
    if (!pending.current || height.current === 0) {
      return;
    }
    pending.current = false;
    if (current > 0) {
      list.current?.scrollToIndex({
        index: current,
        viewPosition: 0.5,
        animated: false,
      });
    }
  }, [current]);
  // 出てくるときだけ: シートが開いている間、一覧は読者がスクロールした
  // 位置にとどまる。読み上げが別の章へ進んでも同じ。
  const wasPresented = useRef(false);
  useEffect(() => {
    if (presented && !wasPresented.current) {
      pending.current = true;
      center();
    }
    wasPresented.current = presented;
  }, [presented, center]);

  return (
    <FlatList
      ref={list}
      testID="player-sheet-list"
      nestedScrollEnabled
      data={choices}
      keyExtractor={(choice) => choice.key}
      style={styles.sheet}
      contentContainerStyle={{ paddingBottom: bottom + 12 }}
      getItemLayout={(_, index) => ({
        length: contentsRow,
        offset: contentsRow * index,
        index,
      })}
      onLayout={(event) => {
        height.current = event.nativeEvent.layout.height;
        center();
      }}
      renderItem={({ item: choice }) => (
        <Pressable
          testID={`sheet-row-${choice.key}`}
          accessibilityRole="radio"
          accessibilityLabel={choice.label}
          accessibilityState={{ checked: choice.selected }}
          onPress={() => {
            choice.onPress();
            if (!choice.keepOpen) {
              onClose();
            }
          }}
          style={[styles.contentsRow, choice.selected && styles.contentsHere]}
        >
          <Text numberOfLines={1} style={styles.contentsTitle}>
            {choice.label}
          </Text>
        </Pressable>
      )}
    />
  );
}

interface ReaderSheetProps {
  sheet: Sheet;
  onChange: (sheet: Sheet) => void;
  /** 「次の100話」の行から目次の窓を広げる。シートは開いたまま。 */
  onExpandToc?: (url: string) => void;
  /** 「段落」シートに出すもの: 長押しされた文章とそのアクション。 */
  paragraphMenu?: ReactNode;
}

export function ReaderSheet({
  sheet,
  onChange,
  onExpandToc,
  paragraphMenu,
}: ReaderSheetProps) {
  // シートは画面の下端まで届く。最後の行が Android のナビゲーションボタンや
  // ホームインジケーターにかからない位置までスクロールできるようにする。
  const insets = useSafeAreaInsets();
  // ネイティブの閉じるアニメーションの間ずっと、中身を見せたままにする。
  const [contentSheet, setContentSheet] = useState(sheet);
  if (sheet !== null && sheet !== contentSheet) {
    setContentSheet(sheet);
  }
  const choices = useChoices(contentSheet, onExpandToc);
  const { stopPreview } = usePlayback();
  function close() {
    stopPreview();
    onChange(null);
  }

  return (
    // Android ではネイティブの Compose ホストが、上に来たタッチをすべて
    // 飲み込む。そこで RN のラッパーがヒットテストを切り替える: 待機中は
    // タッチがリーダーへ抜け、表示中はシートが画面を受け持つ。
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={sheet !== null ? "auto" : "none"}
    >
      <Host
        colorScheme="dark"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <BottomSheet
          testID="player-sheet"
          isPresented={sheet !== null}
          onDismiss={close}
          // Android は半分だけ開いたシートを全体の高さでレイアウトし、その上半分を
          // 見せる: 一覧の真ん中が画面の外になってしまう。そこでは目次を全体の
          // 高さで開く。長い目次にもそのほうが合う。
          snapPoints={
            Platform.OS === "android" && contentSheet === "contents"
              ? fullOnly
              : halfOrFull
          }
          contentPadding={0}
          containerColor={colors.surface}
        >
          {/* どのシートも同じレイアウト: プラットフォーム自身のヘッダー、
          続いてプラットフォームの行か、— React Native の部品でできた
          2 つの設定シートでは — ホストしたスクロールビュー。 */}
          <Column>
            <Row
              alignment="center"
              style={nativeHeader}
              modifiers={sheetHeaderModifiers}
            >
              <UIText textStyle={nativeTitle}>
                {contentSheet ? titles[contentSheet] : ""}
              </UIText>
              <Spacer flexible />
            </Row>
            {contentSheet === "timer" && (
              <UIText textStyle={nativeNote} style={nativeNotePadding}>
                時間になったら、読み上げ中の段落が終わってから停止します。
              </UIText>
            )}
            {contentSheet === "paragraph" && paragraphMenu}
            {contentSheet === "contents" && (
              <RNHostView>
                <ContentsList
                  choices={choices}
                  presented={sheet === "contents"}
                  bottom={insets.bottom}
                  onClose={close}
                />
              </RNHostView>
            )}
            {contentSheet === "timer" && (
              <NativeList testID="player-sheet-list">
                <List.ForEach
                  data={choices}
                  keyExtractor={(choice) => choice.key}
                >
                  {({ item: choice }) => (
                    <ListItem
                      testID={`sheet-row-${choice.key}`}
                      // 選択肢にはリングが付き、選ばれたものは塗りつぶされる。
                      leading=<SelectionMark selected={choice.selected} />
                      modifiers={rowModifiers}
                      colors={sheetRowColors}
                      onPress={() => {
                        choice.onPress();
                        if (!choice.keepOpen) {
                          close();
                        }
                      }}
                    >
                      {choice.label}
                    </ListItem>
                  )}
                </List.ForEach>
              </NativeList>
            )}
            {(contentSheet === "audio" || contentSheet === "display") && (
              <RNHostView>
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  style={styles.sheet}
                  contentContainerStyle={{
                    // ヘッダーのタイトルと位置を揃える。
                    paddingHorizontal: 24,
                    paddingTop: 12,
                    paddingBottom: insets.bottom + 12,
                  }}
                >
                  {contentSheet === "audio" ? (
                    <AudioSettings
                      onLeave={() => {
                        onChange(null);
                      }}
                    />
                  ) : (
                    <DisplaySettings />
                  )}
                </ScrollView>
              </RNHostView>
            )}
          </Column>
        </BottomSheet>
      </Host>
    </View>
  );
}

// ネイティブ（Expo UI）部品のスタイル。StyleSheet の項目ではなく
// 素のオブジェクト。
const nativeHeader = { paddingHorizontal: 20, paddingTop: 12 };
const nativeTitle = {
  color: colors.text,
  fontSize: 17,
  fontWeight: "600",
} as const;
/** Android: 行は Material 自身のサーフェスではなく、シートの面に載る。 */
const sheetRowColors = {
  containerColor: colors.surface,
  contentColor: colors.text,
  trailingContentColor: colors.text,
};
const nativeNote = { color: colors.secondary, fontSize: 13 };
const nativeNotePadding = { paddingHorizontal: 20, paddingBottom: 8 };

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.surface },
  contentsRow: {
    height: contentsRow,
    justifyContent: "center",
    // ヘッダーのタイトルと位置を揃える。
    paddingHorizontal: 20,
  },
  contentsHere: { backgroundColor: colors.selected },
  contentsTitle: { color: colors.text, fontSize: 16 },
});
