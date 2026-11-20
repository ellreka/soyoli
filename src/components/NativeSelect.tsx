import { NativeRow } from "./NativeRow";
import { RowGroup } from "./RowGroup";

export interface SelectOption {
  value: string;
  label: string;
}

export interface NativeSelectProps {
  accessibilityLabel: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
}

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
