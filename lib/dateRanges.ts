import type { DateRange } from "./integrations/types";

export type PresetId =
  | "today"
  | "yesterday"
  | "last_7"
  | "last_30"
  | "last_week"
  | "last_month"
  | "custom";

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7", label: "Last 7 days" },
  { id: "last_30", label: "Last 30 days" },
  { id: "last_week", label: "Last week" },
  { id: "last_month", label: "Last month" },
  { id: "custom", label: "Custom" },
];

// Local-time YYYY-MM-DD (not UTC) so "today" matches the user's calendar.
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Resolve a preset to a concrete range. `custom` returns the provided dates. */
export function rangeForPreset(
  id: PresetId,
  custom?: Partial<DateRange>,
): DateRange {
  const now = new Date();

  switch (id) {
    case "today":
      return { start: fmt(now), end: fmt(now) };
    case "yesterday": {
      const y = addDays(now, -1);
      return { start: fmt(y), end: fmt(y) };
    }
    case "last_7":
      return { start: fmt(addDays(now, -6)), end: fmt(now) };
    case "last_30":
      return { start: fmt(addDays(now, -29)), end: fmt(now) };
    case "last_week": {
      // Previous calendar week, Monday–Sunday.
      const dow = (now.getDay() + 6) % 7; // 0 = Monday
      const thisMonday = addDays(now, -dow);
      const lastMonday = addDays(thisMonday, -7);
      const lastSunday = addDays(lastMonday, 6);
      return { start: fmt(lastMonday), end: fmt(lastSunday) };
    }
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: fmt(first), end: fmt(last) };
    }
    case "custom":
      return {
        start: custom?.start || fmt(addDays(now, -6)),
        end: custom?.end || fmt(now),
      };
  }
}
