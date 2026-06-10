import { redirect } from "next/navigation";
import { getSession, isDemoMode, demoCredentials } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  // Already signed in? Skip straight to the dashboard.
  const session = await getSession();
  if (session) redirect("/dashboard");

  const demo = isDemoMode() ? demoCredentials() : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-phyt-white px-6">
      {/* Decorative accent bar — the four PHYT accents */}
      <div className="w-full max-w-md">
        <div className="mb-6 flex gap-2">
          <span className="h-2 flex-1 rounded-full bg-phyt-yellow" />
          <span className="h-2 flex-1 rounded-full bg-phyt-green" />
          <span className="h-2 flex-1 rounded-full bg-phyt-pink" />
          <span className="h-2 flex-1 rounded-full bg-phyt-blue" />
        </div>

        <div className="rounded-3xl border border-phyt-ink/10 p-8 shadow-sm">
          <h1 className="text-4xl">PHYT</h1>
          <p className="mt-1 text-phyt-ink/70">
            App Store Ads · Revenue · Analytics
          </p>

          <LoginForm demo={demo} />
        </div>

        <p className="mt-6 text-center text-xs text-phyt-ink/50">
          Secure reporting dashboard · lsd agency
        </p>
      </div>
    </main>
  );
}
