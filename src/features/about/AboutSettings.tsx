import { ListItem, Text } from "@expo/ui";
import { router } from "expo-router";

import { NativeListGroup, rowModifiers } from "@/components/NativeList";
import { rowColors } from "@/components/SettingsPage";
import { colors } from "@/constants/theme";
import { appVersion } from "./version";

export function AboutSettings() {
  return (
    <NativeListGroup title="このアプリについて">
      <ListItem
        testID="settings-version"
        colors={rowColors}
        modifiers={rowModifiers}
        trailing={appVersion()}
      >
        バージョン
      </ListItem>
      <ListItem
        testID="settings-licenses"
        colors={rowColors}
        modifiers={rowModifiers}
        supportingText=<Text
          textStyle={{
            fontSize: 13,
            lineHeight: 18,
            color: colors.secondary,
          }}
        >
          このアプリが使っているライブラリとそのライセンス
        </Text>
        onPress={() => {
          router.push("/settings/licenses");
        }}
      >
        オープンソースライセンス
      </ListItem>
    </NativeListGroup>
  );
}
