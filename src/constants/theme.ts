import type { ColorValue } from "react-native";

/**
 * モノクロのパレット: 面が 2 つ（と、リストの中で読者がいる場所を示す
 * 明るめの面）、文字の濃さが 2 つ、細い線が 1 つ。マーカーがアプリで
 * 唯一の色味。無効状態は色を増やさず、不透明度で表す。
 *
 * 真っ黒も真っ白も使わない: 21:1 だと、黒地の明るい文字はまぶしく、多くの
 * 読者（乱視、ディスレクシア）にはにじんで見える。長い文章でできている
 * アプリではこれが効く。文字は WCAG AAA（7:1）を大きく上回ったまま —
 * 背景の上で text 15.3:1 と secondary 7.2:1、surface の上で 13.6:1 と
 * 6.4:1。値を変えるときは比率を確かめ直すこと。
 */
export const colors = {
  background: "#121214",
  surface: "#1E1E21",
  /**
   * 長いリストの中で読者がいる行（目次の今の章）: surface より一段明るい。
   * この上で text 11.2:1、secondary 5.3:1。選択肢の中からの選択は、
   * 代わりに `SelectionMark` で示す。
   */
  selected: "#36363B",
  text: "#E8E8EC",
  secondary: "#A0A0A8",
  border: "#3C3C41",
  /** 読み上げ中の段落に使う、半透明の蛍光イエロー（#F2FF4D の 30%）。 */
  marker: "#F2FF4D4D",
} as const;

/** すべての画面で共通の、ページ左右の余白。 */
export const gutter = 20;

/**
 * 無効なボタンのアイコンの色: 同じ色で、ほとんど透けている。
 * プラットフォーム自身のボタンにはアイコンの色をそのまま渡すので、
 * ボタンが自分で薄くすることはない。
 */
export function iconColor(color: ColorValue, disabled: boolean): ColorValue {
  return disabled && typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)
    ? `${color}4D`
    : color;
}
