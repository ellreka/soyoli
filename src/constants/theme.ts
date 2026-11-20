import type { ColorValue } from "react-native";

export const colors = {
  background: "#121214",
  surface: "#1E1E21",
  selected: "#36363B",
  text: "#E8E8EC",
  secondary: "#A0A0A8",
  border: "#3C3C41",
  marker: "#F2FF4D4D",
} as const;

export const gutter = 20;

export function iconColor(color: ColorValue, disabled: boolean): ColorValue {
  return disabled && typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)
    ? `${color}4D`
    : color;
}
