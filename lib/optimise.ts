import Anthropic from "@anthropic-ai/sdk";
import type {
  BidRecommendation,
  DashboardData,
  Optimisation,
  PauseRecommendation,
  StructuralRecommendation,
} from "./integrations/types";

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const MIN_BID = 0.1;

function targetCpi(data: DashboardData): number {
  return data.kpis.find((k) => k.metric === "cpa")?.target ?? 12;
}

const MAX_BIDS = 5; // surface the 5 highest-impact bid changes

/**
 * Decide a bid move for one keyword from its economics: cost-per-sub vs LTV
 * first (the profit signal), then install efficiency (CPI vs target) when there
 * are no subs yet. Returns a direction + multiplier + plain-English rationale.
 * Always returns a call for a keyword with real spend — no "hold" — so the
 * panel always has concrete actions to show.
 */
function bidDecision(
  k: DashboardData["asa"]["keywords"][number],
  ltv: number,
  tCpi: number,
): { action: "increase" | "decrease"; factor: number; rationale: string } | null {
  if (k.spend <= 0 && k.taps <= 0) return null;

  // 1. Subscription economics — strongest signal when we have conversions.
  if (k.subscriptions >= 1 && k.costPerSub > 0) {
    const ltvCac = ltv / k.costPerSub;
    if (k.costPerSub <= ltv * 0.7)
      return { action: "increase", factor: 1.2, rationale: `LTV:CAC ${ltvCac.toFixed(1)}:1 — £${k.costPerSub.toFixed(0)}/sub well under £${ltv.toFixed(0)} LTV. Scale up.` };
    if (k.costPerSub > ltv)
      return { action: "decrease", factor: 0.75, rationale: `£${k.costPerSub.toFixed(0)}/sub over £${ltv.toFixed(0)} LTV (LTV:CAC ${ltvCac.toFixed(1)}:1). Pull back.` };
    return { action: "increase", factor: 1.08, rationale: `£${k.costPerSub.toFixed(0)}/sub under £${ltv.toFixed(0)} LTV (LTV:CAC ${ltvCac.toFixed(1)}:1) — modest headroom.` };
  }

  // 2. No subs yet — judge on install efficiency vs the CPI target.
  if (k.installs === 0 && k.taps >= 5)
    return { action: "decrease", factor: 0.7, rationale: `${k.taps} taps, £${k.spend.toFixed(0)} spent, 0 installs — cut the bid.` };
  if (k.cpa > 0 && k.cpa > tCpi * 1.3)
    return { action: "decrease", factor: 0.85, rationale: `CPI £${k.cpa.toFixed(2)} above £${tCpi} target, no subs — reduce.` };
  if (k.cpa > 0 && k.cpa <= tCpi * 0.8 && k.installs >= 1)
    return { action: "increase", factor: 1.1, rationale: `CPI £${k.cpa.toFixed(2)} under £${tCpi} target (CPT £${k.cpt.toFixed(2)}) — scale cautiously, watch for subs.` };
  if (k.cpa > 0)
    return { action: "decrease", factor: 0.92, rationale: `CPI £${k.cpa.toFixed(2)} near target but no subs yet — trim until it converts.` };
  return { action: "decrease", factor: 0.9, rationale: `£${k.spend.toFixed(0)} spent with little signal (CPT £${k.cpt.toFixed(2)}) — trim and monitor.` };
}

/**
 * Deterministic, profit-first bidding rules — no API key needed. Surfaces the
 * top ${MAX_BIDS} bid changes (highest spend first) and the campaigns to review,
 * driven by CPI/CPT and cost-per-trial/sub against the blended LTV.
 */
