import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-phyt-white">
      <AppHeader session={session} />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-4xl">App Store Ads</h1>
          <p className="mt-1 text-phyt-ink/60">
            Live performance · revenue · product analytics
          </p>
        </div>
        <DashboardClient isAdmin={session.role === "admin"} />
      </main>
    </div>
  );
}
