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
  paddingRight: 16,
} as const;
const beside = { flex: 1, flexDirection: "row", alignItems: "center" } as const;
const leadingSlot = { paddingLeft: 16 } as const;

export function NativeRow({ action, leading, ...row }: NativeRowProps) {
  if (!action && !leading) {
    return <Row {...row} />;
  }
  // WORKAROUND: SwiftUI のボタンは中に別のボタンを入れられない。アクションと行頭の絵は行の隣に置く。
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
