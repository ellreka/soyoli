import { Switch } from "@expo/ui";

export interface ListSwitchProps {
  testID?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/**
 * プラットフォームのリスト（Expo UI）の行末に置くスイッチ。それ自体が
 * Expo UI のビューなので、ホストは要らない。このファイルは共通版で、Web と
 * テスト用。iOS と Android は隣のファイルで色を付ける。
 */
export function ListSwitch(props: ListSwitchProps) {
  return <Switch {...props} />;
}
