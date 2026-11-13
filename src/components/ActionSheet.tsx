import {
  BottomSheet,
  Column,
  Host,
  ListItem,
  RNHostView,
  Row,
  Spacer,
  Text as UIText,
  type SnapPoint,
} from "@expo/ui";
import * as Clipboard from "expo-clipboard";
import { useState, type ReactNode } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { NativeList, rowModifiers, sheetHeaderModifiers } from "./NativeList";
import { Pressable } from "./Pressable";

export interface SheetAction {
  key: string;
  label: string;
  /** 表示はされるが、選べない。 */
  disabled?: boolean;
  onPress: () => void;
}

/** その対象についての事実 1 つ: 何であるかと、その値。 */
export interface SheetDetail {
  label: string;
  value: string;
  /** 行を押すとこの文字列をコピーする（短くした表示の裏にある完全な URL）。 */
  copy?: string;
}

interface DetailsProps {
  details: SheetDetail[];
}

const vertical = { vertical: true };
/**
 * Android はシートを中身に合わせる: 開くときは画面の半分までで、それより
 * 高いシートは自分の高さまで引き上げられる。iOS は画面の半分で止まり、
 * 長いメニューはそこでスクロールし、画面いっぱいまで引き上げられる。
 */
const snapPoints: SnapPoint[] | undefined =
  Platform.OS === "android" ? undefined : ["half", "full"];

/**
 * 事実を表にしたもの: 片方の列にラベル、もう片方に値。コピーするものが
 * ある行はボタンで、コピーしたらそのことを表示する。
 */
function Details({ details }: DetailsProps) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <RNHostView matchContents={vertical}>
      <View style={styles.area}>
        <View testID="action-sheet-details" style={styles.table}>
          {details.map((detail, index) => {
            const cells = (
              <>
                <Text style={styles.label}>{detail.label}</Text>
                <Text style={styles.value} numberOfLines={2}>
                  {detail.value}
                </Text>
              </>
            );
            const rowStyle = [styles.row, index > 0 && styles.divided];
            if (detail.copy === undefined) {
              return (
                <View key={detail.label} style={rowStyle}>
                  {cells}
                </View>
              );
            }
            const text = detail.copy;
            return (
              <Pressable
                key={detail.label}
                accessibilityRole="button"
                accessibilityLabel={`${detail.label}をコピー`}
                onPress={() => {
                  Clipboard.setStringAsync(text).catch(() => undefined);
                  setCopied(detail.label);
                }}
                style={rowStyle}
              >
                {cells}
                <Text style={styles.copy}>
                  {copied === detail.label ? "コピー済み" : "コピー"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </RNHostView>
  );
}

/**
 * アクションの行。リストは与えられた高さをすべて埋めるので、Android では
 * シートが画面いっぱいに伸びてしまう。そこでは行をそのままシートの列に
 * 並べ、シートは行に必要な高さになる。
 */
function Actions({ children }: { children: ReactNode }) {
  return Platform.OS === "android" ? (
    children
  ) : (
    <NativeList testID="action-sheet-list">{children}</NativeList>
  );
}

/** シートが何についてのものかと、それに対してできること。 */
export interface SheetMenu {
  title: string;
  /** その対象についての事実。タイトルの下に表で出る。 */
  details?: SheetDetail[];
  actions: SheetAction[];
}

interface ActionSheetProps {
  /** 表示するメニュー。null ならシートは出ない。 */
  menu: SheetMenu | null;
  onClose: () => void;
}

/**
 * 1 つの対象（長押しされた作品、リスト自身のメニュー）に対するアクションの
 * ボトムシート: プラットフォームのシートにプラットフォームの行。アクションを
 * 選ぶと、まずシートが閉じる。
 */
export function ActionSheet({ menu, onClose }: ActionSheetProps) {
  // シートは画面の下端まで届く。最後の行が Android のナビゲーションボタンや
  // ホームインジケーターにかからないようにする。
  const insets = useSafeAreaInsets();
  // ネイティブの閉じるアニメーションの間ずっと、中身を見せたままにする。
  const [shown, setShown] = useState(menu);
  if (menu !== null && menu !== shown) {
    setShown(menu);
  }
  return (
    // Android ではネイティブの Compose ホストが、上に来たタッチをすべて
    // 飲み込む。そこで RN のラッパーがヒットテストを切り替える: 待機中は
    // タッチが下の画面へ抜け、表示中はシートが受け取る。
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={menu !== null ? "auto" : "none"}
    >
      <Host
        colorScheme="dark"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <BottomSheet
          testID="action-sheet"
          isPresented={menu !== null}
          onDismiss={onClose}
          snapPoints={snapPoints}
          contentPadding={{ bottom: insets.bottom + 8 }}
          containerColor={colors.surface}
        >
          <Column>
            <Row
              alignment="center"
              style={header}
              modifiers={sheetHeaderModifiers}
            >
              <UIText textStyle={title}>{shown?.title ?? ""}</UIText>
              <Spacer flexible />
            </Row>
            {shown?.details && shown.details.length > 0 && (
              // メニューごとに新しい表にする:「コピーしました」は表示中の表のもの。
              <Details key={shown.title} details={shown.details} />
            )}
            <Actions>
              {(shown?.actions ?? []).map((action) => (
                <ListItem
                  key={action.key}
                  testID={`action-${action.key}`}
                  modifiers={rowModifiers}
                  colors={action.disabled ? disabledColors : rowColors}
                  onPress={
                    action.disabled
                      ? undefined
                      : () => {
                          onClose();
                          action.onPress();
                        }
                  }
                >
                  {action.label}
                </ListItem>
              ))}
            </Actions>
          </Column>
        </BottomSheet>
      </Host>
    </View>
  );
}

// ネイティブ（Expo UI）部品のスタイル。StyleSheet の項目ではなく素のオブジェクト。
const header = { paddingHorizontal: 16, paddingTop: 12 };
const title = { color: colors.text, fontSize: 17, fontWeight: "600" } as const;
/** Android: 行は Material 自身のサーフェスではなく、シートの面に載る。 */
const rowColors = {
  containerColor: colors.surface,
  contentColor: colors.text,
};
// 無効状態は別の色ではなく不透明度で表す（theme を参照）。
const disabledColors = { ...rowColors, contentColor: `${colors.text}66` };

const styles = StyleSheet.create({
  // 余白は padding で取る: ホストされたビューは margin 抜きで計測される。
  area: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  // 2 つの面のうち暗いほうで、シートにはめ込む。
  table: {
    borderRadius: 10,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  row: {
    // 操作部品の 44pt より低い: ほとんどの行は読むだけで、シートが画面の
    // 半分を超えないほうがよい。
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // すべてのラベルを同じ幅にして、値が 1 列に揃うようにする。
  label: { width: 92, color: colors.secondary, fontSize: 13 },
  // 隣のセルに場所を譲る: 切られるのは長いアドレスで、隣ではない。
  value: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    color: colors.text,
    fontSize: 14,
  },
  // どちらの文言でも収まる幅: 文字が変わっても行のレイアウトをやり直さない。
  copy: {
    width: 64,
    textAlign: "right",
    color: colors.secondary,
    fontSize: 12,
  },
});
