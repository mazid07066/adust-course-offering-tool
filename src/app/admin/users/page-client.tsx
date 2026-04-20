"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type Faculty = {
  id: number;
  teacher_code: string;
  full_name: string;
  designation: string | null;
  email: string | null;
};

type UserRow = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean | null;
  teacher_id: number | null;
  teachers: Faculty | null;
};

export default function UsersPageClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("FACULTY");
  const [teacherId, setTeacherId] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/users/manage", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load users.");
      }

      setUsers(json.users || []);
      setFaculties(json.faculties || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const availableFaculties = useMemo(() => {
    const usedTeacherIds = new Set(
      users
        .filter((u) => u.teacher_id !== null)
        .map((u) => u.teacher_id as number)
    );

    return faculties.filter((f) => !usedTeacherIds.has(f.id));
  }, [users, faculties]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      if (role === "FACULTY" && !teacherId) {
        throw new Error("Please select a faculty link for faculty user.");
      }

      const res = await fetch("/api/users/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          full_name: fullName,
          password,
          role,
          teacher_id: role === "FACULTY" ? Number(teacherId) : null,
          is_active: isActive,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create user.");
      }

      setUsername("");
      setFullName("");
      setPassword("");
      setRole("FACULTY");
      setTeacherId("");
      setIsActive(true);
      setMessage("User created successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm("Delete this user?");
    if (!ok) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/users/manage/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete user.");
      }

      setMessage("User deleted successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user.");
    }
  }

  async function handleToggleActive(user: UserRow) {
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/users/manage/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: !user.is_active,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update user.");
      }

      setMessage("User status updated successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user.");
    }
  }

  return (
    <AdminLayout title="User Accounts">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Account Creation Guide
          </h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>
              For <span className="font-semibold">COORDINATOR</span> and{" "}
              <span className="font-semibold">SUPER_ADMIN</span>, no faculty link is required.
            </p>
            <p>
              For <span className="font-semibold">FACULTY</span>, you must first create
              faculty master records from the Faculties page, then link one faculty record
              to one login account.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/admin/faculties"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open Faculties Setup
            </Link>

            <button
              type="button"
              onClick={loadAll}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh User Page
            </button>
          </div>
        </div>

        {role === "FACULTY" && availableFaculties.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No unlinked faculty records are available. First create faculty from{" "}
            <span className="font-semibold">/admin/faculties</span>, then come back here.
          </div>
        )}

        <form
          onSubmit={handleCreate}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"
        >
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="rounded-xl border px-4 py-3"
          />

          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full Name"
            className="rounded-xl border px-4 py-3"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="rounded-xl border px-4 py-3"
          />

          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              if (e.target.value !== "FACULTY") {
                setTeacherId("");
              }
            }}
            className="rounded-xl border px-4 py-3"
          >
            <option value="FACULTY">FACULTY</option>
            <option value="COORDINATOR">COORDINATOR</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>

          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            disabled={role !== "FACULTY" || availableFaculties.length === 0}
            className="rounded-xl border px-4 py-3"
          >
            <option value="">
              {role === "FACULTY"
                ? availableFaculties.length === 0
                  ? "No Faculty Available"
                  : "Select Faculty Link"
                : "Not Required"}
            </option>
            {availableFaculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.teacher_code} - {f.full_name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 rounded-xl border px-4 py-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>

          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create User
          </button>
        </form>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Username</th>
                <th className="border-b px-3 py-3 text-left">Full Name</th>
                <th className="border-b px-3 py-3 text-left">Role</th>
                <th className="border-b px-3 py-3 text-left">Linked Faculty</th>
                <th className="border-b px-3 py-3 text-left">Status</th>
                <th className="border-b px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="border-b px-3 py-2">{u.username}</td>
                  <td className="border-b px-3 py-2">{u.full_name}</td>
                  <td className="border-b px-3 py-2">{u.role}</td>
                  <td className="border-b px-3 py-2">
                    {u.teachers
                      ? `${u.teachers.teacher_code} - ${u.teachers.full_name}`
                      : "-"}
                  </td>
                  <td className="border-b px-3 py-2">
                    {u.is_active ? "Active" : "Inactive"}
                  </td>
                  <td className="border-b px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className="rounded-lg bg-amber-600 px-3 py-2 text-white hover:bg-amber-700"
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No users found.
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