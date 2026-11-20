import { List, Text, type ListItemProps, type ListProps } from "@expo/ui";
import type { ReactNode } from "react";

type ModifierConfig = NonNullable<ListItemProps["modifiers"]>[number];

export const rowModifiers: ModifierConfig[] | undefined = undefined;

export const selectedRowModifiers: ModifierConfig[] | undefined = undefined;

export const sheetHeaderModifiers: ModifierConfig[] | undefined = undefined;

export interface NativeListGroupProps {
  title?: string;
  first?: boolean;
  children: ReactNode;
}

export function NativeListGroup({ title, children }: NativeListGroupProps) {
  return (
    <>
      {title !== undefined && <Text>{title}</Text>}
      {children}
    </>
  );
}

export function NativeList(props: ListProps) {
  return <List {...props} />;
}
