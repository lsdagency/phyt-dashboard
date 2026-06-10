import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

/** True once a Neon connection string is configured. Callers fall back to sample data when false. */
export const dbAvailable = Boolean(url);

/** Drizzle client, or null when no database is configured (local/preview before Step 2 wiring). */
export const db = url ? drizzle(neon(url), { schema }) : null;

export { schema };
