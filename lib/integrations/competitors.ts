import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gt } from "drizzle-orm";
import { db, dbAvailable, schema } from "../db";

/**
 * Competitor / market intelligence from PUBLIC Apple data + Claude.
 *
 * Sources (all free, no per-app limits): the iTunes Lookup API for metadata,
 * release notes and screenshots, and the App Store customer-reviews RSS for
 * review mining. Claude then synthesises each competitor and a market snapshot.
 * Real ASA bid keywords / spend / CPPs are private to Apple and NOT available
 * here — inferred keywords come from public listing text only.
 */

type Env = Record<string, string | undefined>;

export type CompetitorPriority = "high" | "medium" | "watch";

export interface CompetitorSeed {
  key: string;
  name: string;
  appId: number;
  country: string; // storefront: "gb" | "us" ...
  group: string;
  priority: CompetitorPriority;
  whyTrack: string;
}

export interface CompetitorReview {
  rating: number;
  title: string;
  body: string;
}

export interface CompetitorAppData {
  name: string;
  developer: string;
  genre: string;
  rating: number;
  ratingCount: number;
  price: string;
  version: string;
  updated: string; // ISO date
  releaseNotes: string;
  description: string;
  icon: string;
  url: string;
  screenshots: string[];
  reviews: CompetitorReview[];
}

export interface CompetitorAnalysis {
  summary: string;
  inferredKeywords: string[];
  positioning: string;
  messagingFlags: string[];
  reviewThemes: string[];
  releaseWatch: string;
  vsPhyt: string[];
}

export interface CompetitorEntry extends CompetitorSeed {
  app: CompetitorAppData | null;
  analysis: CompetitorAnalysis | null;
  error?: string;
}

export interface CompetitorAction {
  priority: "high" | "medium" | "low";
  text: string;
}

export interface CompetitorReport {
  generatedAt: string;
  aiEnabled: boolean;
  aiError?: string; // set when a Claude key is present but the calls failed
  snapshot: string[];
  actions: CompetitorAction[];
  competitors: CompetitorEntry[];
}

// PHYT positioning — anchors the "vs PHYT" analysis (from the client brief).
const PHYT_CONTEXT = `PHYT is a UK computer-vision body-composition scanning app: an AI photo scan, DEXA-validated, ~3.1% mean absolute error. It targets accuracy-focused users and GLP-1 users who want to track body-composition change (muscle/fat), not just weight. Differentiators: scan accuracy vs BIA smart scales (which are inconsistent), clinical validation, and GLP-1 body-composition messaging.`;

// Writing style for everything Claude returns. Plain, skimmable, no AI tells.
const STYLE = `WRITING STYLE: Write like a person talking to a colleague, not a marketer. Short, plain sentences. Never use em dashes or en dashes; use commas or full stops. Ban filler and AI-speak: "leverage", "robust", "seamless", "landscape", "in today's", "it's worth noting", "delve", "unlock", "elevate", "poised to", "when it comes to". Say the concrete thing.`;

// Safety net: strip any dashes that slip through and tidy whitespace.
function plain(s: string): string {
  return (s || "").replace(/\s*[—–]\s*/g, ", ").replace(/\s{2,}/g, " ").trim();
}
function plainArr(a: string[] | undefined): string[] {
  return (a ?? []).map(plain).filter(Boolean);
}

