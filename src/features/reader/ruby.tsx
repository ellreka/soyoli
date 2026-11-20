import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import type { Paragraph } from "@/features/books/paragraphs";

const joiner = "\u2060";

export function renderedLength(paragraph: Paragraph): number {
  return paragraph.text.length + (paragraph.ruby?.length ?? 0) * 2;
}

export interface RubyLook {
  base: number;
  line: number;
  size: number;
  color: string;
}

// WORKAROUND: Android はインラインのビューをベースラインの上に立てる。iOS はフォント自身の高さの行でベースラインが来るはずの位置に立て、それより高い行では余分な高さの半分だけ上に来る。
function anchorDrop(look: RubyLook): number {
  // WORKAROUND: 1.19 は iOS のシステムフォントの、フォントサイズ 1 あたりの行の高さ。
  return Platform.OS === "ios"
    ? Math.max(0, (look.line - look.base * 1.19) / 2)
    : 0;
}

// WORKAROUND: RN にはルビのレイアウトがない。幅のないアンカーを親文字の後ろに続け、読みをそこから親文字の中央に合わせて吊るす。
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
    const width = (annotation.reading.length + 1) * look.size;
    parts.push(
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
