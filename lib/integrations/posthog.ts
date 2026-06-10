import type { DateRange, PostHogData, SeriesPoint } from "./types";
import { samplePostHog } from "./sample";

/**
 * PostHog client via the HogQL query API.
 * Auth: Bearer personal API key (phx_...). Host is region-specific
 * (https://us.posthog.com or https://eu.posthog.com).
 * Docs: https://posthog.com/docs/api/query
 */

type Env = Record<string, string | undefined>;

function creds(env: Env) {
  const { POSTHOG_API_KEY, POSTHOG_PROJECT_ID } = env;
  const host = env.POSTHOG_HOST || "https://us.posthog.com";
  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) return null;
  return { key: POSTHOG_API_KEY, projectId: POSTHOG_PROJECT_ID, host };
}

async function hogql<T = unknown[]>(
  c: NonNullable<ReturnType<typeof creds>>,
  query: string,
): Promise<T[]> {
  const res = await fetch(`${c.host}/api/projects/${c.projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PostHog query failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { results?: T[] };
  return json.results ?? [];
}

export async function getPostHogData(
  range: DateRange,
  env: Env,
): Promise<PostHogData> {
  const c = creds(env);
  if (!c) return samplePostHog(range);

  const from = `${range.start} 00:00:00`;
  const to = `${range.end} 23:59:59`;

  try {
    const [series, top, totals] = await Promise.all([
      // Daily active users + event volume
      hogql<[string, number, number]>(
        c,
        `SELECT toDate(timestamp) AS day, count(DISTINCT person_id) AS users, count() AS events
         FROM events WHERE timestamp >= toDateTime('${from}') AND timestamp <= toDateTime('${to}')
         GROUP BY day ORDER BY day`,
      ),
      // Top events by volume
      hogql<[string, number]>(
        c,
        `SELECT event, count() AS c FROM events
         WHERE timestamp >= toDateTime('${from}') AND timestamp <= toDateTime('${to}')
         GROUP BY event ORDER BY c DESC LIMIT 6`,
      ),
      // Period totals
      hogql<[number, number]>(
        c,
        `SELECT count(DISTINCT person_id) AS users, count() AS events FROM events
         WHERE timestamp >= toDateTime('${from}') AND timestamp <= toDateTime('${to}')`,
      ),
    ]);

    const timeseries: SeriesPoint[] = series.map((r) => ({
      date: String(r[0]),
      activeUsers: Number(r[1]),
      events: Number(r[2]),
    }));

    const activeUsers = Number(totals[0]?.[0] ?? 0);
    const totalEvents = Number(totals[0]?.[1] ?? 0);
    const dau = timeseries.length
      ? (timeseries[timeseries.length - 1].activeUsers as number)
      : 0;

    return {
      source: "live",
      activeUsers,
      dau,
      totalEvents,
      retentionRate: samplePostHog(range).retentionRate, // requires a retention insight; sampled for now
      topEvents: top.map((r) => ({ event: String(r[0]), count: Number(r[1]) })),
      timeseries,
    };
  } catch (e) {
    const fallback = samplePostHog(range);
    fallback.error = `PostHog: ${e instanceof Error ? e.message : "request failed"}`;
    return fallback;
  }
}