// Priority set chosen for v1 (resolved App Store IDs). Editable-in-Settings later.
export const COMPETITOR_SEED: CompetitorSeed[] = [
  { key: "spren", name: "Spren", appId: 1664503999, country: "gb", group: "Direct AI / CV scan", priority: "high", whyTrack: "Best-funded direct rival. DEXA-validated. Known scan-quality issues — acquisition opportunity." },
  { key: "methreesixty", name: "MeThreeSixty", appId: 1472541261, country: "gb", group: "Direct AI / CV scan", priority: "high", whyTrack: "Top-rated by volume. Confirmed running ASA on 'body composition tracker'." },
  { key: "zing", name: "Zing AI", appId: 1552207792, country: "gb", group: "Direct AI / CV scan", priority: "high", whyTrack: "Major AI fitness coach with body-composition scanning. Big direct rival on AI body-scan terms." },
  { key: "skor", name: "SKŌR", appId: 6760481469, country: "gb", group: "Direct AI / CV scan", priority: "high", whyTrack: "GLP-1 visual-transformation angle. Keyword overlap on body-transformation terms." },
  { key: "bodymapp", name: "Bodymapp", appId: 1081678481, country: "gb", group: "Direct AI / CV scan", priority: "medium", whyTrack: "At-home body scans, posture + body comp. Watch for GLP-1 platform acquisition." },
  { key: "withings", name: "Withings (Health Mate)", appId: 542701020, country: "gb", group: "Home BIA / smart scale", priority: "high", whyTrack: "Premium, health-engaged users. BIA inconsistency vs PHYT 3.1% MAE = messaging gap." },
  { key: "eufy", name: "eufy Life", appId: 1153481724, country: "gb", group: "Home BIA / smart scale", priority: "high", whyTrack: "PHYT's direct benchmark (MAE 6.2%). Mine reviews for BIA frustration → CPP copy." },
  { key: "myfitnesspal", name: "MyFitnessPal", appId: 341232718, country: "gb", group: "GLP-1 / weight-loss adjacent", priority: "high", whyTrack: "Dominates weight-loss terms. No body comp. Biggest messaging gap for PHYT to exploit." },
  { key: "noom", name: "Noom", appId: 634598719, country: "gb", group: "GLP-1 / weight-loss adjacent", priority: "high", whyTrack: "Aggressive ASA spender. GLP-1 programme live. Watch for body-comp language in CPPs." },
  { key: "calibrate", name: "Calibrate", appId: 1514232557, country: "us", group: "GLP-1 / weight-loss adjacent", priority: "high", whyTrack: "Direct GLP-1 prescriber (US). If it adds body-comp scanning — escalate immediately." },
  { key: "found", name: "Found", appId: 1581179653, country: "us", group: "GLP-1 / weight-loss adjacent", priority: "high", whyTrack: "Direct GLP-1 prescriber (US). If it adds body-comp scanning — escalate immediately." },
];

