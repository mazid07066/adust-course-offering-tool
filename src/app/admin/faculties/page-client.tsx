"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type DepartmentRow = {
  id: number;
  short_name: string;
  name: string;
};

type FacultyRow = {
  id: number;
  department_id: number;
  teacher_code: string;
  full_name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  seniority_level: number | null;
  is_active: boolean | null;
  departments: {
    id: number;
    short_name: string;
    name: string;
  };
};

export default function FacultiesPageClient() {
  const [faculties, setFaculties] = useState<FacultyRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    department_id: "",
    teacher_code: "",
    full_name: "",
    designation: "",
    email: "",
    phone: "",
    seniority_level: "",
  });

  async function loadAll() {
    setError("");

    const [f, d] = await Promise.all([
      fetch("/api/faculties/manage", { cache: "no-store" }),
      fetch("/api/departments/options", { cache: "no-store" }),
    ]);

    const fJson = await f.json();
    const dJson = await d.json();

    setFaculties(fJson.faculties || []);
    setDepartments(dJson.departments || []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function startEdit(f: FacultyRow) {
    setEditingId(f.id);
    setForm({
      department_id: String(f.department_id),
      teacher_code: f.teacher_code,
      full_name: f.full_name,
      designation: f.designation || "",
      email: f.email || "",
      phone: f.phone || "",
      seniority_level:
        f.seniority_level === null || f.seniority_level === undefined
          ? ""
          : String(f.seniority_level),
    });
    setMessage("");
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      department_id: "",
      teacher_code: "",
      full_name: "",
      designation: "",
      email: "",
      phone: "",
      seniority_level: "",
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    const res = await fetch("/api/faculties/manage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Failed to create faculty.");
      return;
    }

    setMessage("Faculty created successfully.");
    resetForm();
    await loadAll();
  }

  async function handleUpdate(id: number) {
    setMessage("");
    setError("");

    const res = await fetch(`/api/faculties/manage/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: form.full_name,
        designation: form.designation,
        email: form.email,
        phone: form.phone,
        seniority_level: form.seniority_level,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Failed to update faculty.");
      return;
    }

    setMessage("Faculty updated successfully.");
    resetForm();
    await loadAll();
  }

  async function toggleActive(f: FacultyRow) {
    setMessage("");
    setError("");

    const res = await fetch(`/api/faculties/manage/${f.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        is_active: !f.is_active,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Failed to update faculty status.");
      return;
    }

    setMessage("Faculty status updated successfully.");
    await loadAll();
  }

  async function handleDelete(id: number) {
    const ok = window.confirm("Delete this faculty record?");
    if (!ok) return;

    setMessage("");
    setError("");

    const res = await fetch(`/api/faculties/manage/${id}`, {
      method: "DELETE",
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Failed to delete faculty.");
      return;
    }

    setMessage("Faculty deleted successfully.");
    await loadAll();
  }

  return (
    <AdminLayout title="Faculties">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Create Faculty
          </h2>

          <form onSubmit={handleCreate} className="mt-4 grid gap-3 md:grid-cols-3">
            <select
              value={form.department_id}
              onChange={(e) =>
                setForm({ ...form, department_id: e.target.value })
              }
              className="rounded-xl border px-3 py-2"
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.short_name}
                </option>
              ))}
            </select>

            <input
              placeholder="Faculty Code"
              value={form.teacher_code}
              onChange={(e) =>
                setForm({ ...form, teacher_code: e.target.value.toUpperCase() })
              }
              className="rounded-xl border px-3 py-2"
            />

            <input
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) =>
                setForm({ ...form, full_name: e.target.value })
              }
              className="rounded-xl border px-3 py-2"
            />

            <input
              placeholder="Designation"
              value={form.designation}
              onChange={(e) =>
                setForm({ ...form, designation: e.target.value })
              }
              className="rounded-xl border px-3 py-2"
            />

            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              className="rounded-xl border px-3 py-2"
            />

            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
              className="rounded-xl border px-3 py-2"
            />

            <input
              type="number"
              min={1}
              max={7}
              placeholder="Seniority Level (1-7)"
              value={form.seniority_level}
              onChange={(e) =>
                setForm({ ...form, seniority_level: e.target.value })
              }
              className="rounded-xl border px-3 py-2"
            />

            <button className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 md:col-span-3">
              Add Faculty
            </button>
          </form>
        </div>

        {message ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              Faculty Records
            </h2>
            <div className="text-sm text-slate-500">Total: {faculties.length}</div>
          </div>

          <div className="mt-4 space-y-4">
            {faculties.map((f) => (
              <div key={f.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-slate-900">
                      {f.teacher_code} — {f.full_name}
                    </div>
                    <div className="text-sm text-slate-600">
                      Department: {f.departments?.short_name || "-"}
                    </div>
                    <div className="text-sm text-slate-600">
                      Designation: {f.designation || "-"}
                    </div>
                    <div className="text-sm text-slate-600">
                      Email: {f.email || "-"}
                    </div>
                    <div className="text-sm text-slate-600">
                      Phone: {f.phone || "-"}
                    </div>
                    <div className="text-sm text-slate-600">
                      Seniority Level: {f.seniority_level ?? "-"}
                    </div>
                    <div className="text-sm">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          f.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {f.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleActive(f)}
                      className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      {f.is_active ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      onClick={() => startEdit(f)}
                      className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDelete(f.id)}
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editingId === f.id ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <input
                      placeholder="Full Name"
                      value={form.full_name}
                      onChange={(e) =>
                        setForm({ ...form, full_name: e.target.value })
                      }
                      className="rounded-xl border px-3 py-2"
                    />
                    <input
                      placeholder="Designation"
                      value={form.designation}
                      onChange={(e) =>
                        setForm({ ...form, designation: e.target.value })
                      }
                      className="rounded-xl border px-3 py-2"
                    />
                    <input
                      placeholder="Email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className="rounded-xl border px-3 py-2"
                    />
                    <input
                      placeholder="Phone"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      className="rounded-xl border px-3 py-2"
                    />
                    <input
                      type="number"
                      min={1}
                      max={7}
                      placeholder="Seniority Level (1-7)"
                      value={form.seniority_level}
                      onChange={(e) =>
                        setForm({ ...form, seniority_level: e.target.value })
                      }
                      className="rounded-xl border px-3 py-2"
                    />

                    <div className="flex gap-2 md:col-span-3">
                      <button
                        onClick={() => handleUpdate(f.id)}
                        className="rounded-xl bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                      >
                        Save Changes
                      </button>

                      <button
                        onClick={resetForm}
                        className="rounded-xl border px-4 py-2 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {faculties.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
                No faculty records found.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}