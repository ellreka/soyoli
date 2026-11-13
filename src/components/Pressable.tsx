import {
  Platform,
  Pressable as NativePressable,
  StyleSheet,
  type PressableProps as NativePressableProps,
} from "react-native";

export interface PressableProps extends NativePressableProps {
  /** 操作部品でない面（背景の幕）では false にする。 */
  feedback?: boolean;
  /** リップルを枠の外まで広げる。アイコンだけのボタン用。 */
  borderless?: boolean;
}

// 暗い面でも、明るく塗ったボタンでも見える中間のグレー。
const rippleColor = "#8E8E9366";
const pressedOpacity = 0.55;

/**
 * アプリの pressable: タップできるものはすべて、押されていることを見せる。
 * Android はプラットフォームのリップル。リップルのない iOS は、指が
 * 触れている間その部品を薄くする。
 */
export function Pressable({
  feedback = true,
  borderless = false,
  style,
  android_ripple,
  ...props
}: PressableProps) {
  if (!feedback) {
    return <NativePressable style={style} {...props} />;
  }
  return (
    <NativePressable
      android_ripple={
        android_ripple ?? {
          color: rippleColor,
          borderless,
          // 中身の上に描くので、塗りつぶしたボタンでも見える。
          foreground: true,
        }
      }
      style={(state) => {
        const resolved = typeof style === "function" ? style(state) : style;
        if (Platform.OS === "android" || !state.pressed) {
          return resolved;
        }
        // すでに自分で薄くなっている部品は、そのままにする。
        const own = StyleSheet.flatten(resolved)?.opacity;
        return own === undefined || own === 1
          ? [resolved, styles.pressed]
          : resolved;
      }}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: pressedOpacity },
});
