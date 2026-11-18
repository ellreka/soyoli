import { Tabs } from "expo-router";
import { BottomTabBar } from "expo-router/js-tabs";
import { StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { colors } from "@/constants/theme";
import { ImportNotice } from "@/features/library/ImportNotice";
import { MiniPlayer } from "@/features/player/MiniPlayer";

/** 左から右の順。本棚が index ルートなので、アプリはここで開く。 */
const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: "home", title: "ホーム", icon: "home" },
  { name: "index", title: "本棚", icon: "library" },
  { name: "settings", title: "設定", icon: "settings" },
];

export default function TabLayout() {
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => (
        <View>
          <ImportNotice />
          <MiniPlayer />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.secondary,
        tabBarLabelPosition: "below-icon",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarItemStyle: { minHeight: 48 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          // 今いるタブを押すと、そのタブの最初のページに戻り（ブラウザや設定の
          // ページを閉じる）、そのページを先頭までスクロールする。
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color }) => (
              <Icon name={tab.icon} size={22} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
