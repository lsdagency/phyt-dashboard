"use client";

import { useState } from "react";
import useSWR from "swr";
import type {
  CompetitorReport,
  CompetitorEntry,
  CompetitorPriority,
} from "@/lib/integrations/competitors";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/** Tolerate both the new bullet arrays and any string values from an older cached report. */
function toList(v: string[] | string | undefined | null): string[] {
  if (Array.isArray(v)) return v.filter(Boolean);
  return v ? [v] : [];
}

const PRIORITY_DOT: Record<CompetitorPriority, string> = {
  high: "bg-phyt-pink-soft",
  medium: "bg-phyt-yellow-soft",
  watch: "bg-phyt-green-soft",
};
const PRIORITY_LABEL: Record<CompetitorPriority, string> = {
  high: "High",
  medium: "Medium",
  watch: "Watch",
};

/** Deep link to search a competitor in Meta's Ad Library (GB storefront). */
function metaAdLibraryUrl(name: string): string {
  const q = name.replace(/\(.*?\)/g, "").trim();
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=GB&media_type=all&search_type=keyword_unordered&q=${encodeURIComponent(q)}`;
}

function Chips({ items, tint }: { items: string[]; tint: string }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span key={i} className={`rounded-full px-2 py-0.5 text-[11px] ${tint}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

function CompetitorCard({ c }: { c: CompetitorEntry }) {
  const a = c.analysis;
  return (
    <div className="rounded-2xl border border-phyt-ink/10 bg-white p-4">
      <div className="flex items-start gap-3">
        {c.app?.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.app.icon} alt="" className="h-12 w-12 rounded-xl" />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-phyt-ink/5" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-display font-bold">{c.name}</h4>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${PRIORITY_DOT[c.priority]}`}>
              {PRIORITY_LABEL[c.priority]}
            </span>
          </div>
          <div className="text-xs text-phyt-ink/55">
            {c.app ? (
              <>
                {c.app.developer} · ★ {c.app.rating.toFixed(1)} (
                {c.app.ratingCount.toLocaleString()}) · {c.app.price}
                {c.country === "us" ? " · US store" : ""}
              </>
            ) : (
              <span className="text-phyt-ink/40">Couldn&apos;t load listing{c.error ? ` (${c.error})` : ""}</span>
            )}
          </div>
        </div>
      </div>

      {a ? (
        <div className="mt-3 space-y-3 text-sm">
          {a.summary && (
            <p className="font-medium text-phyt-ink">{a.summary}</p>
          )}
          <p className="text-phyt-ink/70">{a.positioning}</p>
          {a.messagingFlags?.length > 0 && (
            <Chips items={a.messagingFlags} tint="bg-phyt-blue-soft" />
          )}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-phyt-ink/50">Inferred keywords</div>
            <div className="mt-1">
              <Chips items={a.inferredKeywords} tint="bg-phyt-ink/5" />
            </div>
          </div>
          {a.reviewThemes?.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-phyt-ink/50">Review themes</div>
              <ul className="mt-1 list-inside list-disc text-xs text-phyt-ink/70">
                {a.reviewThemes.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {a.releaseWatch && !["—", ",", "-", "none"].includes(a.releaseWatch.trim().toLowerCase()) && (
            <div className="rounded-lg bg-phyt-yellow-soft px-3 py-2 text-xs">
              <span className="font-medium">Release watch: </span>
              {a.releaseWatch}
            </div>
          )}
          {(() => {
            const items = toList(a.vsPhyt);
            if (items.length === 0) return null;
            return (
              <div className="rounded-lg bg-phyt-green-soft px-3 py-2 text-xs">
                <div className="font-medium">vs PHYT</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-phyt-ink/80">
                  {items.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </div>
      ) : (
        <p className="mt-3 text-xs text-phyt-ink/45">
          {c.app
            ? "AI analysis pending — add an Anthropic key in Settings, then Refresh."
            : ""}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {c.app?.url && (
          <a href={c.app.url} target="_blank" rel="noreferrer" className="text-phyt-blue underline">
            App Store ↗
          </a>
        )}
        <a
          href={metaAdLibraryUrl(c.name)}
          target="_blank"
          rel="noreferrer"
          className="text-phyt-blue underline"
        >
          Meta Ad Library ↗
        </a>
      </div>
    </div>
  );
}

export default function CompetitorOverview({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading, mutate } = useSWR<CompetitorReport>(
    "/api/competitors",
    fetcher,
    { revalidateOnFocus: false },
  );
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/competitors", { method: "POST" });
      if (res.ok) await mutate(await res.json(), { revalidate: false });
    } finally {
      setRefreshing(false);
    }
  }

  if ((isLoading || refreshing) && !data) {
    return (
      <div className="py-16 text-center text-phyt-ink/50">
        Building competitor report — fetching App Store listings &amp; reviews…
      </div>
    );
  }
  if (!data?.competitors) {
    return <div className="py-16 text-center text-phyt-ink/50">No competitor data yet.</div>;
  }

  const groups = data.competitors.reduce<Record<string, CompetitorEntry[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-phyt-ink/55">
            Public App Store intelligence (listings + reviews), analysed for PHYT.
            {" "}
            {data.generatedAt && (
              <>Updated {new Date(data.generatedAt).toLocaleDateString("en-GB")}.</>
            )}
          </p>
          {!data.aiEnabled && (
            <p className="mt-1 text-xs text-phyt-ink/45">
              Showing listings only — add an Anthropic key in Settings for the AI analysis.
            </p>
          )}
          {data.aiEnabled && data.aiError && (
            <p className="mt-1 rounded-lg bg-phyt-pink-soft px-3 py-1.5 text-xs text-phyt-ink">
              AI analysis failed: {data.aiError}. Check the Claude key/model in Settings, then Refresh.
            </p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={refresh}
            disabled={refreshing}
            className="rounded-lg bg-phyt-yellow px-3 py-2 text-sm font-display font-bold disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        )}
      </div>

      {/* Market snapshot + actions */}
      {(toList(data.snapshot).length > 0 || data.actions?.length > 0) && (
        <div className="rounded-2xl border border-phyt-ink/10 bg-white p-5">
          <h3 className="text-lg font-display font-bold">Market snapshot</h3>
          {toList(data.snapshot).length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-phyt-ink/80">
              {toList(data.snapshot).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          {data.actions?.length > 0 && (
            <>
              <div className="mt-4 text-[11px] uppercase tracking-wide text-phyt-ink/50">
                Actions this week
              </div>
              <ul className="mt-2 space-y-2">
                {data.actions.map((ac, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] uppercase ${
                        ac.priority === "high"
                          ? "bg-phyt-pink-soft"
                          : ac.priority === "medium"
                            ? "bg-phyt-yellow-soft"
                            : "bg-phyt-ink/5"
                      }`}
                    >
                      {ac.priority}
                    </span>
                    <span className="text-phyt-ink/80">{ac.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Competitor cards grouped */}
      {Object.entries(groups).map(([group, list]) => (
        <div key={group}>
          <h3 className="mb-2 text-sm font-display font-bold uppercase tracking-wide text-phyt-ink/60">
            {group}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((c) => (
              <CompetitorCard key={c.key} c={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
