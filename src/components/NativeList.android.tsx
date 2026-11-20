import { List, type ListItemProps, type ListProps } from "@expo/ui";
import { HorizontalDivider, Text } from "@expo/ui/jetpack-compose";
import { padding } from "@expo/ui/jetpack-compose/modifiers";

import { colors } from "@/constants/theme";
import type { NativeListGroupProps } from "./NativeList";

type ModifierConfig = NonNullable<ListItemProps["modifiers"]>[number];

export const rowModifiers: ModifierConfig[] | undefined = undefined;

export const selectedRowModifiers: ModifierConfig[] | undefined = undefined;

export const sheetHeaderModifiers: ModifierConfig[] | undefined = undefined;

export function NativeListGroup({
  title,
  first,
  children,
}: NativeListGroupProps) {
  return (
    <>
      {!first && <HorizontalDivider color={colors.border} />}
      {title !== undefined && (
        <Text
          color={colors.secondary}
          style={{ fontSize: 13, fontWeight: "600" }}
          modifiers={[padding(16, 20, 16, 4)]}
        >
          {title}
        </Text>
      )}
      {children}
    </>
  );
}

export function NativeList(props: ListProps) {
  return <List {...props} />;
}
