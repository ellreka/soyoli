export const minRate = 0.5;
export const maxRate = 3;

export const minPitch = 0.5;
export const maxPitch = 2;

function within(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && value >= min && value <= max;
}

export function isRate(value: unknown): value is number {
  return within(value, minRate, maxRate);
}

export function isPitch(value: unknown): value is number {
  return within(value, minPitch, maxPitch);
}
