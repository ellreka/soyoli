import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import type { Paragraph } from "@/features/books/paragraphs";

/**
 * ルビのアンカーを、親文字と同じ行にとどめる: word joiner。幅がなく、
 * 前後どちらでも改行を許さない。
 */
const joiner = "\u2060";

/**
 * 段落を描画したときの長さ: その文字数に、ルビ 1 つにつき joiner と、
 * プラットフォームがアンカーのビューの代わりに置く 1 文字を足したもの。
 */
export function renderedLength(paragraph: Paragraph): number {
  return paragraph.text.length + (paragraph.ruby?.length ?? 0) * 2;
}

/** ルビの読みを親文字の上にどう組むか。 */
export interface RubyLook {
  /** 親文字のフォントサイズ。 */
  base: number;
  /** 親文字の行の高さ。 */
  line: number;
  /** 読みのフォントサイズ。 */
  size: number;
  color: string;
}

/**
 * ルビのアンカーの下端が、ベースラインよりどれだけ下にあるか。Android は
 * インラインのビューをベースラインの上に立てる。iOS は、フォント自身の
 * 高さの行でベースラインが来るはずの位置に立てる。それより高い行では
 * 文字が中央に寄るので、余分な高さの半分だけ上に来る。
 */
function anchorDrop(look: RubyLook): number {
  // 1.19: iOS のシステムフォントの行の高さ。フォントサイズ 1 あたり。
  return Platform.OS === "ios"
    ? Math.max(0, (look.line - look.base * 1.19) / 2)
    : 0;
}

/**
 * ルビ: 読みは親文字の上、行と行の間に置く。RN にはルビのレイアウトが
 * ないので、幅のないアンカーを本文の中で親文字の後ろに続け、読みをそこから
 * 親文字の中央に合わせて吊るす。親文字は普通の文字のまま: 折り返すし、
 * ベースラインも保つ。
 * 幅は全角の文字数で数えているので、英字の親文字に付く読みは
 * 中央からずれる。親文字より幅の広い読みは、隣を押しのけずにはみ出す。
 */
export function renderRuby(paragraph: Paragraph, look: RubyLook): ReactNode {
  const ruby = paragraph.ruby;
  if (!ruby?.length) {
    return paragraph.text;
  }
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [index, annotation] of ruby.entries()) {
    const end = annotation.start + annotation.length;
    parts.push(paragraph.text.slice(cursor, end), joiner);
    // 1 文字分のゆとり: 読みが切り詰められると、省略記号で終わってしまう。
    const width = (annotation.reading.length + 1) * look.size;
    parts.push(
      // タッチは本文の行に抜ける。行は、触れられた位置から段落を見つける。
      <View key={index} pointerEvents="none" style={styles.rubyAnchor}>
        <Text
          numberOfLines={1}
          style={[
            styles.ruby,
            {
              color: look.color,
              fontSize: look.size,
              lineHeight: Math.round(look.size * 1.2),
              width,
              right: (annotation.length * look.base - width) / 2,
              // 全角の字形の上端より上に。字形はベースラインからフォントサイズの
              // 約 0.9 まで届く。
              bottom: Math.round(look.base * 0.9 + anchorDrop(look)),
            },
          ]}
        >
          {annotation.reading}
        </Text>
      </View>,
    );
    cursor = end;
  }
  if (cursor < paragraph.text.length) {
    parts.push(paragraph.text.slice(cursor));
  }
  return parts;
}

const styles = StyleSheet.create({
  rubyAnchor: { width: 0, height: 1 },
  ruby: { position: "absolute", fontWeight: "400", textAlign: "center" },
});
