import { redirect } from "next/navigation";

// Entry point — the middleware gates access, so send everyone to the dashboard
// (which bounces to /login if there's no session).
export default function Home() {
  redirect("/dashboard");
}
