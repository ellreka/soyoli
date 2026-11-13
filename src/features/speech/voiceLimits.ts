/** 読み上げ速度の範囲（1 は声そのものの速度）。 */
export const minRate = 0.5;
export const maxRate = 3;

/** 声の高さの範囲（1 は声そのまま）。 */
export const minPitch = 0.5;
export const maxPitch = 2;

function within(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && value >= min && value <= max;
}

/** 設定できる速度。ファイルから読み戻した値の確認にも使う。 */
export function isRate(value: unknown): value is number {
  return within(value, minRate, maxRate);
}

/** 設定できる高さ。ファイルから読み戻した値の確認にも使う。 */
export function isPitch(value: unknown): value is number {
  return within(value, minPitch, maxPitch);
}
