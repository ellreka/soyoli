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
import { useCallback, useRef, useState, type ReactNode } from "react";
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

const contentsRow = 52;

interface ContentsListProps {
  choices: Choice[];
  bottom: number;
  onClose: () => void;
}

// WORKAROUND: プラットフォームのリスト（Expo UI）はここからスクロールさせられない。目次はシートに入れた React Native のリストにする。
function ContentsList({ choices, bottom, onClose }: ContentsListProps) {
  const list = useRef<FlatList<Choice>>(null);
  const height = useRef(0);
  const pending = useRef(true);
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
  onExpandToc?: (url: string) => void;
  paragraphMenu?: ReactNode;
}

export function ReaderSheet({
  sheet,
  onChange,
  onExpandToc,
  paragraphMenu,
}: ReaderSheetProps) {
  const insets = useSafeAreaInsets();
  const [contentSheet, setContentSheet] = useState(sheet);
  if (sheet !== null && sheet !== contentSheet) {
    setContentSheet(sheet);
  }
  const [contentsShown, setContentsShown] = useState(sheet === "contents");
  const [contentsOpenings, setContentsOpenings] = useState(0);
  if ((sheet === "contents") !== contentsShown) {
    setContentsShown(sheet === "contents");
    if (sheet === "contents") {
      setContentsOpenings(contentsOpenings + 1);
    }
  }
  const choices = useChoices(contentSheet, onExpandToc);
  const { stopPreview } = usePlayback();
  function close() {
    stopPreview();
    onChange(null);
  }

  return (
    // WORKAROUND: Android の Compose ホストは、上に来たタッチをすべて飲み込む。待機中はタッチをリーダーへ通す。
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
          // WORKAROUND: Android は半分だけ開いたシートを全体の高さでレイアウトし、その上半分を見せるので、一覧の真ん中が画面の外になる。目次は全体の高さで開く。
          snapPoints={
            Platform.OS === "android" && contentSheet === "contents"
              ? fullOnly
              : halfOrFull
          }
          contentPadding={0}
          containerColor={colors.surface}
        >
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
                  key={contentsOpenings}
                  choices={choices}
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

const nativeHeader = { paddingHorizontal: 20, paddingTop: 12 };
const nativeTitle = {
  color: colors.text,
  fontSize: 17,
  fontWeight: "600",
} as const;
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
    paddingHorizontal: 20,
  },
  contentsHere: { backgroundColor: colors.selected },
  contentsTitle: { color: colors.text, fontSize: 16 },
});
