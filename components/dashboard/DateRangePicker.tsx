"use client";

import { PRESETS, type PresetId } from "@/lib/dateRanges";

export default function DateRangePicker({
  preset,
  custom,
  onPreset,
  onCustom,
}: {
  preset: PresetId;
  custom: { start: string; end: string };
  onPreset: (id: PresetId) => void;
  onCustom: (range: { start: string; end: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={preset}
        onChange={(e) => onPreset(e.target.value as PresetId)}
        className="rounded-lg border border-phyt-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-phyt-blue"
      >
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={custom.start}
            onChange={(e) => onCustom({ ...custom, start: e.target.value })}
            className="rounded-lg border border-phyt-ink/15 px-3 py-2 text-sm outline-none focus:border-phyt-blue"
          />
          <span className="text-phyt-ink/40">→</span>
          <input
            type="date"
            value={custom.end}
            onChange={(e) => onCustom({ ...custom, end: e.target.value })}
            className="rounded-lg border border-phyt-ink/15 px-3 py-2 text-sm outline-none focus:border-phyt-blue"
          />
        </div>
      )}
    </div>
  );
}
