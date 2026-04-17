"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/admin",
    });

    if (result?.error) {
      setMessage("Invalid email or password.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-slate-900">ADUST Login</h1>
        <p className="mt-2 text-slate-600">
          Sign in as Super Admin, Coordinator, or Faculty
        </p>

        <form onSubmit={handleLogin} className="mt-6 grid gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-lg border px-3 py-2"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="rounded-lg border px-3 py-2"
            required
          />

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-white"
          >
            Sign In
          </button>
        </form>

        {message && <div className="mt-4 text-sm text-red-700">{message}</div>}
      </div>
    </main>
  );
}