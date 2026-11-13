import type { Book } from "@/features/books/book";

/** 読書履歴の中の作品と、最後に読んだ時刻（ms）。 */
export interface HistoryItem {
  book: Book;
  readAt: number;
}

/** ある 1 日に読んだ作品。新しい順。 */
export interface HistoryDay {
  label: string;
  items: HistoryItem[];
}

function startOfDay(time: number): number {
  const date = new Date(time);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** 今日、昨日、その先は日付。年は今年でないときだけ付く。 */
export function dayLabel(time: number, now: number): string {
  const date = new Date(time);
  const today = new Date(now);
  // 2 つのローカル日付の間の日数。丸めることで夏時間のずれを吸収する。
  const days = Math.round((startOfDay(now) - startOfDay(time)) / 86_400_000);
  if (days <= 0) {
    return "今日";
  }
  if (days === 1) {
    return "昨日";
  }
  const day = `${date.getMonth() + 1}月${date.getDate()}日`;
  return date.getFullYear() === today.getFullYear()
    ? day
    : `${date.getFullYear()}年${day}`;
}

/** 履歴（新しい順）を日ごとに分ける。 */
export function byDay(items: HistoryItem[], now: number): HistoryDay[] {
  const days: HistoryDay[] = [];
  for (const item of items) {
    const label = dayLabel(item.readAt, now);
    const last = days.at(-1);
    if (last?.label === label) {
      last.items.push(item);
    } else {
      days.push({ label, items: [item] });
    }
  }
  return days;
}
