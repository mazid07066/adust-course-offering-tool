"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type StudentAccessRow = {
  studentDbId: number;
  studentId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  accountId: number | null;
  accountEmail: string | null;
  isActive: boolean | null;
  mustChangePassword: boolean | null;
  lastLoginAt: string | null;
};

export default function StudentAuthAccessPageClient() {
  const [students, setStudents] = useState<StudentAccessRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [portalEnabled, setPortalEnabled] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");

  const [passwords, setPasswords] = useState<Record<number, string>>({});
  const [emails, setEmails] = useState<Record<number, string>>({});

  async function loadData(search = q) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        `/api/admin/students/auth-access?q=${encodeURIComponent(search)}`,
        { cache: "no-store" }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load student access data.");
      }

      setStudents(json.students || []);
      setPortalEnabled(Boolean(json.portal?.enabled));
      setLoginMessage(json.portal?.loginMessage || "");

      const emailDrafts: Record<number, string> = {};
      for (const s of json.students || []) {
        emailDrafts[s.studentDbId] = s.accountEmail || s.email || "";
      }
      setEmails(emailDrafts);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load student access data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData("");
  }, []);

  async function updatePortalSetting() {
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/students/auth-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_PORTAL_SETTING",
          portalEnabled,
          loginMessage,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update portal setting.");
      }

      setMessage(json.message || "Portal setting updated.");
      loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update portal setting."
      );
    }
  }

  async function createOrResetAccount(studentDbId: number) {
    setError("");
    setMessage("");

    const password = passwords[studentDbId] || "";
    const email = emails[studentDbId] || "";

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      const res = await fetch("/api/admin/students/auth-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_OR_RESET_ACCOUNT",
          studentDbId,
          email,
          password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create/reset account.");
      }

      setMessage(json.message || "Student account created/reset.");
      setPasswords((prev) => ({ ...prev, [studentDbId]: "" }));
      loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create/reset account."
      );
    }
  }

  async function toggleActive(studentDbId: number, nextValue: boolean) {
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/students/auth-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TOGGLE_ACTIVE",
          studentDbId,
          isActive: nextValue,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update account status.");
      }

      setMessage(json.message || "Account status updated.");
      loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update account status."
      );
    }
  }

  return (
    <AdminLayout title="Student Portal Access Control">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Global Student Portal Control
          </h2>

          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr_auto] lg:items-end">
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={portalEnabled}
                onChange={(e) => setPortalEnabled(e.target.checked)}
              />
              <span className="text-sm font-medium text-slate-700">
                Portal Enabled
              </span>
            </label>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Login Page Message
              </label>
              <input
                value={loginMessage}
                onChange={(e) => setLoginMessage(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
                placeholder="Message shown when portal is closed"
              />
            </div>

            <button
              type="button"
              onClick={updatePortalSetting}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save Portal Setting
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-xl">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Search Student
              </label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadData();
                }}
                className="w-full rounded-xl border px-4 py-3"
                placeholder="Search by student ID, name, email, or phone"
              />
            </div>

            <button
              type="button"
              onClick={() => loadData()}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              {loading ? "Loading..." : "Search"}
            </button>
          </div>
        </div>

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

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Student</th>
                <th className="border-b px-3 py-3 text-left">Contact</th>
                <th className="border-b px-3 py-3 text-left">Account Email</th>
                <th className="border-b px-3 py-3 text-left">New/Reset Password</th>
                <th className="border-b px-3 py-3 text-left">Status</th>
                <th className="border-b px-3 py-3 text-left">Last Login</th>
                <th className="border-b px-3 py-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {students.map((s) => (
                <tr key={s.studentDbId}>
                  <td className="border-b px-3 py-3">
                    <div className="font-semibold text-slate-900">
                      {s.studentId}
                    </div>
                    <div className="text-slate-600">{s.fullName}</div>
                  </td>

                  <td className="border-b px-3 py-3 text-slate-600">
                    <div>{s.email || "-"}</div>
                    <div>{s.phone || "-"}</div>
                  </td>

                  <td className="border-b px-3 py-3">
                    <input
                      value={emails[s.studentDbId] || ""}
                      onChange={(e) =>
                        setEmails((prev) => ({
                          ...prev,
                          [s.studentDbId]: e.target.value,
                        }))
                      }
                      className="w-64 rounded-lg border px-3 py-2"
                      placeholder="student@email.com"
                    />
                  </td>

                  <td className="border-b px-3 py-3">
                    <input
                      type="text"
                      value={passwords[s.studentDbId] || ""}
                      onChange={(e) =>
                        setPasswords((prev) => ({
                          ...prev,
                          [s.studentDbId]: e.target.value,
                        }))
                      }
                      className="w-48 rounded-lg border px-3 py-2"
                      placeholder="Minimum 6 chars"
                    />
                  </td>

                  <td className="border-b px-3 py-3">
                    {s.accountId ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          s.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        No Account
                      </span>
                    )}
                  </td>

                  <td className="border-b px-3 py-3 text-slate-600">
                    {s.lastLoginAt || "-"}
                  </td>

                  <td className="border-b px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => createOrResetAccount(s.studentDbId)}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        {s.accountId ? "Reset" : "Create"}
                      </button>

                      {s.accountId && (
                        <button
                          type="button"
                          onClick={() =>
                            toggleActive(s.studentDbId, !Boolean(s.isActive))
                          }
                          className={`rounded-lg px-3 py-2 text-xs font-medium text-white ${
                            s.isActive
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          {s.isActive ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {students.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}