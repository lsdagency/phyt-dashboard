import { eq, sql } from "drizzle-orm";
import { db, dbAvailable, schema } from "./db";
import { encrypt, decrypt } from "./crypto";

export interface CredField {
  key: string;
  label: string;
  secret: boolean;
  multiline?: boolean;
  placeholder?: string;
}
export interface CredGroup {
  provider: string;
  title: string;
  hint: string;
  docUrl: string;
  docLabel: string;
  fields: CredField[];
}

export const CREDENTIAL_GROUPS: CredGroup[] = [
  {
    provider: "asa",
    title: "Apple Search Ads",
    hint: "In the ASA UI: Account Settings → API → create an API certificate. Paste the downloaded .p8 file's contents into the private key.",
    docUrl:
      "https://developer.apple.com/documentation/apple_ads/implementing-oauth-for-the-apple-search-ads-api",
    docLabel: "Apple Search Ads API setup guide",
    fields: [
      { key: "ASA_CLIENT_ID", label: "Client ID", secret: false },
      { key: "ASA_TEAM_ID", label: "Team ID", secret: false },
      { key: "ASA_KEY_ID", label: "Key ID", secret: false },
      { key: "ASA_ORG_ID", label: "Org ID", secret: false },
      { key: "ASA_PRIVATE_KEY", label: "Private key (.pem / .p8 contents)", secret: true, multiline: true },
    ],
  },
  {
    provider: "revenuecat",
    title: "RevenueCat",
    hint: "Project Settings → API Keys. Create a v2 secret key (sk_…). Project ID is in the project's general settings.",
    docUrl: "https://www.revenuecat.com/docs/api-v2",
    docLabel: "RevenueCat API v2 authentication docs",
    fields: [
      { key: "REVENUECAT_API_KEY", label: "Secret API key (v2)", secret: true },
      { key: "REVENUECAT_PROJECT_ID", label: "Project ID", secret: false },
    ],
  },
  {
    provider: "posthog",
    title: "PostHog",
    hint: "Settings → Personal API Keys → create a key. Project ID is in Project Settings. Host = your region (US or EU).",
    docUrl: "https://posthog.com/docs/api#authentication",
    docLabel: "PostHog API authentication docs",
    fields: [
      { key: "POSTHOG_API_KEY", label: "Personal API key", secret: true },
      { key: "POSTHOG_PROJECT_ID", label: "Project ID", secret: false },
      { key: "POSTHOG_HOST", label: "Host", secret: false, placeholder: "https://us.posthog.com" },
    ],
  },
  {
    provider: "anthropic",
    title: "Claude (Anthropic)",
    hint: "Powers the daily optimisation engine. Create an API key in the Anthropic Console under API Keys.",
    docUrl: "https://console.anthropic.com/settings/keys",
    docLabel: "Anthropic Console → API Keys",
    fields: [
      { key: "ANTHROPIC_API_KEY", label: "API key", secret: true },
      { key: "ANTHROPIC_MODEL", label: "Model (optional)", secret: false, placeholder: "claude-sonnet-4-6" },
    ],
  },
];

// Fields that are optional and shouldn't block a "Connected" status.
export const OPTIONAL_KEYS = new Set(["ANTHROPIC_MODEL", "POSTHOG_HOST"]);

const ALL_FIELDS = CREDENTIAL_GROUPS.flatMap((g) => g.fields);
export const ALL_KEYS = ALL_FIELDS.map((f) => f.key);
const SECRET_KEYS = new Set(ALL_FIELDS.filter((f) => f.secret).map((f) => f.key));

// In-memory fallback (no DATABASE_URL). Stores the encrypted payloads.
const mem = new Map<string, string>();

async function readEncrypted(): Promise<Map<string, string>> {
  if (dbAvailable && db) {
    const rows = await db.select().from(schema.appSettings);
    return new Map(rows.map((r) => [r.key, r.value]));
  }
  return new Map(mem);
}

export async function setCredential(key: string, value: string) {
  if (!ALL_KEYS.includes(key)) throw new Error("Unknown credential key");
  const enc = encrypt(value);
  if (dbAvailable && db) {
    await db
      .insert(schema.appSettings)
      .values({ key, value: enc })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value: enc, updatedAt: sql`now()` },
      });
  } else {
    mem.set(key, enc);
  }
  cache = null;
}

export async function deleteCredential(key: string) {
  if (dbAvailable && db) {
    await db.delete(schema.appSettings).where(eq(schema.appSettings.key, key));
  } else {
    mem.delete(key);
  }
  cache = null;
}

// ---- resolver: saved (decrypted) value wins over env var ----
let cache: { at: number; env: Record<string, string | undefined> } | null = null;
const TTL_MS = 15_000;

export async function resolveEnv(): Promise<Record<string, string | undefined>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.env;
  const stored = await readEncrypted();
  const env: Record<string, string | undefined> = {};
  for (const k of ALL_KEYS) {
    if (stored.has(k)) {
      try {
        env[k] = decrypt(stored.get(k)!);
      } catch {
        env[k] = process.env[k];
      }
    } else {
      env[k] = process.env[k];
    }
  }
  cache = { at: Date.now(), env };
  return env;
}

function mask(v: string) {
  if (v.length <= 6) return "••••";
  return `${v.slice(0, 3)}…${v.slice(-3)}`;
}

export interface CredStatus {
  key: string;
  configured: boolean;
  source: "saved" | "env" | "none";
  preview: string;
}

/** Masked status for the Settings UI — never returns full secrets. */
export async function credentialStatus(): Promise<CredStatus[]> {
  const stored = await readEncrypted();
  return ALL_KEYS.map((k) => {
    const inDb = stored.has(k);
    const envVal = process.env[k];
    let value: string | undefined;
    if (inDb) {
      try {
        value = decrypt(stored.get(k)!);
      } catch {
        value = undefined;
      }
    } else {
      value = envVal;
    }
    const configured = Boolean(value);
    const source: CredStatus["source"] = inDb ? "saved" : envVal ? "env" : "none";
    let preview = "";
    if (value) preview = SECRET_KEYS.has(k) ? mask(value) : value;
    return { key: k, configured, source, preview };
  });
}
