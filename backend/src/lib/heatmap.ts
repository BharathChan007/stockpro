/** Bands for sales UI — counts are never sent to clients, only levels. */

const HIGH_MIN = 8;
const MEDIUM_MIN = 3;

export type HeatLevel = "high" | "medium" | "low" | "none";

export function countToLevel(openCount: number): HeatLevel {
  if (openCount <= 0) return "none";
  if (openCount >= HIGH_MIN) return "high";
  if (openCount >= MEDIUM_MIN) return "medium";
  return "low";
}
