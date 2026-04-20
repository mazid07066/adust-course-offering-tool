"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

export default function FacultiesPageClient() {
  const [faculties, setFaculties] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [form, setForm] = useState({
    department_id: "",
    teacher_code: "",
    full_name: "",
    designation: "",
    email: "",
    phone: "",
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  async function loadAll() {
    const [f, d] = await Promise.all([
      fetch("/api/faculties/manage"),
      fetch("/api/departments/options"),
    ]);

    const fJson = await f.json();
    const dJson = await d.json();

    setFaculties(fJson.faculties || []);
    setDepartments(dJson.departments || []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCreate(e: any) {
    e.preventDefault();

    await fetch("/api/faculties/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setForm({
      department_id: "",
      teacher_code: "",
      full_name: "",
      designation: "",
      email: "",
      phone: "",
    });

    loadAll();
  }

  async function handleUpdate(id: number) {
    await fetch(`/api/faculties/manage/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setEditingId(null);
    loadAll();
  }

  async function toggleActive(f: any) {
    await fetch(`/api/faculties/manage/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_active: !f.is_active,
      }),
    });

    loadAll();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/faculties/manage/${id}`, {
      method: "DELETE",
    });
    loadAll();
  }

  return (
    <AdminLayout title="Faculties">
      <form onSubmit={handleCreate} className="grid gap-3 grid-cols-3">
        <select
          value={form.department_id}
          onChange={(e) => setForm({ ...form, department_id: e.target.value })}
          className="border p-2"
        >
          <option value="">Department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.short_name}
            </option>
          ))}
        </select>

        <input
          placeholder="Code"
          value={form.teacher_code}
          onChange={(e) =>
            setForm({ ...form, teacher_code: e.target.value })
          }
          className="border p-2"
        />

        <input
          placeholder="Name"
          value={form.full_name}
          onChange={(e) =>
            setForm({ ...form, full_name: e.target.value })
          }
          className="border p-2"
        />

        <input
          placeholder="Designation"
          value={form.designation}
          onChange={(e) =>
            setForm({ ...form, designation: e.target.value })
          }
          className="border p-2"
        />

        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
          className="border p-2"
        />

        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value })
          }
          className="border p-2"
        />

        <button className="bg-blue-600 text-white p-2 col-span-3">
          Add Faculty
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {faculties.map((f) => (
          <div key={f.id} className="border p-3 rounded">
            <div className="flex justify-between">
              <div>
                <b>{f.teacher_code}</b> — {f.full_name}
                <div className="text-sm text-gray-500">
                  {f.designation} | {f.email} | {f.phone}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => toggleActive(f)}>
                  {f.is_active ? "Deactivate" : "Activate"}
                </button>

                <button onClick={() => setEditingId(f.id)}>Edit</button>

                <button onClick={() => handleDelete(f.id)}>Delete</button>
              </div>
            </div>

            {editingId === f.id && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <input
                  placeholder="Name"
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                />
                <input
                  placeholder="Designation"
                  onChange={(e) =>
                    setForm({ ...form, designation: e.target.value })
                  }
                />
                <input
                  placeholder="Phone"
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                />

                <button
                  onClick={() => handleUpdate(f.id)}
                  className="bg-green-600 text-white p-2 col-span-3"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}