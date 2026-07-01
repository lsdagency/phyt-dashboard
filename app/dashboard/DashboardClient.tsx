"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { rangeForPreset, type PresetId } from "@/lib/dateRanges";
import type { DashboardData } from "@/lib/integrations/types";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import KpiCards from "@/components/dashboard/KpiCards";
import CampaignTable from "@/components/dashboard/CampaignTable";
import Charts from "@/components/dashboard/Charts";
import KeywordTable from "@/components/dashboard/KeywordTable";
import SearchTermTable from "@/components/dashboard/SearchTermTable";
import Recommendations from "@/components/dashboard/Recommendations";
import BudgetPlanner from "@/components/dashboard/BudgetPlanner";
import CompetitorOverview from "@/components/dashboard/CompetitorOverview";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "campaigns", label: "Campaigns" },
  { id: "budget", label: "Budget planner" },
  { id: "keywords", label: "Keywords" },
  { id: "searchterms", label: "Search terms" },
  { id: "competitors", label: "Competitors" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function DashboardClient({ isAdmin }: { isAdmin: boolean }) {
  // Tab from the URL hash so refresh/share keeps the view (#campaigns etc.).
  const [tab, setTab] = useState<TabId>("overview");
  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "") as TabId;
    if (TABS.some((t) => t.id === fromHash)) setTab(fromHash);
  }, []);
  function switchTab(id: TabId) {
    setTab(id);
    window.history.replaceState(null, "", id === "overview" ? "#" : `#${id}`);
  }

  const [preset, setPreset] = useState<PresetId>("last_7");
  const [custom, setCustom] = useState(() => rangeForPreset("last_7"));
  const [refreshing, setRefreshing] = useState(false);

  const range = useMemo(
    () => (preset === "custom" ? custom : rangeForPreset(preset)),
    [preset, custom],
  );

  const url = `/api/metrics?start=${range.start}&end=${range.end}`;
  const { data, isLoading, mutate } = useSWR<DashboardData>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  async function refresh() {
    setRefreshing(true);
    try {
      const fresh = await fetcher(url + "&refresh=1");
      await mutate(fresh, { revalidate: false });
    } finally {
      setRefreshing(false);
    }
  }

  const optimisation = data?.optimisation;

  const sources = data
    ? [data.asa.source, data.revenueCat.source, data.posthog.source]
    : [];
  const allLive = sources.length > 0 && sources.every((s) => s === "live");
  const errors = data
    ? [data.asa.error, data.revenueCat.error, data.posthog.error].filter(Boolean)
    : [];

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            preset={preset}
            custom={custom}
            onPreset={setPreset}
            onCustom={setCustom}
          />
          <button
            onClick={refresh}
            disabled={refreshing}
            className="rounded-lg border border-phyt-ink/15 px-3 py-2 text-sm transition hover:bg-phyt-ink/5 disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "↻ Refresh data"}
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-phyt-ink/55">
          <span
            className={`rounded-full px-2.5 py-1 ${
              allLive ? "bg-phyt-green-soft" : "bg-phyt-yellow-soft"
            }`}
          >
            {allLive ? "Live data" : "Sample data"}
          </span>
          {data && (
            <span>
              Updated{" "}
              {new Date(data.generatedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl bg-phyt-pink-soft px-4 py-3 text-sm text-phyt-ink">
          Some sources couldn&apos;t be reached (showing sample for those):{" "}
          {errors.join(" · ")}
        </div>
      )}

      {/* Tab navigation */}
      <nav className="flex flex-wrap gap-2 border-b border-phyt-ink/10 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              tab === t.id
                ? "bg-phyt-yellow font-display font-bold"
                : "bg-phyt-ink/5 text-phyt-ink/70 hover:bg-phyt-ink/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {!data && isLoading ? (
        <div className="py-20 text-center text-phyt-ink/50">Loading metrics…</div>
      ) : data ? (
        <>
          {tab === "overview" && (
            <>
              <KpiCards data={data} />

              <Section title="Trends" subtitle="Across the selected date range">
                <Charts data={data} />
              </Section>

              {optimisation && <Recommendations optimisation={optimisation} />}
            </>
          )}

          {tab === "campaigns" && (
            <Section title="Performance by campaign" subtitle="Apple Search Ads + RevenueCat attribution">
              <CampaignTable data={data} />
            </Section>
          )}

          {tab === "budget" && (
            <BudgetPlanner
              campaigns={data.asa.campaigns}
              days={data.asa.timeseries.length}
              currency={data.currency}
            />
          )}

          {tab === "keywords" && (
            <Section title="Keyword breakdown" subtitle="Bids, performance & a proposed bid for every keyword">
              <KeywordTable data={data} />
            </Section>
          )}

          {tab === "searchterms" && (
            <Section title="Search-term report" subtitle="What users actually searched">
              <SearchTermTable data={data} />
            </Section>
          )}

          {tab === "competitors" && (
            <Section
              title="Competitor & market overview"
              subtitle="Public App Store intelligence on rival apps, analysed for PHYT"
            >
              <CompetitorOverview isAdmin={isAdmin} />
            </Section>
          )}
        </>
      ) : (
        <div className="py-20 text-center text-phyt-ink/50">No data.</div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-2xl">{title}</h2>
        {subtitle && <p className="text-sm text-phyt-ink/55">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
