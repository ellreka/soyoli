import { router } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconButton } from "@/components/IconButton";
import { Pressable } from "@/components/Pressable";
import { colors, gutter } from "@/constants/theme";
import { licensedPackages, type LicensedPackage } from "./licenses";

function back(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/settings");
  }
}

function Row({ item }: { item: LicensedPackage }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${[item.name, item.version].filter(Boolean).join(" ")}のライセンス`}
      onPress={() => {
        router.push({ pathname: "/settings/license", params: { id: item.id } });
      }}
      style={styles.row}
    >
      <View style={styles.names}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.version !== undefined && (
          <Text style={styles.version} numberOfLines={1}>
            {item.version}
          </Text>
        )}
      </View>
      <Text style={styles.license} numberOfLines={1}>
        {item.license}
      </Text>
    </Pressable>
  );
}

/**
 * 設定 › オープンソースライセンス: アプリが使っているライブラリの一覧。
 * 行を押すと、そのライブラリのライセンスの本文が開く。数百件あるので、
 * 見えている行だけを描く。
 */
export default function LicensesScreen() {
  const packages = licensedPackages();
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <FlatList
        testID="licenses-list"
        data={packages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Row item={item} />}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.back}>
              <IconButton icon="chevron-left" label="戻る" onPress={back} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              オープンソースライセンス
            </Text>
            <Text style={styles.subtitle}>
              {`このアプリは、次の${packages.length}件のライブラリと素材を使っています。`}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 12, paddingBottom: 32 },
  header: { gap: 4, paddingHorizontal: gutter, paddingBottom: 16 },
  // アイコンのタップ領域を外へ出して、字形がタイトルと揃うようにする。
  back: { marginLeft: -12 },
  title: { color: colors.text, fontWeight: "700", fontSize: 28 },
  subtitle: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: gutter,
    paddingVertical: 10,
  },
  names: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: "500" },
  version: { color: colors.secondary, fontSize: 13 },
  // 長い識別子（"(MIT OR Apache-2.0)"）でも、名前を押し出さない。
  license: { color: colors.secondary, fontSize: 13, maxWidth: "45%" },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: gutter,
    backgroundColor: colors.border,
  },
});
