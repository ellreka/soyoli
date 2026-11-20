import { StyleSheet, View } from "react-native";

import type { IconName } from "@/components/Icon";
import { IconButton } from "@/components/IconButton";
import { usePlayback } from "./Playback";
import { movePosition, type Step } from "@/features/books/paragraphs";

interface Control {
  label: string;
  icon: IconName;
  action: () => void;
  disabled: boolean;
}

interface Controls {
  toggle: Control;
  move: (
    direction: -1 | 1,
    unit: Step,
    label: string,
    icon: IconName,
  ) => Control;
}

function useControls(): Controls {
  const { state, toggle, step } = usePlayback();
  return {
    toggle: {
      label: state.playing ? "一時停止" : "再生",
      icon: state.playing ? "pause" : "play",
      action: toggle,
      disabled: !state.chapters[state.chapterIndex]?.length,
    },
    move: (direction, unit, label, icon) => ({
      label,
      icon,
      action: () => {
        step(direction, unit);
      },
      disabled: !movePosition(state.chapters, state, direction, unit),
    }),
  };
}

function Secondary({ control }: { control: Control }) {
  return (
    <IconButton
      icon={control.icon}
      label={control.label}
      size={22}
      disabled={control.disabled}
      onPress={control.action}
    />
  );
}

export function Transport({ compact = false }: { compact?: boolean }) {
  const { toggle, move } = useControls();

  if (compact) {
    return <Secondary control={toggle} />;
  }
  return (
    <View style={[styles.row, styles.full]}>
      <Secondary control={move(-1, "chapter", "前の話", "skip-back")} />
      <IconButton
        icon={toggle.icon}
        label={toggle.label}
        size={22}
        filled={52}
        disabled={toggle.disabled}
        onPress={toggle.action}
      />
      <Secondary control={move(1, "chapter", "次の話", "skip-forward")} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  full: { gap: 12 },
});