export function heuristicOptimisation(data: DashboardData): Optimisation {
  const ltv = data.ltv.blendedLtv;
  const tCpi = targetCpi(data);
  const bidRecommendations: BidRecommendation[] = [];

  for (const k of [...data.asa.keywords].sort((a, b) => b.spend - a.spend)) {
    const d = bidDecision(k, ltv, tCpi);
    if (!d) continue;
    const proposedBid = Math.max(MIN_BID, round(k.bid * d.factor));
    bidRecommendations.push({
      keywordId: k.keywordId,
      keyword: k.keyword,
      campaignName: k.campaignName,
      matchType: k.matchType,
      currentBid: k.bid,
      proposedBid,
      action: d.action,
      rationale: d.rationale,
    });
    if (bidRecommendations.length >= MAX_BIDS) break;
  }

  // Campaigns to review: flagged on install efficiency (CPI vs target), not subs
  // or LTV — volumes are still too low to model conversions reliably. Worst CPI
  // first; campaigns spending with no installs at all surface ahead of those.
  const pauseRecommendations: PauseRecommendation[] = [...data.asa.campaigns]
    .filter(
      (c) =>
        c.status === "ENABLED" &&
        c.spend > 0 &&
        (c.cpa > tCpi || (c.installs === 0 && c.spend > tCpi)),
    )
    .sort((a, b) => {
      const aZero = a.installs === 0;
      const bZero = b.installs === 0;
      if (aZero !== bZero) return aZero ? -1 : 1; // no-install campaigns first
      if (aZero && bZero) return b.spend - a.spend;
      return b.cpa - a.cpa; // then worst CPI first
    })
    .slice(0, 4)
    .map((c) => ({
      campaignId: c.id,
      campaignName: c.name,
      rationale:
        c.installs === 0
          ? `£${c.spend.toFixed(0)} spent, 0 installs — no CPI to show for it, review.`
          : `CPI £${c.cpa.toFixed(2)} vs £${tCpi} target on £${c.spend.toFixed(0)} spend — reduce bids/review.`,
    }));

  // Search-term harvesting + negatives.
  const exactKeywords = new Set(
    data.asa.keywords.filter((k) => k.matchType === "EXACT").map((k) => k.keyword.toLowerCase()),
  );
  const structuralRecommendations: StructuralRecommendation[] = [];
  for (const st of [...data.asa.searchTerms].sort((a, b) => b.spend - a.spend)) {
    // Apple redacts low-volume search-term text — skip blanks, there's nothing
    // actionable to add or negate.
    if (!st.searchTerm || !st.searchTerm.trim()) continue;
    if (st.installs >= 3 && !exactKeywords.has(st.searchTerm.toLowerCase())) {
      structuralRecommendations.push({
        type: "add_keyword",
        title: `Add “${st.searchTerm}” as exact match`,
        detail: `${st.installs} installs at £${st.cpa.toFixed(2)} CPI via broad — capture it with a dedicated exact keyword and bid.`,
      });
    } else if (st.taps >= 10 && st.installs === 0) {
      structuralRecommendations.push({
        type: "negative_keyword",
        title: `Negative “${st.searchTerm}”`,
        detail: `${st.taps} taps, £${st.spend.toFixed(2)} spent, 0 installs — add as a negative keyword.`,
      });
    }
    if (structuralRecommendations.length >= 6) break;
  }

  const ups = bidRecommendations.filter((b) => b.action === "increase").length;
  const downs = bidRecommendations.filter((b) => b.action === "decrease").length;
  const blendedCac =
    data.asa.campaigns.reduce((a, c) => a + c.subscriptions, 0) > 0
      ? ltv /
        (data.asa.totals.spend /
          data.asa.campaigns.reduce((a, c) => a + c.subscriptions, 0))
      : 0;

  const summary =
    `${ups} bid increase${ups === 1 ? "" : "s"} and ${downs} decrease${downs === 1 ? "" : "s"} recommended, ` +
    `${pauseRecommendations.length} campaign${pauseRecommendations.length === 1 ? "" : "s"} to review, ` +
    `and ${structuralRecommendations.length} structural opportunit${structuralRecommendations.length === 1 ? "y" : "ies"}. ` +
    `Blended LTV:CAC is ${blendedCac.toFixed(2)}:1 on £${data.asa.totals.spend.toFixed(0)} spend.`;

  return {
    forDate: data.range.end,
    generatedBy: "heuristic",
    summary,
    bidRecommendations,
    pauseRecommendations,
    structuralRecommendations,
  };
}

// ---------------- Claude engine ----------------

const SYSTEM = `You are a senior Apple Search Ads media buyer for PHYT, a fitness app. You optimise for PROFIT, measured as LTV:CAC using the blended lifetime value provided. All money is GBP (£).

Principles:
- Raise bids on keywords with healthy LTV:CAC (cost-per-sub comfortably below blended LTV) and enough volume.
- Lower or cut bids where cost-per-sub exceeds LTV, where spend produces no installs, or CPI is well above target.
- Only recommend a bid change when the data justifies it; never touch keywords with too little signal (under ~15 taps).
- Harvest converting search terms into exact-match keywords; add wasteful zero-install terms as negatives.
- Flag campaigns running below break-even (LTV:CAC < 1) for pausing or restructure.
- Keep each rationale under 20 words, specific and number-driven.`;

