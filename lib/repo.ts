import bcrypt from "bcryptjs";
import { eq, asc } from "drizzle-orm";
import { db, dbAvailable, schema } from "./db";

export type Role = "admin" | "client";
export type Direction = "up" | "down";

export interface UserRecord {
  id: number;
  email: string;
  name: string;
  role: Role;
  receivesDailyReport: boolean;
}
export interface KpiRecord {
  id: number;
  metric: string;
  target: number;
  direction: Direction;
}

/**
 * Data access for users + KPI targets.
 * Uses Neon when DATABASE_URL is set; otherwise an in-memory store so the
 * dashboard is fully usable locally (resets on restart — persistence needs the DB).
 */

// ---------- in-memory fallback ----------
const mem = {
  users: [] as (UserRecord & { passwordHash: string })[],
  kpis: [] as KpiRecord[],
  seq: 1,
};

function defaultUserSeeds() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@phyt.local").toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || "phyt-demo";
  const clientEmail = (process.env.CLIENT_EMAIL || "client@phyt.local").toLowerCase();
  const clientPass = process.env.CLIENT_PASSWORD || "phyt-demo";
  return [
    {
      email: adminEmail,
      name: "Media Buyer",
      role: "admin" as Role,
      receivesDailyReport: false,
      passwordHash: bcrypt.hashSync(adminPass, 10),
    },
    {
      email: clientEmail,
      name: process.env.CLIENT_NAME || "PHYT",
      role: "client" as Role,
      receivesDailyReport: true,
      passwordHash: bcrypt.hashSync(clientPass, 10),
    },
  ];
}

function defaultKpiSeeds(): Omit<KpiRecord, "id">[] {
  return [
    { metric: "cpa", target: 12, direction: "down" },
    { metric: "cpt", target: 1.5, direction: "down" },
    { metric: "ttr", target: 6, direction: "up" },
    { metric: "installs", target: 500, direction: "up" },
    { metric: "trial_conversion", target: 35, direction: "up" },
    { metric: "roas", target: 1.5, direction: "up" },
  ];
}

let bootPromise: Promise<void> | null = null;
function ensureBootstrap() {
  if (!bootPromise) bootPromise = doBootstrap();
  return bootPromise;
}

async function doBootstrap() {
  if (dbAvailable && db) {
    const u = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
    if (u.length === 0) await db.insert(schema.users).values(defaultUserSeeds());
    const k = await db.select({ id: schema.kpiTargets.id }).from(schema.kpiTargets).limit(1);
    if (k.length === 0) await db.insert(schema.kpiTargets).values(defaultKpiSeeds());
    return;
  }
  // in-memory
  if (mem.users.length === 0) {
    for (const s of defaultUserSeeds()) mem.users.push({ id: mem.seq++, ...s });
  }
  if (mem.kpis.length === 0) {
    for (const s of defaultKpiSeeds()) mem.kpis.push({ id: mem.seq++, ...s });
  }
}

// ---------- auth ----------
export async function verifyLogin(
  email: string,
  password: string,
): Promise<UserRecord | null> {
  await ensureBootstrap();
  const e = email.trim().toLowerCase();

  if (dbAvailable && db) {
    const rows = await db.select().from(schema.users).where(eq(schema.users.email, e)).limit(1);
    const row = rows[0];
    if (!row || !bcrypt.compareSync(password, row.passwordHash)) return null;
    return toUser(row);
  }

  const row = mem.users.find((u) => u.email === e);
  if (!row || !bcrypt.compareSync(password, row.passwordHash)) return null;
  return stripHash(row);
}

// ---------- users ----------
export async function listUsers(): Promise<UserRecord[]> {
  await ensureBootstrap();
  if (dbAvailable && db) {
    const rows = await db.select().from(schema.users).orderBy(asc(schema.users.id));
    return rows.map(toUser);
  }
  return mem.users.map(stripHash);
}

