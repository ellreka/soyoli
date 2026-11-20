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
  disabled?: boolean;
  onPress: () => void;
}

export interface SheetDetail {
  label: string;
  value: string;
  copy?: string;
}

interface DetailsProps {
  details: SheetDetail[];
}

const vertical = { vertical: true };
const snapPoints: SnapPoint[] | undefined =
  Platform.OS === "android" ? undefined : ["half", "full"];

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

// WORKAROUND: Android ではリストが与えられた高さを埋め、シートが画面いっぱいに伸びる。行をシートの列に直接並べる。
function Actions({ children }: { children: ReactNode }) {
  return Platform.OS === "android" ? (
    children
  ) : (
    <NativeList testID="action-sheet-list">{children}</NativeList>
  );
}

export interface SheetMenu {
  title: string;
  details?: SheetDetail[];
  actions: SheetAction[];
}

interface ActionSheetProps {
  menu: SheetMenu | null;
  onClose: () => void;
}

export function ActionSheet({ menu, onClose }: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState(menu);
  if (menu !== null && menu !== shown) {
    setShown(menu);
  }
  return (
    // WORKAROUND: Android の Compose ホストは、上に来たタッチをすべて飲み込む。待機中はタッチを下へ通す。
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

const header = { paddingHorizontal: 16, paddingTop: 12 };
const title = { color: colors.text, fontSize: 17, fontWeight: "600" } as const;
const rowColors = {
  containerColor: colors.surface,
  contentColor: colors.text,
};
const disabledColors = { ...rowColors, contentColor: `${colors.text}66` };

const styles = StyleSheet.create({
  // WORKAROUND: ホストされたビューは margin 抜きで計測される。余白は padding で取る。
  area: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  table: {
    borderRadius: 10,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  row: {
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
  label: { width: 92, color: colors.secondary, fontSize: 13 },
  value: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    color: colors.text,
    fontSize: 14,
  },
  copy: {
    width: 64,
    textAlign: "right",
    color: colors.secondary,
    fontSize: 12,
  },
});