const TOOL: Anthropic.Tool = {
  name: "submit_optimisation",
  description: "Submit the day's ASA optimisation recommendations.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "2-3 sentence overview for the client email." },
      bidRecommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            keywordId: { type: "string" },
            keyword: { type: "string" },
            campaignName: { type: "string" },
            matchType: { type: "string" },
            currentBid: { type: "number" },
            proposedBid: { type: "number" },
            action: { type: "string", enum: ["increase", "decrease"] },
            rationale: { type: "string" },
          },
          required: ["keywordId", "keyword", "currentBid", "proposedBid", "action", "rationale"],
        },
      },
      pauseRecommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            campaignId: { type: "string" },
            campaignName: { type: "string" },
            rationale: { type: "string" },
          },
          required: ["campaignId", "campaignName", "rationale"],
        },
      },
      structuralRecommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["add_keyword", "negative_keyword", "other"] },
            title: { type: "string" },
            detail: { type: "string" },
          },
          required: ["type", "title", "detail"],
        },
      },
    },
    required: ["summary", "bidRecommendations", "pauseRecommendations", "structuralRecommendations"],
  },
};

function buildPrompt(data: DashboardData): string {
  const c = data.currency;
  const kw = [...data.asa.keywords]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 40)
    .map(
      (k) =>
        `${k.keywordId} | "${k.keyword}" (${k.matchType}, ${k.campaignName}) bid £${k.bid} | spend £${k.spend} taps ${k.taps} installs ${k.installs} CPI £${k.cpa} trials ${k.trials} subs ${k.subscriptions} cost/sub £${k.costPerSub}`,
    )
    .join("\n");
  const st = [...data.asa.searchTerms]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30)
    .map(
      (s) =>
        `"${s.searchTerm}" (matched ${s.matchedKeyword ?? "—"}, ${s.matchType}) spend £${s.spend} taps ${s.taps} installs ${s.installs} CPI £${s.cpa}`,
    )
    .join("\n");
  const camp = data.asa.campaigns
    .map(
      (c2) =>
        `${c2.id} | ${c2.name} (${c2.status}) spend £${c2.spend} installs ${c2.installs} subs ${c2.subscriptions} LTV:CAC ${c2.ltvCac}`,
    )
    .join("\n");

  return `Date range: ${data.range.start} to ${data.range.end}. Currency: ${c}.
Blended LTV: £${data.ltv.blendedLtv} (annual ${Math.round(data.ltv.annualShare * 100)}% / monthly ${Math.round(data.ltv.monthlyShare * 100)}%). Target CPI: £${targetCpi(data)}.

CAMPAIGNS:
${camp}

KEYWORDS:
${kw}

SEARCH TERMS:
${st}

Analyse and submit your recommendations via the tool.`;
}

/** Claude-powered optimisation. Falls back to the heuristic if no API key or on error. */
export async function generateOptimisation(
  data: DashboardData,
  env: Record<string, string | undefined> = process.env,
): Promise<Optimisation> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return heuristicOptimisation(data);

  const model = env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model,
      max_tokens: 3000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [TOOL],
      tool_choice: { type: "tool", name: "submit_optimisation" },
      messages: [{ role: "user", content: buildPrompt(data) }],
    });

    const block = resp.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return heuristicOptimisation(data);
    const input = block.input as Omit<Optimisation, "forDate" | "generatedBy" | "model">;

    return {
      forDate: data.range.end,
      generatedBy: "claude",
      model,
      summary: input.summary,
      bidRecommendations: (input.bidRecommendations ?? []).map((b) => ({
        ...b,
        proposedBid: Math.max(MIN_BID, round(b.proposedBid)),
      })),
      pauseRecommendations: input.pauseRecommendations ?? [],
      structuralRecommendations: input.structuralRecommendations ?? [],
    };
  } catch {
    return heuristicOptimisation(data);
  }
}

/** Map an optimisation's bid changes onto the keyword rows (sets proposedBid + bidAction). */
export function applyOptimisation(data: DashboardData, opt: Optimisation) {
  const byId = new Map(opt.bidRecommendations.map((b) => [b.keywordId, b]));
  for (const k of data.asa.keywords) {
    const rec = byId.get(k.keywordId);
    k.proposedBid = rec ? rec.proposedBid : null;
    k.bidAction = rec ? rec.action : null;
  }
}
