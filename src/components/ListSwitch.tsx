import { Switch } from "@expo/ui";

export interface ListSwitchProps {
  testID?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ListSwitch(props: ListSwitchProps) {
  return <Switch {...props} />;
}