export async function createUser(input: {
  email: string;
  name: string;
  role: Role;
  receivesDailyReport: boolean;
  password: string;
}): Promise<UserRecord> {
  await ensureBootstrap();
  const passwordHash = bcrypt.hashSync(input.password, 10);
  const email = input.email.trim().toLowerCase();

  if (dbAvailable && db) {
    const [row] = await db
      .insert(schema.users)
      .values({ email, name: input.name, role: input.role, receivesDailyReport: input.receivesDailyReport, passwordHash })
      .returning();
    return toUser(row);
  }
  if (mem.users.some((u) => u.email === email)) {
    throw new Error("A user with that email already exists.");
  }
  const rec = { id: mem.seq++, email, name: input.name, role: input.role, receivesDailyReport: input.receivesDailyReport, passwordHash };
  mem.users.push(rec);
  return stripHash(rec);
}

export async function updateUser(
  id: number,
  patch: { name?: string; role?: Role; receivesDailyReport?: boolean; password?: string },
): Promise<void> {
  await ensureBootstrap();
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.role !== undefined) set.role = patch.role;
  if (patch.receivesDailyReport !== undefined) set.receivesDailyReport = patch.receivesDailyReport;
  if (patch.password) set.passwordHash = bcrypt.hashSync(patch.password, 10);

  if (dbAvailable && db) {
    await db.update(schema.users).set(set).where(eq(schema.users.id, id));
    return;
  }
  const row = mem.users.find((u) => u.id === id);
  if (!row) return;
  if (set.name !== undefined) row.name = set.name as string;
  if (set.role !== undefined) row.role = set.role as Role;
  if (set.receivesDailyReport !== undefined) row.receivesDailyReport = set.receivesDailyReport as boolean;
  if (set.passwordHash !== undefined) row.passwordHash = set.passwordHash as string;
}

export async function deleteUser(id: number): Promise<void> {
  await ensureBootstrap();
  if (dbAvailable && db) {
    await db.delete(schema.users).where(eq(schema.users.id, id));
    return;
  }
  mem.users = mem.users.filter((u) => u.id !== id);
}

export async function countAdmins(): Promise<number> {
  const all = await listUsers();
  return all.filter((u) => u.role === "admin").length;
}

/** Client recipients of the daily report. */
export async function reportRecipients(): Promise<UserRecord[]> {
  const all = await listUsers();
  return all.filter((u) => u.receivesDailyReport);
}

// ---------- KPIs ----------
export async function listKpis(): Promise<KpiRecord[]> {
  await ensureBootstrap();
  if (dbAvailable && db) {
    const rows = await db.select().from(schema.kpiTargets).orderBy(asc(schema.kpiTargets.id));
    return rows.map((r) => ({ id: r.id, metric: r.metric, target: r.target, direction: r.direction as Direction }));
  }
  return [...mem.kpis];
}

export async function upsertKpi(input: { metric: string; target: number; direction: Direction }): Promise<void> {
  await ensureBootstrap();
  const metric = input.metric.trim().toLowerCase().replace(/\s+/g, "_");

  if (dbAvailable && db) {
    await db
      .insert(schema.kpiTargets)
      .values({ metric, target: input.target, direction: input.direction })
      .onConflictDoUpdate({
        target: schema.kpiTargets.metric,
        set: { target: input.target, direction: input.direction },
      });
    return;
  }
  const existing = mem.kpis.find((k) => k.metric === metric);
  if (existing) {
    existing.target = input.target;
    existing.direction = input.direction;
  } else {
    mem.kpis.push({ id: mem.seq++, metric, target: input.target, direction: input.direction });
  }
}

export async function deleteKpi(id: number): Promise<void> {
  await ensureBootstrap();
  if (dbAvailable && db) {
    await db.delete(schema.kpiTargets).where(eq(schema.kpiTargets.id, id));
    return;
  }
  mem.kpis = mem.kpis.filter((k) => k.id !== id);
}

// ---------- helpers ----------
function toUser(row: typeof schema.users.$inferSelect): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    receivesDailyReport: row.receivesDailyReport,
  };
}
function stripHash(row: UserRecord & { passwordHash: string }): UserRecord {
  const { passwordHash, ...rest } = row;
  void passwordHash;
  return rest;
}