async function fetchReviews(seed: CompetitorSeed): Promise<CompetitorReview[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/${seed.country}/rss/customerreviews/id=${seed.appId}/sortBy=mostRecent/json`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const j = (await res.json()) as { feed?: { entry?: unknown[] } };
    const entries = j.feed?.entry ?? [];
    return entries
      .map((e) => e as Record<string, { label?: string }>)
      .filter((e) => e["im:rating"]?.label)
      .slice(0, 20)
      .map((e) => ({
        rating: Number(e["im:rating"].label),
        title: e.title?.label ?? "",
        body: (e.content?.label ?? "").slice(0, 500),
      }));
  } catch {
    return [];
  }
}

async function fetchAppData(seed: CompetitorSeed): Promise<CompetitorAppData | null> {
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${seed.appId}&country=${seed.country}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`lookup ${res.status}`);
  const j = (await res.json()) as { results?: Record<string, unknown>[] };
  const r = j.results?.[0];
  if (!r) throw new Error("app not found");
  const shots = (r.screenshotUrls as string[])?.length
    ? (r.screenshotUrls as string[])
    : ((r.ipadScreenshotUrls as string[]) ?? []);
  const reviews = await fetchReviews(seed);
  return {
    name: String(r.trackName ?? seed.name),
    developer: String(r.artistName ?? ""),
    genre: String(r.primaryGenreName ?? ""),
    rating: Number(r.averageUserRating ?? 0),
    ratingCount: Number(r.userRatingCount ?? 0),
    price: String(r.formattedPrice ?? "—"),
    version: String(r.version ?? ""),
    updated: String(r.currentVersionReleaseDate ?? ""),
    releaseNotes: String(r.releaseNotes ?? ""),
    description: String(r.description ?? ""),
    icon: String(r.artworkUrl100 ?? ""),
    url: String(r.trackViewUrl ?? ""),
    screenshots: shots.slice(0, 6),
    reviews,
  };
}

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: "submit_competitor_analysis",
  description: "Submit the analysis of one competitor app from an Apple Search Ads / ASO perspective.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One plain-English sentence: who they are, their angle, and the headline threat or opportunity for PHYT. No dashes, no jargon." },
      inferredKeywords: { type: "array", items: { type: "string" }, description: "6-12 App Store search terms this app is clearly optimising for, inferred from its name/description." },
      positioning: { type: "string", description: "One or two plain sentences on how the app positions itself." },
      messagingFlags: { type: "array", items: { type: "string" }, description: "Notable angles present, e.g. 'GLP-1 language', 'clinical/DEXA', 'body-composition claims', 'BIA smart-scale'. Empty if none." },
      reviewThemes: { type: "array", items: { type: "string" }, description: "3-6 recurring themes from reviews (praise or, especially, frustrations like accuracy/BIA inconsistency)." },
      releaseWatch: { type: "string", description: "Any notable recent feature/roadmap signal from the release notes to watch (esp. body-composition or scanning features). Empty string if nothing notable." },
      vsPhyt: { type: "array", items: { type: "string" }, description: "2-4 short bullet points on the gaps or opportunities for PHYT vs this competitor. Each bullet one plain sentence." },
    },
    required: ["summary", "inferredKeywords", "positioning", "messagingFlags", "reviewThemes", "releaseWatch", "vsPhyt"],
  },
};

async function analyseCompetitor(
  seed: CompetitorSeed,
  app: CompetitorAppData,
  client: Anthropic,
  model: string,
): Promise<CompetitorAnalysis> {
  const reviewText = app.reviews
    .slice(0, 12)
    .map((r) => `★${r.rating} ${r.title}: ${r.body}`)
    .join("\n");
  const prompt = `${PHYT_CONTEXT}

Competitor: ${app.name} by ${app.developer} (${app.genre}). Why we track it: ${seed.whyTrack}
Rating ${app.rating.toFixed(1)} (${app.ratingCount} ratings). Price: ${app.price}. Updated ${app.updated}.

DESCRIPTION:
${app.description.slice(0, 2000)}

LATEST RELEASE NOTES:
${app.releaseNotes.slice(0, 600) || "—"}

RECENT REVIEWS:
${reviewText || "(no reviews available)"}

Analyse this competitor from an Apple Search Ads / ASO angle for PHYT and submit via the tool.

${STYLE}`;
  const resp = await client.messages.create({
    model,
    max_tokens: 1200,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: "submit_competitor_analysis" },
    messages: [{ role: "user", content: prompt }],
  });
  const block = resp.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("no tool_use block in Claude response");
  const a = block.input as CompetitorAnalysis;
  return {
    summary: plain(a.summary),
    inferredKeywords: a.inferredKeywords ?? [],
    positioning: plain(a.positioning),
    messagingFlags: a.messagingFlags ?? [],
    reviewThemes: plainArr(a.reviewThemes),
    releaseWatch: plain(a.releaseWatch),
    vsPhyt: plainArr(a.vsPhyt),
  };
}

const SNAPSHOT_TOOL: Anthropic.Tool = {
  name: "submit_market_snapshot",
  description: "Submit a market snapshot and this week's prioritised competitive actions for PHYT.",
  input_schema: {
    type: "object",
    properties: {
      snapshot: { type: "array", items: { type: "string" }, description: "3-5 short bullet points on where PHYT sits vs this competitor set and the key threats and openings. Each bullet one plain sentence, no preamble, no dashes." },
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            priority: { type: "string", enum: ["high", "medium", "low"] },
            text: { type: "string", description: "A specific, actionable recommendation." },
          },
          required: ["priority", "text"],
        },
        description: "3-6 actions. Follow these rules: GLP-1 or clinical language in a competitor = review PHYT CPP positioning; a body-composition/scan feature launching in a GLP-1 or weight-loss app = escalate (high, flag to Ben); recurring BIA/accuracy complaints = strengthen PHYT reliability messaging + CPP copy; a keyword a competitor targets that PHYT should own = gap to close.",
      },
    },
    required: ["snapshot", "actions"],
  },
};

async function marketSnapshot(
  entries: CompetitorEntry[],
  client: Anthropic,
  model: string,
): Promise<{ snapshot: string[]; actions: CompetitorAction[] }> {
  const digest = entries
    .filter((e) => e.app)
    .map((e) => {
      const a = e.analysis;
      return `${e.name} (${e.group}, ${e.priority}): ${a?.positioning ?? e.app!.description.slice(0, 160)}. Flags: ${a?.messagingFlags?.join(", ") || "none"}. Review themes: ${a?.reviewThemes?.join("; ") || "none"}. Release watch: ${a?.releaseWatch || "none"}.`;
    })
    .join("\n");
  const resp = await client.messages.create({
    model,
    max_tokens: 1200,
    tools: [SNAPSHOT_TOOL],
    tool_choice: { type: "tool", name: "submit_market_snapshot" },
    messages: [{ role: "user", content: `${PHYT_CONTEXT}\n\nCOMPETITOR SET:\n${digest}\n\nSubmit the market snapshot and prioritised actions for PHYT via the tool.\n\n${STYLE}` }],
  });
  const block = resp.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("no tool_use block in Claude response");
  const out = block.input as { snapshot: string[]; actions: CompetitorAction[] };
  return {
    snapshot: plainArr(out.snapshot),
    actions: (out.actions ?? []).map((a) => ({ priority: a.priority, text: plain(a.text) })),
  };
}

/** Build the full competitor report: fetch all apps + Claude analysis + snapshot. */
export async function buildCompetitorReport(env: Env): Promise<CompetitorReport> {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  const model = env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  // A stray ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL in the environment makes
  // the SDK add an `Authorization: Bearer` header (or hit a different host)
  // alongside x-api-key — which Anthropic's edge rejects with a bodiless 401.
  // Drop them and pin the base URL so the SDK sends exactly what curl sends.
  if (apiKey) {
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_BASE_URL;
  }
  const client = apiKey
    ? new Anthropic({ apiKey, baseURL: "https://api.anthropic.com" })
    : null;
  // Non-secret fingerprint of the key the server actually resolved.
  const keyHint = apiKey ? `${apiKey.slice(0, 7)}…(${apiKey.length} chars)` : "MISSING";

  // Ground-truth probe: hit the API exactly like curl (only x-api-key), so the
  // banner shows whether the *server* itself can auth — isolating SDK vs env vs
  // network. Empty on success paths where it isn't needed.
  let probe = "";
  if (apiKey) {
    try {
      const pr = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: "user", content: "ping" }] }),
      });
      probe = ` | raw-fetch ${pr.status}: ${((await pr.text()) || "(empty)").slice(0, 120).replace(/\s+/g, " ")}`;
    } catch (e) {
      probe = ` | raw-fetch threw: ${e instanceof Error ? e.message : "?"}`;
    }
  }

  // Fetch every app's public data in parallel.
  const apps = await Promise.all(
    COMPETITOR_SEED.map(async (seed) => {
      try {
        return { seed, app: await fetchAppData(seed), error: undefined as string | undefined };
      } catch (e) {
        return { seed, app: null, error: e instanceof Error ? e.message : "fetch failed" };
      }
    }),
  );

  // Analyse each (in parallel) when Claude is available. Capture the first error
  // so a mis-configured key surfaces instead of silently showing "pending".
  let aiError: string | undefined;
  const analyses = await Promise.all(
    apps.map(async ({ seed, app }) => {
      if (!client || !app) return null;
      try {
        return await analyseCompetitor(seed, app, client, model);
      } catch (e) {
        if (!aiError)
          aiError = `${e instanceof Error ? e.message : "Claude analysis failed"} [key ${keyHint}, model ${model}]${probe}`;
        return null;
      }
    }),
  );

  const competitors: CompetitorEntry[] = apps.map(({ seed, app, error }, i) => ({
    ...seed,
    app,
    analysis: analyses[i],
    error,
  }));

  let snapshot: string[] = [];
  let actions: CompetitorAction[] = [];
  if (client) {
    try {
      const s = await marketSnapshot(competitors, client, model);
      snapshot = s.snapshot;
      actions = s.actions;
    } catch (e) {
      if (!aiError)
        aiError = `${e instanceof Error ? e.message : "Claude snapshot failed"} [key ${keyHint}, model ${model}]${probe}`;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    aiEnabled: Boolean(client),
    aiError,
    snapshot,
    actions,
    competitors,
  };
}

// ---- weekly cache (reuses metric_cache) ----
const CACHE_SOURCE = "competitors";
const CACHE_KEY = "report";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getCompetitorReport(
  env: Env,
  opts: { refresh?: boolean } = {},
): Promise<CompetitorReport> {
  if (!opts.refresh && dbAvailable && db) {
    const rows = await db
      .select()
      .from(schema.metricCache)
      .where(
        and(
          eq(schema.metricCache.source, CACHE_SOURCE),
          eq(schema.metricCache.cacheKey, CACHE_KEY),
          gt(schema.metricCache.fetchedAt, new Date(Date.now() - WEEK_MS)),
        ),
      )
      .orderBy(desc(schema.metricCache.fetchedAt))
      .limit(1);
    if (rows[0]) return rows[0].payload as CompetitorReport;
  }

  const report = await buildCompetitorReport(env);
  if (dbAvailable && db) {
    await db.insert(schema.metricCache).values({
      source: CACHE_SOURCE,
      cacheKey: CACHE_KEY,
      payload: report,
    });
  }
  return report;
}
