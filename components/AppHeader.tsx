import Link from "next/link";
import type { Session } from "@/lib/auth";

/** Top bar shown on every authenticated page. Nav + role badge + logout. */
export default function AppHeader({ session }: { session: Session }) {
  const isAdmin = session.role === "admin";
  return (
    <header className="sticky top-0 z-10 border-b border-phyt-ink/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="font-display text-xl font-bold">
            PHYT
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-phyt-ink/70 sm:flex">
            <Link href="/dashboard" className="hover:text-phyt-ink">
              Dashboard
            </Link>
            {isAdmin && (
              <Link href="/dashboard/settings" className="hover:text-phyt-ink">
                Settings
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isAdmin ? "bg-phyt-yellow" : "bg-phyt-blue-soft"
            }`}
          >
            {isAdmin ? "Media buyer" : "Client"}
          </span>
          <span className="hidden text-sm text-phyt-ink/70 sm:inline">
            {session.email}
          </span>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-phyt-ink/15 px-3 py-1.5 text-sm transition hover:bg-phyt-ink/5"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
