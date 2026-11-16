import { Host } from "@expo/ui";
import { Button, HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityLabel as labelModifier,
  buttonStyle,
  contentShape,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  multilineTextAlignment,
  padding,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { View } from "react-native";

import { colors } from "@/constants/theme";
import { NativeButton } from "./NativeButton";
import { Pressable } from "./Pressable";
import type { NativeRowProps } from "./NativeRow";
import { SelectionMark } from "./SelectionMark.ios";

const stretch = { flex: 1 };
const vertical = { vertical: true };
const withAction = {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  // 行自身の右の余白はアクションの手前で終わる: アクションは、反対側で
  // 文字が取っているのと同じ距離をカードの端から保つ。
  paddingRight: 16,
} as const;
const beside = { flex: 1, flexDirection: "row", alignItems: "center" } as const;
// 行は、絵の後ろに自分の 16pt の余白を保つ。
const leadingSlot = { paddingLeft: 16 } as const;

/**
 * iOS: 行として並べた SwiftUI のボタン。`List` の外の行にはシステムが余白を
 * 付けないので、自分で持つ: 左右に 16pt、上下には 44pt のタップ領域に
 * なるだけの余白。余白を含めた全体がボタンで、押している間は薄くなる。
 */
export function NativeRow({ action, leading, ...row }: NativeRowProps) {
  if (!action && !leading) {
    return <Row {...row} />;
  }
  // SwiftUI のボタンは中に別のボタンを入れられない: アクションは行の隣、
  // 同じ面の上に置く。行頭の絵も行の隣に置き、押すと行と同じことをする。
  return (
    <View style={action ? withAction : beside}>
      {leading && (
        <Pressable
          accessible={false}
          disabled={row.disabled}
          onPress={row.onPress}
          style={leadingSlot}
        >
          {leading}
        </Pressable>
      )}
      <Row {...row} />
      {action && (
        <NativeButton
          label={action.label}
          accessibilityLabel={action.accessibilityLabel}
          variant={action.variant ?? "text"}
          onPress={action.onPress}
        />
      )}
    </View>
  );
}

function Row({
  title,
  detail,
  accessibilityLabel,
  disabled = false,
  selected,
  onPress,
}: NativeRowProps) {
  return (
    <Host matchContents={vertical} colorScheme="dark" style={stretch}>
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle("borderless"),
          tint(colors.text),
          labelModifier(accessibilityLabel ?? title),
          ...(selected ? [accessibilityAddTraits(["isSelected"])] : []),
          disabledModifier(disabled),
        ]}
      >
        <HStack
          spacing={12}
          modifiers={[
            padding({ leading: 16, trailing: 16, top: 13, bottom: 13 }),
            contentShape(shapes.rectangle()),
          ]}
        >
          {selected !== undefined ? (
            <SelectionMark selected={selected} />
          ) : null}
          <VStack alignment="leading" spacing={2}>
            <Text
              modifiers={[
                font({ size: 15, weight: "medium" }),
                foregroundStyle(colors.text),
                // 折り返したタイトルも左揃えのまま。
                multilineTextAlignment("leading"),
              ]}
            >
              {title}
            </Text>
            {detail !== undefined ? (
              <Text
                modifiers={[
                  font({ size: 12 }),
                  foregroundStyle(colors.secondary),
                ]}
              >
                {detail}
              </Text>
            ) : null}
          </VStack>
          <Spacer />
        </HStack>
      </Button>
    </Host>
  );
}
