import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  date,
  jsonb,
  integer,
  real,
  boolean,
  index,
} from "drizzle-orm/pg-core";

/**
 * Dashboard accounts. role "admin" = media buyer (full access + settings).
 * role "client" = PHYT (view-only). A client with receivesDailyReport=true
 * also gets the daily email — so login access and email recipients are one list.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 120 }).notNull().default(""),
  role: varchar("role", { length: 16 }).notNull().default("client"), // admin | client
  receivesDailyReport: boolean("receives_daily_report").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Claude's daily optimisation output, one row per day.
 * `recommendations` holds the structured JSON (bid increases/decreases,
 * campaigns to pause, structural changes); `summary` is the prose for the email.
 */
export const optimisations = pgTable("optimisations", {
  id: serial("id").primaryKey(),
  forDate: date("for_date").notNull(),
  recommendations: jsonb("recommendations").notNull(),
  summary: text("summary").notNull().default(""),
  status: varchar("status", { length: 16 }).notNull().default("draft"), // draft | approved | sent
  model: varchar("model", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Encrypted key/value store for integration credentials entered via Settings.
 * `value` is an AES-256-GCM payload (never plaintext). One row per credential field.
 */
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Per-metric targets the dashboard compares against (e.g. CPA <= 12, trial conv >= 35%). */
export const kpiTargets = pgTable("kpi_targets", {
  id: serial("id").primaryKey(),
  metric: varchar("metric", { length: 64 }).notNull().unique(),
  target: real("target").notNull(),
  direction: varchar("direction", { length: 8 }).notNull().default("up"), // up = higher is better, down = lower is better
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Audit trail of every daily client email. */
export const emailLog = pgTable("email_log", {
  id: serial("id").primaryKey(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  status: varchar("status", { length: 16 }).notNull(), // sent | failed
  error: text("error"),
  optimisationId: integer("optimisation_id"),
});

/** Short-lived cache of normalised API payloads to avoid re-hitting ASA/RevenueCat/PostHog on every page load. */
export const metricCache = pgTable(
  "metric_cache",
  {
    id: serial("id").primaryKey(),
    source: varchar("source", { length: 32 }).notNull(), // asa | revenuecat | posthog
    cacheKey: varchar("cache_key", { length: 160 }).notNull(),
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    keyIdx: index("metric_cache_key_idx").on(t.source, t.cacheKey),
  }),
);
