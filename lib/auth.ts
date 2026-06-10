import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/constants";
import { verifyLogin, type Role as RepoRole } from "@/lib/repo";

export type Role = RepoRole;

export interface Session {
  email: string;
  role: Role;
  name: string;
}

export { SESSION_COOKIE };
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function secret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || "phyt-dev-secret-change-me",
  );
}

/** True when no real admin password is set — the app is running on demo credentials. */
export function isDemoMode() {
  return !process.env.ADMIN_PASSWORD;
}

/** Demo login hint shown on the login page when running on default credentials. */
export function demoCredentials() {
  return { email: "admin@phyt.local", password: "phyt-demo" };
}

/**
 * Verify credentials against the users table (bcrypt). The admin + client are
 * seeded from env on first run; further client users are added via Settings.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<Session | null> {
  const user = await verifyLogin(email, password);
  if (!user) return null;
  return { email: user.email, role: user.role, name: user.name };
}

export async function createSession(session: Session) {
  const token = await new SignJWT({ role: session.role, name: session.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.email)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      email: String(payload.sub),
      role: payload.role as Role,
      name: String(payload.name),
    };
  } catch {
    return null;
  }
}
