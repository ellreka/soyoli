import { List, Text, type ListItemProps, type ListProps } from "@expo/ui";
import type { ReactNode } from "react";

type ModifierConfig = NonNullable<ListItemProps["modifiers"]>[number];

/** 行に足す modifier。必要なのは iOS だけ。 */
export const rowModifiers: ModifierConfig[] | undefined = undefined;

/** 読者がいる行の modifier。iOS はこれで行を塗る。 */
export const selectedRowModifiers: ModifierConfig[] | undefined = undefined;

/** シートのヘッダー行の余白。modifier が必要なのは iOS だけ。 */
export const sheetHeaderModifiers: ModifierConfig[] | undefined = undefined;

export interface NativeListGroupProps {
  /** 行に共通するもの。行の上に表示される。 */
  title?: string;
  /** リストの最初のグループには、分けるべき前のグループがない。 */
  first?: boolean;
  children: ReactNode;
}

/**
 * リストの中の同じ種類の行。前のグループから分けて置く。このファイル
 * （Web とテスト）は行をまとめておくだけで、iOS と Android がそれぞれの
 * やり方で区切りを描く。
 */
export function NativeListGroup({ title, children }: NativeListGroupProps) {
  return (
    <>
      {title !== undefined && <Text>{title}</Text>}
      {children}
    </>
  );
}

/** 設定ページ用のプラットフォームのリスト。iOS と Android に別版がある。 */
export function NativeList(props: ListProps) {
  return <List {...props} />;
}
