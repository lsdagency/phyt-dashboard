import { SignJWT } from "jose";
import { createPrivateKey } from "node:crypto";
import type {
  AsaCampaign,
  AsaData,
  AsaKeyword,
  AsaSearchTerm,
  AsaTotals,
  DateRange,
  SeriesPoint,
} from "./types";
import { sampleAsa } from "./sample";

/**
 * Apple Search Ads API v5 client.
 *
 * Auth flow (client credentials):
 *  1. Sign a short JWT ("client secret") with your .p8 private key (ES256).
 *  2. Exchange it at appleid.apple.com for a bearer access token (~1h TTL).
 *  3. Call api.searchads.apple.com with that token + an X-AP-Context org header.
 *
 * Docs: https://developer.apple.com/documentation/apple_search_ads
 */

const TOKEN_URL = "https://appleid.apple.com/auth/oauth2/token";
const API_BASE = "https://api.searchads.apple.com/api/v5";

type Env = Record<string, string | undefined>;

function creds(env: Env) {
  const {
    ASA_CLIENT_ID,
    ASA_TEAM_ID,
    ASA_KEY_ID,
    ASA_ORG_ID,
    ASA_PRIVATE_KEY,
  } = env;
  if (
    !ASA_CLIENT_ID ||
    !ASA_TEAM_ID ||
    !ASA_KEY_ID ||
    !ASA_ORG_ID ||
    !ASA_PRIVATE_KEY
  ) {
    return null;
  }
  return {
    clientId: ASA_CLIENT_ID,
    teamId: ASA_TEAM_ID,
    keyId: ASA_KEY_ID,
    orgId: ASA_ORG_ID,
    privateKey: ASA_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(c: NonNullable<ReturnType<typeof creds>>) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  // Accept whichever PEM OpenSSL produced — PKCS#8 ("BEGIN PRIVATE KEY") or
  // SEC1 EC ("BEGIN EC PRIVATE KEY"). Node's createPrivateKey handles both.
  const key = createPrivateKey({ key: c.privateKey, format: "pem" });
  const clientSecret = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: c.keyId })
    .setIssuer(c.teamId)
    .setSubject(c.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(key);

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: c.clientId,
    client_secret: clientSecret,
    scope: "searchadsorg",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`ASA token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

async function postReport(
  c: NonNullable<ReturnType<typeof creds>>,
  path: string,
  payload: unknown,
) {
  const token = await getAccessToken(c);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-AP-Context": `orgId=${c.orgId}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`ASA ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Apple money fields are { amount: "12.34", currency: "USD" }.
const money = (m: { amount?: string } | undefined) => Number(m?.amount ?? 0);
const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

interface AsaMetricBlock {
  impressions?: number;
  taps?: number;
  totalInstalls?: number;
  installs?: number;
  ttr?: number;
  avgCPT?: { amount?: string; currency?: string };
  avgCPA?: { amount?: string; currency?: string };
  localSpend?: { amount?: string; currency?: string };
  conversionRate?: number;
}

function blockToTotals(m: AsaMetricBlock): AsaTotals & { currency: string } {
  const spend = money(m.localSpend);
  const taps = m.taps ?? 0;
  const installs = m.totalInstalls ?? m.installs ?? 0;
  const impressions = m.impressions ?? 0;
  return {
    spend: round(spend),
    impressions,
    taps,
    installs,
    ttr: round(m.ttr != null ? m.ttr * 100 : (taps / Math.max(impressions, 1)) * 100),
    cpt: round(m.avgCPT ? money(m.avgCPT) : spend / Math.max(taps, 1)),
    cpa: round(m.avgCPA ? money(m.avgCPA) : spend / Math.max(installs, 1)),
    conversionRate: round(
      m.conversionRate != null
        ? m.conversionRate * 100
        : (installs / Math.max(taps, 1)) * 100,
    ),
    currency: m.localSpend?.currency ?? "GBP",
  };
}

/** Sum an array of daily granularity metric blocks into one totals block. */
function sumGranularity(rows: AsaMetricBlock[]): AsaMetricBlock {
  return rows.reduce<AsaMetricBlock>(
    (acc, r) => ({
      impressions: (acc.impressions ?? 0) + (r.impressions ?? 0),
      taps: (acc.taps ?? 0) + (r.taps ?? 0),
      totalInstalls:
        (acc.totalInstalls ?? 0) + (r.totalInstalls ?? r.installs ?? 0),
      localSpend: {
        amount: String(money(acc.localSpend) + money(r.localSpend)),
        currency: r.localSpend?.currency ?? acc.localSpend?.currency ?? "USD",
      },
    }),
    {},
  );
}

function reportBody(range: DateRange, granularity?: "DAILY") {
  return {
    startTime: range.start,
    endTime: range.end,
    ...(granularity ? { granularity } : {}),
    selector: {
      orderBy: [{ field: "localSpend", sortOrder: "DESCENDING" }],
      pagination: { offset: 0, limit: 1000 },
    },
    returnRowTotals: true,
    returnRecordsWithNoMetrics: false,
    timeZone: "UTC",
  };
}

/** Fetch live ASA data, or fall back to deterministic sample data. */
export async function getAsaData(range: DateRange, env: Env): Promise<AsaData> {
  const c = creds(env);
  if (!c) return sampleAsa(range);

  try {
    // 1. Campaigns with DAILY granularity — gives us both per-campaign totals and the daily timeseries.
    const campaignsReport = (await postReport(c, "/reports/campaigns", reportBody(range, "DAILY"))) as {
      data?: { reportingDataResponse?: { row?: CampaignRow[] } };
    };
    const rows = campaignsReport.data?.reportingDataResponse?.row ?? [];

    const campaigns: AsaCampaign[] = [];
    const dailyAcc: Record<string, { spend: number; installs: number; taps: number; impressions: number }> = {};

    for (const row of rows) {
      const granRows = row.granularity ?? [];
      const totalsBlock = sumGranularity(granRows);
      const t = blockToTotals(totalsBlock);
      campaigns.push({
        id: String(row.metadata?.campaignId ?? ""),
        name: row.metadata?.campaignName ?? "Campaign",
        status: row.metadata?.campaignStatus ?? "",
        dailyBudget: money(row.metadata?.dailyBudgetAmount),
        ...t,
        // Revenue attribution filled by derive.ts (real attribution or install-share).
        trials: 0,
        subscriptions: 0,
        costPerTrial: 0,
        costPerSub: 0,
        ltvCac: 0,
      });
      for (const g of granRows) {
        const date = (g as AsaMetricBlock & { date?: string }).date ?? range.end;
        dailyAcc[date] ??= { spend: 0, installs: 0, taps: 0, impressions: 0 };
        dailyAcc[date].spend += money(g.localSpend);
        dailyAcc[date].installs += g.totalInstalls ?? g.installs ?? 0;
        dailyAcc[date].taps += g.taps ?? 0;
        dailyAcc[date].impressions += g.impressions ?? 0;
      }
    }

    const timeseries: SeriesPoint[] = Object.entries(dailyAcc)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        spend: round(v.spend),
        installs: v.installs,
        taps: v.taps,
        impressions: v.impressions,
      }));

    const totalsBlock = sumGranularity(
      rows.flatMap((r) => r.granularity ?? []),
    );
    const totalsFull = blockToTotals(totalsBlock);
    const { currency, ...totals } = totalsFull;

    // 2. Keyword + search-term reports per campaign (bounded to top campaigns by spend).
    const topCampaigns = [...campaigns]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    const keywords: AsaKeyword[] = [];
    const searchTerms: AsaSearchTerm[] = [];

    await Promise.all(
      topCampaigns.map(async (camp) => {
        const [kw, st] = await Promise.all([
          postReport(c, `/reports/campaigns/${camp.id}/keywords`, reportBody(range)).catch(() => null),
          postReport(c, `/reports/campaigns/${camp.id}/searchterms`, reportBody(range)).catch(() => null),
        ]);

        for (const row of (kw as KeywordReport)?.data?.reportingDataResponse?.row ?? []) {
          const t = blockToTotals(row.total ?? {});
          keywords.push({
            campaignId: camp.id,
            campaignName: camp.name,
            keywordId: String(row.metadata?.keywordId ?? ""),
            keyword: row.metadata?.keyword ?? "",
            matchType: row.metadata?.matchType ?? "",
            bid: money(row.metadata?.bidAmount),
            spend: t.spend,
            impressions: t.impressions,
            taps: t.taps,
            installs: t.installs,
            ttr: t.ttr,
            cpt: t.cpt,
            cpa: t.cpa,
            trials: 0,
            subscriptions: 0,
            costPerTrial: 0,
            costPerSub: 0,
            proposedBid: null,
            bidAction: null,
          });
        }

        for (const row of (st as SearchTermReport)?.data?.reportingDataResponse?.row ?? []) {
          const t = blockToTotals(row.total ?? {});
          searchTerms.push({
            campaignId: camp.id,
            campaignName: camp.name,
            searchTerm: row.metadata?.searchTermText ?? "",
            matchedKeyword: row.metadata?.keyword ?? null,
            matchType: row.metadata?.matchType ?? "",
            spend: t.spend,
            impressions: t.impressions,
            taps: t.taps,
            installs: t.installs,
            ttr: t.ttr,
            cpt: t.cpt,
            cpa: t.cpa,
          });
        }
      }),
    );

    return {
      source: "live",
      currency,
      totals,
      campaigns,
      keywords: keywords.sort((a, b) => b.spend - a.spend),
      searchTerms: searchTerms.sort((a, b) => b.spend - a.spend),
      timeseries,
    };
  } catch (e) {
    // Creds present but the call failed — show sample data, but surface the error.
    const fallback = sampleAsa(range);
    fallback.error = e instanceof Error ? e.message : "ASA request failed";
    return fallback;
  }
}

// ---- minimal ASA response shapes (only the fields we read) ----
interface CampaignRow {
  metadata?: {
    campaignId?: number | string;
    campaignName?: string;
    campaignStatus?: string;
    dailyBudgetAmount?: { amount?: string; currency?: string };
  };
  granularity?: (AsaMetricBlock & { date?: string })[];
  total?: AsaMetricBlock;
}
interface KeywordReport {
  data?: {
    reportingDataResponse?: {
      row?: {
        metadata?: {
          keywordId?: number | string;
          keyword?: string;
          matchType?: string;
          bidAmount?: { amount?: string };
        };
        total?: AsaMetricBlock;
      }[];
    };
  };
}
interface SearchTermReport {
  data?: {
    reportingDataResponse?: {
      row?: {
        metadata?: {
          searchTermText?: string;
          keyword?: string;
          matchType?: string;
        };
        total?: AsaMetricBlock;
      }[];
    };
  };
}
