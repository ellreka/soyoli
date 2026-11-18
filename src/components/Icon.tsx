import { Host, Icon as UIIcon } from "@expo/ui";
import type { ColorValue } from "react-native";

import { colors } from "@/constants/theme";

/**
 * Lucide 風の名前を、Expo UI が描くプラットフォーム自身のシンボルに対応
 * させる: iOS は SF Symbols、Android は Material Symbols（outlined）。
 * Android のアイコンは 1 つずつ別のアセットなので、ここに名前のあるもの
 * だけがバンドルされる。
 */
const symbols = {
  home: UIIcon.select({
    ios: "house",
    android: import("@expo/material-symbols/home.xml"),
  }),
  library: UIIcon.select({
    ios: "books.vertical",
    android: import("@expo/material-symbols/library_books.xml"),
  }),
  settings: UIIcon.select({
    ios: "gearshape",
    android: import("@expo/material-symbols/settings.xml"),
  }),
  search: UIIcon.select({
    ios: "magnifyingglass",
    android: import("@expo/material-symbols/search.xml"),
  }),
  plus: UIIcon.select({
    ios: "plus",
    android: import("@expo/material-symbols/add.xml"),
  }),
  minus: UIIcon.select({
    ios: "minus",
    android: import("@expo/material-symbols/remove.xml"),
  }),
  x: UIIcon.select({
    ios: "xmark",
    android: import("@expo/material-symbols/close.xml"),
  }),
  "chevron-down": UIIcon.select({
    ios: "chevron.down",
    android: import("@expo/material-symbols/keyboard_arrow_down.xml"),
  }),
  "chevron-left": UIIcon.select({
    ios: "chevron.left",
    android: import("@expo/material-symbols/chevron_left.xml"),
  }),
  "chevron-right": UIIcon.select({
    ios: "chevron.right",
    android: import("@expo/material-symbols/chevron_right.xml"),
  }),
  "arrow-down": UIIcon.select({
    ios: "arrow.down",
    android: import("@expo/material-symbols/arrow_downward.xml"),
  }),
  "rotate-cw": UIIcon.select({
    ios: "arrow.clockwise",
    android: import("@expo/material-symbols/refresh.xml"),
  }),
  lock: UIIcon.select({
    ios: "lock.fill",
    android: import("@expo/material-symbols/lock.xml"),
  }),
  globe: UIIcon.select({
    ios: "globe",
    android: import("@expo/material-symbols/language.xml"),
  }),
  file: UIIcon.select({
    ios: "doc",
    android: import("@expo/material-symbols/description.xml"),
  }),
  bookmark: UIIcon.select({
    ios: "bookmark",
    android: import("@expo/material-symbols/bookmark.xml"),
  }),
  "bookmark-on": UIIcon.select({
    ios: "bookmark.fill",
    // パッケージにはアウトラインしかない。オンとオフは iOS と同じく塗りで
    // 見分けるので、塗りつぶした形はアプリ自前の drawable。
    android: import("@/assets/icons/bookmark_fill.xml"),
  }),
  type: UIIcon.select({
    ios: "textformat",
    android: import("@expo/material-symbols/text_fields.xml"),
  }),
  ellipsis: UIIcon.select({
    ios: "ellipsis",
    android: import("@expo/material-symbols/more_horiz.xml"),
  }),
  grid: UIIcon.select({
    ios: "square.grid.2x2",
    android: import("@expo/material-symbols/grid_view.xml"),
  }),
  list: UIIcon.select({
    ios: "list.bullet",
    android: import("@expo/material-symbols/format_list_bulleted.xml"),
  }),
  timer: UIIcon.select({
    ios: "timer",
    android: import("@expo/material-symbols/timer.xml"),
  }),
  "audio-lines": UIIcon.select({
    ios: "waveform",
    android: import("@expo/material-symbols/graphic_eq.xml"),
  }),
  "skip-back": UIIcon.select({
    ios: "backward.end",
    android: import("@expo/material-symbols/skip_previous.xml"),
  }),
  "skip-forward": UIIcon.select({
    ios: "forward.end",
    android: import("@expo/material-symbols/skip_next.xml"),
  }),
  play: UIIcon.select({
    ios: "play.fill",
    android: import("@expo/material-symbols/play_arrow.xml"),
  }),
  layers: UIIcon.select({
    ios: "square.stack",
    android: import("@expo/material-symbols/layers.xml"),
  }),
  pause: UIIcon.select({
    ios: "pause.fill",
    android: import("@expo/material-symbols/pause.xml"),
  }),
};

export type IconName = keyof typeof symbols;

interface IconProps {
  name: IconName;
  size: number;
  color?: ColorValue;
}

interface IconGlyphProps extends IconProps {
  /** アイコンが単独で置かれたとき、Android のスクリーンリーダーが読む。 */
  label?: string;
}

/**
 * シンボルだけ。別の Expo UI コンポーネント（ボタン）の中で使う。上に
 * `Host` が必要で、`Icon` は自分で持っている。
 */
export function IconGlyph({
  name,
  size,
  color = colors.text,
  label,
}: IconGlyphProps) {
  return (
    <UIIcon
      name={symbols[name]}
      size={size}
      color={color}
      accessibilityLabel={label}
    />
  );
}

export function Icon(props: IconProps) {
  return (
    // ホストはアイコンの大きさになる。アイコンは飾りで、押下は包んでいる
    // ボタンが受け持つ。
    <Host matchContents pointerEvents="none">
      <IconGlyph {...props} />
    </Host>
  );
}
