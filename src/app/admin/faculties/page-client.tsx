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
  teacher_code: string;
  full_name: string;
  designation: string | null;
  email: string | null;
  is_active: boolean | null;
  departments: Department;
};

export default function FacultiesPageClient() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [departmentId, setDepartmentId] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [email, setEmail] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [deptRes, facultyRes] = await Promise.all([
        fetch("/api/departments/options", { cache: "no-store" }),
        fetch("/api/faculties/manage", { cache: "no-store" }),
      ]);

      const deptJson = await deptRes.json();
      const facultyJson = await facultyRes.json();

      if (!deptRes.ok) throw new Error(deptJson.error || "Failed to load departments");
      if (!facultyRes.ok) throw new Error(facultyJson.error || "Failed to load faculties");

      setDepartments(deptJson.departments || []);
      setFaculties(facultyJson.faculties || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load faculty data");
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
        body: JSON.stringify({
          department_id: Number(departmentId),
          teacher_code: teacherCode,
          full_name: fullName,
          designation,
          email,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create faculty");

      setDepartmentId("");
      setTeacherCode("");
      setFullName("");
      setDesignation("");
      setEmail("");
      setMessage("Faculty created successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create faculty");
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm("Delete this faculty?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/faculties/manage/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete faculty");

      setMessage("Faculty deleted successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete faculty");
    }
  }

  return (
    <AdminLayout title="Faculties">
      <div className="space-y-6">
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded-xl border px-4 py-3"
          >
            <option value="">Select Department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.short_name}
              </option>
            ))}
          </select>

          <input
            value={teacherCode}
            onChange={(e) => setTeacherCode(e.target.value.toUpperCase())}
            placeholder="Faculty Initial"
            className="rounded-xl border px-4 py-3"
          />

          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full Name"
            className="rounded-xl border px-4 py-3"
          />

          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="Designation"
            className="rounded-xl border px-4 py-3"
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-xl border px-4 py-3"
          />

          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add Faculty
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
                <th className="border-b px-3 py-3 text-left">Initial</th>
                <th className="border-b px-3 py-3 text-left">Name</th>
                <th className="border-b px-3 py-3 text-left">Designation</th>
                <th className="border-b px-3 py-3 text-left">Email</th>
                <th className="border-b px-3 py-3 text-left">Department</th>
                <th className="border-b px-3 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {faculties.map((f) => (
                <tr key={f.id}>
                  <td className="border-b px-3 py-2">{f.teacher_code}</td>
                  <td className="border-b px-3 py-2">{f.full_name}</td>
                  <td className="border-b px-3 py-2">{f.designation || "-"}</td>
                  <td className="border-b px-3 py-2">{f.email || "-"}</td>
                  <td className="border-b px-3 py-2">{f.departments.short_name}</td>
                  <td className="border-b px-3 py-2">
                    <button
                      onClick={() => handleDelete(f.id)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {faculties.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No faculties found.
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