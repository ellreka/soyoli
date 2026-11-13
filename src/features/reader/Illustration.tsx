import { useState } from "react";
import { Image, StyleSheet, Text } from "react-native";

const safeImage = /^data:image\/(?:jpeg|png|gif|webp);base64,[a-z\d+/=]+$/i;

interface IllustrationProps {
  uri: string;
  alt: string;
  /** 画像を表示できないときに出すキャプションの色。 */
  color: string;
}

/** 本文に組み込まれた画像。表示できないときはキャプションが代わりに出る。 */
export function Illustration({ uri, alt, color }: IllustrationProps) {
  const [ratio, setRatio] = useState(1);
  const [failed, setFailed] = useState(false);
  if (!safeImage.test(uri) || failed) {
    return alt ? <Text style={[styles.alt, { color }]}>{alt}</Text> : null;
  }
  return (
    <Image
      accessibilityLabel={alt}
      source={{ uri }}
      resizeMode="contain"
      onLoad={({ nativeEvent: { source } }) => {
        if (source.width && source.height) {
          setRatio(source.width / source.height);
        }
      }}
      onError={() => {
        setFailed(true);
      }}
      // 縦横比はデコードするまで分からない（既定は正方形）ので、
      // 最初のレイアウトが一度ずれる。気になる場合だけ、場所を先に確保すること。
      style={[styles.image, { aspectRatio: ratio }]}
    />
  );
}

const styles = StyleSheet.create({
  image: { width: "100%", marginVertical: 12 },
  alt: { fontWeight: "400", fontSize: 13 },
});
