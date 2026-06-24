"use client";

import { useState } from "react";

interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "client";
}

export default function UserManager({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "client" as "admin" | "client",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Could not add user");
      setUsers(data.users);
      setForm({ email: "", name: "", role: "client", password: "" });
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: number, body: Partial<User>) {
    const res = await fetch(`/api/settings/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) setUsers(data.users);
    else setError(data.error || "Update failed");
  }

  async function remove(id: number) {
    const res = await fetch(`/api/settings/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) setUsers(data.users);
    else setError(data.error || "Delete failed");
  }

  return (
    <div className="rounded-2xl border border-phyt-ink/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-phyt-ink/10 text-left text-xs uppercase tracking-wide text-phyt-ink/50">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-phyt-ink/5">
              <td className="px-4 py-3 font-medium">{u.name}</td>
              <td className="px-4 py-3 text-phyt-ink/70">{u.email}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs ${
                    u.role === "admin" ? "bg-phyt-yellow" : "bg-phyt-blue-soft"
                  }`}
                >
                  {u.role === "admin" ? "Media buyer" : "Client"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => remove(u.id)}
                  className="text-phyt-ink/50 hover:text-phyt-ink"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={addUser} className="flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="block text-xs text-phyt-ink/60">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-36 rounded-lg border border-phyt-ink/15 px-3 py-2 outline-none focus:border-phyt-blue"
          />
        </div>
        <div>
          <label className="block text-xs text-phyt-ink/60">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-52 rounded-lg border border-phyt-ink/15 px-3 py-2 outline-none focus:border-phyt-blue"
          />
        </div>
        <div>
          <label className="block text-xs text-phyt-ink/60">Password</label>
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="min 8 chars"
            className="mt-1 w-36 rounded-lg border border-phyt-ink/15 px-3 py-2 outline-none focus:border-phyt-blue"
          />
        </div>
        <div>
          <label className="block text-xs text-phyt-ink/60">Role</label>
          <select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as "admin" | "client" })
            }
            className="mt-1 rounded-lg border border-phyt-ink/15 px-3 py-2 outline-none focus:border-phyt-blue"
          >
            <option value="client">Client</option>
            <option value="admin">Media buyer</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-phyt-yellow px-4 py-2 font-display font-bold disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add user"}
        </button>
        {error && <span className="text-sm text-phyt-ink/70">{error}</span>}
      </form>
    </div>
  );
}
