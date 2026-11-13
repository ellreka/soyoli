import { createContext, useContext, useState, type ReactNode } from "react";

import { colors } from "@/constants/theme";
import { loadDisplay, saveDisplay } from "./displayStorage";

/** 章の本文エリアの色。アプリの外枠は自分のパレットのまま。 */
export interface ReaderPalette {
  background: string;
  text: string;
  /** すでに読んだ段落、ルビの読み、画像のキャプション。 */
  dimmed: string;
  /** 読み上げ中の段落の背景。 */
  marker: string;
}

/** 章の本文のポイントサイズ。 */
export const fontSizes = { small: 14, medium: 17, large: 21, xlarge: 25 };
/** 行の高さ。フォントサイズに対する倍率。 */
export const lineHeights = { tight: 1.6, normal: 33 / 17, loose: 2.3 };
// 読書テーマは読者が選ぶ紙の色なので、アプリのモノクロのパレットから
// 外れてよい唯一の場所。
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
    // 紙の上で 5.0:1: すでに読んだ文章も読める（WCAG AA）。
    dimmed: "#6F634C",
    marker: "#E8B80066",
  },
  white: {
    // オフホワイトの紙にオフブラックのインク、15.3:1。既読の文章は 4.9:1。
    background: "#F7F7F5",
    text: "#1F1F22",
    dimmed: "#6B6B70",
    marker: "#FFD60080",
  },
} satisfies Record<string, ReaderPalette>;

/** 本文へのどのタップで読み上げを始めるか。もう一方は位置を動かすだけ。 */
export const playGestures = { doubleTap: true, tap: true };

export type FontSize = keyof typeof fontSizes;
export type LineHeight = keyof typeof lineHeights;
export type Theme = keyof typeof themes;
export type PlayGesture = keyof typeof playGestures;

/** リーダー自身の設定: 本文の見た目と、本文へのタップの動き。 */
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

/** 保存された設定。知らない値は既定値に置き換える。 */
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

/** リーダーの表示設定をアプリ全体で持ち、永続化する。 */
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
