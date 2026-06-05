"use client";

import { useEffect, useState } from "react";
import StudentLayout from "@/components/student-layout";

type MeResponse = {
  success?: boolean;
  error?: string;
  account?: {
    must_change_password?: boolean;
  };
  student?: {
    full_name?: string;
    student_id?: string;
  };
};

export default function StudentChangePasswordPageClient() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadMe() {
    setLoadingMe(true);

    try {
      const res = await fetch("/api/student/profile", {
        cache: "no-store",
      });

      const json = await res.json();

      if (res.status === 401) {
        window.location.href = "/student/login";
        return;
      }

      setMe(json);
    } catch {
      setMe({ error: "Failed to load account information." });
    } finally {
      setLoadingMe(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/student-auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to change password.");
      }

      setMessage(json.message || "Password changed successfully.");
      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      await loadMe();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change password."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <StudentLayout
      title="Change Password"
      subtitle="Update your student portal account password"
    >
      <div className="mx-auto max-w-2xl space-y-6">
        {loadingMe ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            Loading account status...
          </div>
        ) : (
          <>
            {me?.account?.must_change_password && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                Your account is using a temporary password. You must change it
                to continue safely.
              </div>
            )}

            {me?.error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {me.error}
              </div>
            )}
          </>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Current Password
              </label>
              <input
                type="password"
                value={form.currentPassword}
                onChange={(e) =>
                  setForm({ ...form, currentPassword: e.target.value })
                }
                className="w-full rounded-xl border px-4 py-3"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                New Password
              </label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) =>
                  setForm({ ...form, newPassword: e.target.value })
                }
                className="w-full rounded-xl border px-4 py-3"
                required
              />
              <p className="mt-2 text-xs text-slate-500">
                Minimum 8 characters with uppercase, lowercase, and number.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Confirm New Password
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
                className="w-full rounded-xl border px-4 py-3"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Changing Password..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </StudentLayout>
  );
}