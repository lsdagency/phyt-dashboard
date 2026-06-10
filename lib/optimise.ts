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
const MIN_TAPS = 15; // below this, not enough signal to move a bid

function targetCpi(data: DashboardData): number {
  return data.kpis.find((k) => k.metric === "cpa")?.target ?? 12;
}

/**
 * Deterministic, profit-first bidding rules. Runs instantly with no API key, so
 * the dashboard's "Proposed bid" column is always populated. Optimises toward
 * LTV:CAC > 1 using the blended LTV.
 */
export function heuristicOptimisation(data: DashboardData): Optimisation {
  const ltv = data.ltv.blendedLtv;
  const tCpi = targetCpi(data);
  const bidRecommendations: BidRecommendation[] = [];

  for (const k of [...data.asa.keywords].sort((a, b) => b.spend - a.spend)) {
    if (k.taps < MIN_TAPS) continue;

    const ltvCac = k.subscriptions > 0 ? ltv / k.costPerSub : 0;
    let factor = 0;
    let action: "increase" | "decrease" | null = null;
    let rationale = "";

    if (k.subscriptions >= 2 && k.costPerSub <= ltv * 0.6) {
      factor = 1.15;
      action = "increase";
      rationale = `Strong LTV:CAC ${ltvCac.toFixed(1)}:1 (£${k.costPerSub.toFixed(0)}/sub vs £${ltv.toFixed(0)} LTV) — scale.`;
    } else if (k.subscriptions >= 1 && k.costPerSub > ltv) {
      factor = 0.75;
      action = "decrease";
      rationale = `Cost/sub £${k.costPerSub.toFixed(0)} above £${ltv.toFixed(0)} LTV (LTV:CAC ${ltvCac.toFixed(1)}) — trim.`;
    } else if (k.installs === 0 && k.taps >= MIN_TAPS * 2) {
      factor = 0.7;
      action = "decrease";
      rationale = `£${k.spend.toFixed(0)} spent across ${k.taps} taps with 0 installs — cut back.`;
    } else if (k.cpa > tCpi * 1.5) {
      factor = 0.85;
      action = "decrease";
      rationale = `CPI £${k.cpa.toFixed(2)} well above £${tCpi} target — reduce.`;
    } else if (k.cpa <= tCpi * 0.7 && k.installs >= 5) {
      factor = 1.1;
      action = "increase";
      rationale = `Efficient CPI £${k.cpa.toFixed(2)} below £${tCpi} target — room to scale.`;
    }

    if (action) {
      const proposedBid = Math.max(MIN_BID, round(k.bid * factor));
      if (proposedBid !== k.bid) {
        bidRecommendations.push({
          keywordId: k.keywordId,
          keyword: k.keyword,
          campaignName: k.campaignName,
          matchType: k.matchType,
          currentBid: k.bid,
          proposedBid,
          action,
          rationale,
        });
      }
    }
  }

  // Campaigns running below break-even.
  const pauseRecommendations: PauseRecommendation[] = data.asa.campaigns
    .filter((c) => c.status === "ENABLED" && c.subscriptions >= 1 && c.ltvCac > 0 && c.ltvCac < 0.8)
    .map((c) => ({
      campaignId: c.id,
      campaignName: c.name,
      rationale: `LTV:CAC ${c.ltvCac.toFixed(2)} on £${c.spend.toFixed(0)} spend — below break-even.`,
    }));

  // Search-term harvesting + negatives.
  const exactKeywords = new Set(
    data.asa.keywords.filter((k) => k.matchType === "EXACT").map((k) => k.keyword.toLowerCase()),
  );
  const structuralRecommendations: StructuralRecommendation[] = [];
  for (const st of [...data.asa.searchTerms].sort((a, b) => b.spend - a.spend)) {
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
    `${pauseRecommendations.length} campaign${pauseRecommendations.length === 1 ? "" : "s"} below break-even, ` +
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
