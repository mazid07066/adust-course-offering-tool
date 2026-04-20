"use client";

import { useEffect, useMemo, useState } from "react";
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
};

type EditForm = {
  department_id: string;
  full_name: string;
  designation: string;
  email: string;
  phone: string;
};

const emptyCreateForm: CreateForm = {
  department_id: "",
  teacher_code: "",
  full_name: "",
  designation: "",
  email: "",
  phone: "",
};

const emptyEditForm: EditForm = {
  department_id: "",
  full_name: "",
  designation: "",
  email: "",
  phone: "",
};

export default function FacultiesPageClient() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [facultiesRes, departmentsRes] = await Promise.all([
        fetch("/api/faculties/manage", { cache: "no-store" }),
        fetch("/api/departments/options", { cache: "no-store" }),
      ]);

      const facultiesJson: FacultyResponse = await facultiesRes.json();
      const departmentsJson: DepartmentResponse = await departmentsRes.json();

      if (!facultiesRes.ok) {
        throw new Error(facultiesJson.error || "Failed to load faculties.");
      }

      if (!departmentsRes.ok) {
        throw new Error(departmentsJson.error || "Failed to load departments.");
      }

      setFaculties(facultiesJson.faculties || []);
      setDepartments(departmentsJson.departments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const sortedFaculties = useMemo(() => {
    return [...faculties].sort((a, b) =>
      a.teacher_code.localeCompare(b.teacher_code)
    );
  }, [faculties]);

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
      department_id: String(faculty.department_id),
      full_name: faculty.full_name || "",
      designation: faculty.designation || "",
      email: faculty.email || "",
      phone: faculty.phone || "",
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
          <h2 className="text-lg font-semibold text-slate-900">
            Create Faculty
          </h2>

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
                setCreateForm({ ...createForm, teacher_code: e.target.value })
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

            <div className="md:col-span-2 xl:col-span-3">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add Faculty
              </button>
            </div>
          </form>
        </div>

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

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Faculty Records
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Total: {sortedFaculties.length}
            </p>
          </div>

          <div className="divide-y">
            {sortedFaculties.map((f) => (
              <div key={f.id} className="p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
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
                    <div className="text-sm">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
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
                      type="button"
                      onClick={() => toggleActive(f)}
                      className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700"
                    >
                      {f.is_active ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      type="button"
                      onClick={() => startEdit(f)}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-800"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(f.id)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editingId === f.id && (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <select
                        value={editForm.department_id}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            department_id: e.target.value,
                          })
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
                        placeholder="Full Name"
                        value={editForm.full_name}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            full_name: e.target.value,
                          })
                        }
                        className="rounded-xl border px-4 py-3"
                      />

                      <input
                        placeholder="Designation"
                        value={editForm.designation}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            designation: e.target.value,
                          })
                        }
                        className="rounded-xl border px-4 py-3"
                      />

                      <input
                        placeholder="Email"
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            email: e.target.value,
                          })
                        }
                        className="rounded-xl border px-4 py-3"
                      />

                      <input
                        placeholder="Phone"
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            phone: e.target.value,
                          })
                        }
                        className="rounded-xl border px-4 py-3"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate(f.id)}
                        className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Save Changes
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {sortedFaculties.length === 0 && !loading && (
              <div className="p-8 text-center text-sm text-slate-500">
                No faculties found.
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}