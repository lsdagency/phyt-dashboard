/**
 * Seeds sensible default KPI targets. Safe to re-run (upserts by metric).
 * Usage: DATABASE_URL=... npm run db:seed
 */
import { db, dbAvailable, schema } from "../lib/db/index";
import { sql } from "drizzle-orm";

const DEFAULT_TARGETS: {
  metric: string;
  target: number;
  direction: "up" | "down";
}[] = [
  { metric: "cpa", target: 12, direction: "down" }, // cost per install/acquisition
  { metric: "cpt", target: 1.5, direction: "down" }, // cost per tap
  { metric: "ttr", target: 6, direction: "up" }, // tap-through rate %
  { metric: "installs", target: 500, direction: "up" }, // per period
  { metric: "trial_conversion", target: 35, direction: "up" }, // % trial -> paid
  { metric: "roas", target: 1.5, direction: "up" }, // revenue / spend
];

async function main() {
  if (!dbAvailable || !db) {
    console.error("No DATABASE_URL set — nothing to seed.");
    process.exit(1);
  }

  for (const t of DEFAULT_TARGETS) {
    await db
      .insert(schema.kpiTargets)
      .values(t)
      .onConflictDoUpdate({
        target: schema.kpiTargets.metric,
        set: { target: t.target, direction: t.direction, updatedAt: sql`now()` },
      });
  }

  console.log(`Seeded ${DEFAULT_TARGETS.length} KPI targets.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
