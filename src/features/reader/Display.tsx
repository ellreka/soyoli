import { createContext, useContext, useState, type ReactNode } from "react";

import { colors } from "@/constants/theme";
import { loadDisplay, saveDisplay } from "./displayStorage";

export interface ReaderPalette {
  background: string;
  text: string;
  dimmed: string;
  marker: string;
}

export const fontSizes = { small: 14, medium: 17, large: 21, xlarge: 25 };
export const lineHeights = { tight: 1.6, normal: 33 / 17, loose: 2.3 };
export const themes = {
  black: {
    background: colors.background,
    text: colors.text,
    dimmed: colors.secondary,
    marker: colors.marker,
  },
  sepia: {
    background: "#F4ECD8",
    text: "#3A2F21",
    dimmed: "#6F634C",
    marker: "#E8B80066",
  },
  white: {
    background: "#F7F7F5",
    text: "#1F1F22",
    dimmed: "#6B6B70",
    marker: "#FFD60080",
  },
} satisfies Record<string, ReaderPalette>;

export const playGestures = { doubleTap: true, tap: true };

export type FontSize = keyof typeof fontSizes;
export type LineHeight = keyof typeof lineHeights;
export type Theme = keyof typeof themes;
export type PlayGesture = keyof typeof playGestures;

export interface DisplaySettings {
  fontSize: FontSize;
  lineHeight: LineHeight;
  theme: Theme;
  playOn: PlayGesture;
}

export const defaultDisplay: DisplaySettings = {
  fontSize: "medium",
  lineHeight: "normal",
  theme: "black",
  playOn: "doubleTap",
};

function pick<Key extends string>(
  options: Record<Key, unknown>,
  value: unknown,
  fallback: Key,
): Key {
  return typeof value === "string" && Object.hasOwn(options, value)
    ? (value as Key)
    : fallback;
}

function restore(): DisplaySettings {
  const saved = loadDisplay();
  return {
    fontSize: pick(fontSizes, saved?.fontSize, defaultDisplay.fontSize),
    lineHeight: pick(lineHeights, saved?.lineHeight, defaultDisplay.lineHeight),
    theme: pick(themes, saved?.theme, defaultDisplay.theme),
    playOn: pick(playGestures, saved?.playOn, defaultDisplay.playOn),
  };
}

interface DisplayValue {
  settings: DisplaySettings;
  update: (patch: Partial<DisplaySettings>) => void;
}

const DisplayContext = createContext<DisplayValue | null>(null);

export function DisplayProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(restore);

  function update(patch: Partial<DisplaySettings>): void {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveDisplay(next);
  }

  return (
    <DisplayContext value={{ settings, update }}>{children}</DisplayContext>
  );
}

export function useDisplay(): DisplayValue {
  const display = useContext(DisplayContext);
  if (!display) {
    throw new Error("DisplayProviderが必要です。");
  }
  return display;
}
