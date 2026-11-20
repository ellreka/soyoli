import {
  Platform,
  Pressable as NativePressable,
  StyleSheet,
  type PressableProps as NativePressableProps,
} from "react-native";

export interface PressableProps extends NativePressableProps {
  feedback?: boolean;
  borderless?: boolean;
}

const rippleColor = "#8E8E9366";
const pressedOpacity = 0.55;

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
          foreground: true,
        }
      }
      style={(state) => {
        const resolved = typeof style === "function" ? style(state) : style;
        if (Platform.OS === "android" || !state.pressed) {
          return resolved;
        }
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
