import type { Book } from "@/features/books/book";

export interface HistoryItem {
  book: Book;
  readAt: number;
}

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

export function dayLabel(time: number, now: number): string {
  const date = new Date(time);
  const today = new Date(now);
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
