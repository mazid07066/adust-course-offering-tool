"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type Department = {
  id: number;
  name: string;
  short_name: string;
};

type Faculty = {
  id: number;
  department_id: number;
  teacher_code: string;
  full_name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  seniority_level: number | null;
  is_active: boolean | null;
  departments: Department;
};

type FacultyResponse = {
  success?: boolean;
  faculties?: Faculty[];
  faculty?: Faculty;
  message?: string;
  error?: string;
};

type DepartmentResponse = {
  success?: boolean;
  departments?: Department[];
  error?: string;
};

type CreateForm = {
  department_id: string;
  teacher_code: string;
  full_name: string;
  designation: string;
  email: string;
  phone: string;
  seniority_level: string;
};

type EditForm = {
  full_name: string;
  designation: string;
  email: string;
  phone: string;
  seniority_level: string;
};

const emptyCreateForm: CreateForm = {
  department_id: "",
  teacher_code: "",
  full_name: "",
  designation: "",
  email: "",
  phone: "",
  seniority_level: "",
};

const emptyEditForm: EditForm = {
  full_name: "",
  designation: "",
  email: "",
  phone: "",
  seniority_level: "",
};

const SENIORITY_LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function FacultiesPageClient() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [facultyRes, deptRes] = await Promise.all([
        fetch("/api/faculties/manage", { cache: "no-store" }),
        fetch("/api/departments/options", { cache: "no-store" }),
      ]);

      const facultyJson: FacultyResponse = await facultyRes.json();
      const deptJson: DepartmentResponse = await deptRes.json();

      if (!facultyRes.ok) {
        throw new Error(facultyJson.error || "Failed to load faculties.");
      }

      if (!deptRes.ok) {
        throw new Error(deptJson.error || "Failed to load departments.");
      }

      setFaculties(facultyJson.faculties || []);
      setDepartments(deptJson.departments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load faculty data.");
      setFaculties([]);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/faculties/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createForm),
      });

      const json: FacultyResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create faculty.");
      }

      setCreateForm(emptyCreateForm);
      setMessage(json.message || "Faculty created successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create faculty.");
    }
  }

  function startEdit(faculty: Faculty) {
    setEditingId(faculty.id);
    setEditForm({
      full_name: faculty.full_name,
      designation: faculty.designation || "",
      email: faculty.email || "",
      phone: faculty.phone || "",
      seniority_level:
        faculty.seniority_level === null || faculty.seniority_level === undefined
          ? ""
          : String(faculty.seniority_level),
    });
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyEditForm);
  }

  async function handleUpdate(id: number) {
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/faculties/manage/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });

      const json: FacultyResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update faculty.");
      }

      setEditingId(null);
      setEditForm(emptyEditForm);
      setMessage(json.message || "Faculty updated successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update faculty.");
    }
  }

  async function toggleActive(faculty: Faculty) {
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/faculties/manage/${faculty.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: !faculty.is_active,
        }),
      });

      const json: FacultyResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update faculty status.");
      }

      setMessage(
        faculty.is_active
          ? "Faculty deactivated successfully."
          : "Faculty activated successfully."
      );
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update faculty status."
      );
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm("Delete this faculty?");
    if (!ok) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/faculties/manage/${id}`, {
        method: "DELETE",
      });

      const json: FacultyResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete faculty.");
      }

      setMessage(json.message || "Faculty deleted successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete faculty.");
    }
  }

  return (
    <AdminLayout title="Faculties">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Create Faculty</h2>

          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <select
              value={createForm.department_id}
              onChange={(e) =>
                setCreateForm({ ...createForm, department_id: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.short_name} - {d.name}
                </option>
              ))}
            </select>

            <input
              placeholder="Faculty Code"
              value={createForm.teacher_code}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  teacher_code: e.target.value.toUpperCase(),
                })
              }
              className="rounded-xl border px-4 py-3"
            />

            <input
              placeholder="Full Name"
              value={createForm.full_name}
              onChange={(e) =>
                setCreateForm({ ...createForm, full_name: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            />

            <input
              placeholder="Designation"
              value={createForm.designation}
              onChange={(e) =>
                setCreateForm({ ...createForm, designation: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            />

            <input
              placeholder="Email"
              value={createForm.email}
              onChange={(e) =>
                setCreateForm({ ...createForm, email: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            />

            <input
              placeholder="Phone"
              value={createForm.phone}
              onChange={(e) =>
                setCreateForm({ ...createForm, phone: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            />

            <select
              value={createForm.seniority_level}
              onChange={(e) =>
                setCreateForm({ ...createForm, seniority_level: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            >
              <option value="">Seniority Level (optional)</option>
              {SENIORITY_LEVELS.map((level) => (
                <option key={level} value={String(level)}>
                  Level {level}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 xl:col-span-3"
            >
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
            <h2 className="text-lg font-semibold text-slate-900">Faculty Records</h2>
            <div className="text-sm text-slate-500">
              {loading ? "Loading..." : `Total: ${faculties.length}`}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {faculties.map((faculty) => (
              <div
                key={faculty.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-base font-semibold text-slate-900">
                      {faculty.teacher_code} — {faculty.full_name}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Department: {faculty.departments?.short_name || "-"}
                    </div>
                    <div className="text-sm text-slate-600">
                      Designation: {faculty.designation || "-"}
                    </div>
                    <div className="text-sm text-slate-600">
                      Email: {faculty.email || "-"}
                    </div>
                    <div className="text-sm text-slate-600">
                      Phone: {faculty.phone || "-"}
                    </div>
                    <div className="text-sm text-slate-600">
                      Seniority Level: {faculty.seniority_level ?? "-"}
                    </div>
                    <div className="mt-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          faculty.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {faculty.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleActive(faculty)}
                      className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      {faculty.is_active ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      onClick={() => startEdit(faculty)}
                      className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDelete(faculty.id)}
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editingId === faculty.id ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <input
                      placeholder="Full Name"
                      value={editForm.full_name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, full_name: e.target.value })
                      }
                      className="rounded-xl border px-4 py-3"
                    />

                    <input
                      placeholder="Designation"
                      value={editForm.designation}
                      onChange={(e) =>
                        setEditForm({ ...editForm, designation: e.target.value })
                      }
                      className="rounded-xl border px-4 py-3"
                    />

                    <input
                      placeholder="Email"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      className="rounded-xl border px-4 py-3"
                    />

                    <input
                      placeholder="Phone"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm({ ...editForm, phone: e.target.value })
                      }
                      className="rounded-xl border px-4 py-3"
                    />

                    <select
                      value={editForm.seniority_level}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          seniority_level: e.target.value,
                        })
                      }
                      className="rounded-xl border px-4 py-3"
                    >
                      <option value="">Seniority Level (optional)</option>
                      {SENIORITY_LEVELS.map((level) => (
                        <option key={level} value={String(level)}>
                          Level {level}
                        </option>
                      ))}
                    </select>

                    <div className="flex gap-2 xl:col-span-3">
                      <button
                        onClick={() => handleUpdate(faculty.id)}
                        className="rounded-xl bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-xl border px-4 py-2 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {faculties.length === 0 && !loading ? (
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