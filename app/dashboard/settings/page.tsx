import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listKpis, listUsers } from "@/lib/repo";
import { CREDENTIAL_GROUPS, credentialStatus } from "@/lib/credentials";
import { dbAvailable } from "@/lib/db";
import AppHeader from "@/components/AppHeader";
import KpiManager from "./KpiManager";
import UserManager from "./UserManager";
import CredentialsManager from "./CredentialsManager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const [kpis, users, credStatus] = await Promise.all([
    listKpis(),
    listUsers(),
    credentialStatus(),
  ]);

  return (
    <div className="min-h-screen bg-phyt-white">
      <AppHeader session={session} />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl">Settings</h1>
        <p className="mt-2 text-phyt-ink/70">
          Connect data sources, manage KPI targets, and dashboard access.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl">Integrations &amp; API keys</h2>
          <p className="mt-1 text-sm text-phyt-ink/60">
            Connect Apple Search Ads, RevenueCat, PostHog and Claude. Encrypted at rest.
          </p>
          <div className="mt-4">
            <CredentialsManager groups={CREDENTIAL_GROUPS} initialStatus={credStatus} />
          </div>
        </section>

        {!dbAvailable && (
          <div className="mt-6 rounded-2xl bg-phyt-yellow-soft px-5 py-4 text-sm text-phyt-ink">
            <strong>Database not connected.</strong> Changes work now but reset on
            restart. Add <code>DATABASE_URL</code> (Neon) to persist them.
          </div>
        )}

        <section className="mt-10">
          <h2 className="text-2xl">KPI targets</h2>
          <p className="mt-1 text-sm text-phyt-ink/60">
            The dashboard flags metrics red/green against these.
          </p>
          <div className="mt-4">
            <KpiManager initialKpis={kpis} />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl">Users</h2>
          <p className="mt-1 text-sm text-phyt-ink/60">
            Who can log in to the dashboard. Admins (media buyers) get full
            access; clients are view-only.
          </p>
          <div className="mt-4">
            <UserManager initialUsers={users} />
          </div>
        </section>
      </main>
    </div>
  );
}
