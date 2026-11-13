import { NativeRow } from "./NativeRow";
import { RowGroup } from "./RowGroup";

export interface SelectOption {
  /** 選択肢の中で一意。空文字列でもよい。 */
  value: string;
  label: string;
}

export interface NativeSelectProps {
  accessibilityLabel: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
}

/**
 * 長くなりうるリストからの 1 つの選択。このファイルは Web とテスト用の版で、
 * 選択肢を並べて見せる。iOS と Android は選ばれたものを表示し、隣のファイルで
 * プラットフォーム自身のメニュー（Expo UI）を開く。
 */
export function NativeSelect({ value, options, onChange }: NativeSelectProps) {
  return (
    <RowGroup>
      {options.map((option) => (
        <NativeRow
          key={option.value}
          title={option.label}
          selected={option.value === value}
          onPress={() => {
            onChange(option.value);
          }}
        />
      ))}
    </RowGroup>
  );
}
