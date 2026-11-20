import { useState } from "react";
import { Image, StyleSheet, Text } from "react-native";

const safeImage = /^data:image\/(?:jpeg|png|gif|webp);base64,[a-z\d+/=]+$/i;

interface IllustrationProps {
  uri: string;
  alt: string;
  color: string;
}

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
      style={[styles.image, { aspectRatio: ratio }]}
    />
  );
}

const styles = StyleSheet.create({
  image: { width: "100%", marginVertical: 12 },
  alt: { fontWeight: "400", fontSize: 13 },
});
