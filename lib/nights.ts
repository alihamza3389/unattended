/**
 * The nights are the only thing the mind writes down. Each JSON file under
 * corpus/nights/ is one night's dialogue between the surface voice and the
 * sediment, written by scripts/dream.mts. Read at build time only.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface Night {
  day: number;
  dreamt: string;
  summary: string;
  dialogue: { voice: "surface" | "sediment"; text: string }[];
}

const DIR = join(process.cwd(), "corpus", "nights");

export function nightDays(): number[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .map((f) => /^day-(\d+)\.json$/.exec(f)?.[1])
    .filter((d): d is string => d !== undefined)
    .map(Number)
    .sort((a, b) => b - a);
}

export function nightOf(day: number): Night | null {
  const path = join(DIR, `day-${String(day).padStart(3, "0")}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Night;
}
