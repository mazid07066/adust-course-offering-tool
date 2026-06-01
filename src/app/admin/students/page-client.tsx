"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin-layout";

type ProgramOption = {
  id: number;
  name: string;
  short_name: string;
  department_id: number;
  departments?: {
    id: number;
    name: string;
    short_name: string;
  };
};

type BatchOption = {
  id: number;
  batch_code: string;
  program_id: number;
  admission_term?: string | null;
  is_active?: boolean | null;
};

type AdvisorOption = {
  id: number;
  teacher_code: string;
  full_name: string;
  designation?: string | null;
};

type CatalogEntry = {
  id: number;
  department_code: string;
  program_code: string;
  program_title: string;
  program_type: string;
  study_shift: string;
  curriculum_version: string;
  curriculum_key?: string | null;
  display_label: string;
};

type StudentRow = {
  id: number;
  student_id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  current_status: string;
  admission_year?: number | null;
  enrollments: Array<{
    id: number;
    curriculum_key?: string | null;
    enrollment_status: string;
    program: ProgramOption;
    batches?: BatchOption | null;
  }>;
  advisor_assignments: Array<{
    teachers: AdvisorOption;
  }>;
};

const blankForm = {
  student_id: "",
  full_name: "",
  gender: "",
  date_of_birth: "",
  email: "",
  phone: "",
  guardian_name: "",
  guardian_phone: "",
  present_address: "",
  permanent_address: "",
  admission_year: "",
  admission_term_name: "",
  current_status: "ACTIVE",
  program_id: "",
  batch_id: "",
  curriculum_key: "",
  advisor_teacher_id: "",
  remarks: "",
};

export default function StudentsPageClient() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [advisors, setAdvisors] = useState<AdvisorOption[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([]);
  const [curriculumKeys, setCurriculumKeys] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [form, setForm] = useState(blankForm);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredFormBatches = useMemo(() => {
    const programId = Number(form.program_id || 0);
    if (!programId) return [];
    return batches.filter((batch) => batch.program_id === programId);
  }, [batches, form.program_id]);

  const filteredSearchBatches = useMemo(() => {
    const programId = Number(programFilter || 0);
    if (!programId) return batches;
    return batches.filter((batch) => batch.program_id === programId);
  }, [batches, programFilter]);

  const selectedProgram = useMemo(() => {
    return programs.find((program) => String(program.id) === form.program_id);
  }, [programs, form.program_id]);

  const filteredCatalogEntries = useMemo(() => {
    if (!selectedProgram) return catalogEntries;

    return catalogEntries.filter((entry) => {
      const matchesProgramCode =
        entry.program_code?.toUpperCase() ===
        selectedProgram.short_name?.toUpperCase();

      const matchesProgramTitle =
        entry.program_title
          ?.toUpperCase()
          .includes(selectedProgram.name?.toUpperCase()) ||
        selectedProgram.name
          ?.toUpperCase()
          .includes(entry.program_title?.toUpperCase());

      const matchesDepartment =
        !selectedProgram.departments?.short_name ||
        entry.department_code?.toUpperCase() ===
          selectedProgram.departments.short_name.toUpperCase();

      return matchesDepartment && (matchesProgramCode || matchesProgramTitle);
    });
  }, [catalogEntries, selectedProgram]);

  async function loadOptions() {
    const res = await fetch("/api/admin/students/options", {
      cache: "no-store",
    });
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Failed to load options.");
    }

    setPrograms(json.programs || []);
    setBatches(json.batches || []);
    setAdvisors(json.advisors || []);
    setCatalogEntries(json.catalogEntries || []);
    setCurriculumKeys(json.curriculumKeys || []);
    setStatuses(json.statuses || []);
  }

  async function loadStudents() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (programFilter) params.set("programId", programFilter);
      if (batchFilter) params.set("batchId", batchFilter);

      const res = await fetch(`/api/admin/students?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load students.");
      }

      setStudents(json.students || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students.");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOptions()
      .then(loadStudents)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to initialize page.")
      );
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create student.");
      }

      setMessage("Student created successfully.");
      setForm(blankForm);
      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create student.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm(
      "Delete this student record? This will remove S1 student core data for this student."
    );
    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete student.");
      }

      setMessage("Student deleted successfully.");
      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete student.");
    }
  }

  return (
    <AdminLayout title="Students">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Add Student</h2>
          <p className="mt-1 text-sm text-slate-500">
            S1 stores identity and enrollment only. Registration, billing,
            attendance, grades, and admit cards will be added in later phases.
          </p>

          <form onSubmit={handleCreate} className="mt-5 grid gap-4 lg:grid-cols-4">
            <input
              required
              placeholder="Student ID"
              value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              className="rounded-xl border px-4 py-3"
            />

            <input
              required
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="rounded-xl border px-4 py-3"
            />

            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="rounded-xl border px-4 py-3"
            >
              <option value="">Gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>

            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) =>
                setForm({ ...form, date_of_birth: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            />

            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-xl border px-4 py-3"
            />

            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-xl border px-4 py-3"
            />

            <input
              placeholder="Guardian Name"
              value={form.guardian_name}
              onChange={(e) =>
                setForm({ ...form, guardian_name: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            />

            <input
              placeholder="Guardian Phone"
              value={form.guardian_phone}
              onChange={(e) =>
                setForm({ ...form, guardian_phone: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            />

            <select
              required
              value={form.program_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  program_id: e.target.value,
                  batch_id: "",
                  curriculum_key: "",
                })
              }
              className="rounded-xl border px-4 py-3"
            >
              <option value="">Program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.short_name} — {program.name}
                </option>
              ))}
            </select>

            <select
              value={form.batch_id}
              onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
              className="rounded-xl border px-4 py-3"
            >
              <option value="">Batch</option>
              {filteredFormBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_code}
                </option>
              ))}
            </select>

            <select
              value={form.curriculum_key}
              onChange={(e) =>
                setForm({ ...form, curriculum_key: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            >
              <option value="">Curriculum Key</option>

              {filteredCatalogEntries.map((entry) => (
                <option
                  key={`catalog-${entry.id}`}
                  value={entry.curriculum_key || ""}
                >
                  {entry.display_label}
                  {entry.curriculum_key ? ` — ${entry.curriculum_key}` : ""}
                </option>
              ))}

              {filteredCatalogEntries.length === 0 &&
                curriculumKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
            </select>

            <select
              value={form.advisor_teacher_id}
              onChange={(e) =>
                setForm({ ...form, advisor_teacher_id: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            >
              <option value="">Advisor</option>
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisor.teacher_code} — {advisor.full_name}
                </option>
              ))}
            </select>

            <input
              placeholder="Admission Year"
              value={form.admission_year}
              onChange={(e) =>
                setForm({ ...form, admission_year: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            />

            <input
              placeholder="Admission Term e.g. SPRING 2026"
              value={form.admission_term_name}
              onChange={(e) =>
                setForm({ ...form, admission_term_name: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            />

            <select
              value={form.current_status}
              onChange={(e) =>
                setForm({ ...form, current_status: e.target.value })
              }
              className="rounded-xl border px-4 py-3"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <input
              placeholder="Remarks"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="rounded-xl border px-4 py-3"
            />

            <textarea
              placeholder="Present Address"
              value={form.present_address}
              onChange={(e) =>
                setForm({ ...form, present_address: e.target.value })
              }
              className="rounded-xl border px-4 py-3 lg:col-span-2"
            />

            <textarea
              placeholder="Permanent Address"
              value={form.permanent_address}
              onChange={(e) =>
                setForm({ ...form, permanent_address: e.target.value })
              }
              className="rounded-xl border px-4 py-3 lg:col-span-2"
            />

            <button
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 lg:col-span-4"
            >
              {saving ? "Saving..." : "Create Student"}
            </button>
          </form>
        </div>

        {(message || error) && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-5">
            <input
              placeholder="Search ID, name, phone, email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-xl border px-4 py-3 lg:col-span-2"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border px-4 py-3"
            >
              <option value="">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={programFilter}
              onChange={(e) => {
                setProgramFilter(e.target.value);
                setBatchFilter("");
              }}
              className="rounded-xl border px-4 py-3"
            >
              <option value="">All Programs</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.short_name}
                </option>
              ))}
            </select>

            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="rounded-xl border px-4 py-3"
            >
              <option value="">All Batches</option>
              {filteredSearchBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_code}
                </option>
              ))}
            </select>

            <button
              onClick={loadStudents}
              disabled={loading}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 lg:col-span-5"
            >
              {loading ? "Searching..." : "Search Students"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Student ID</th>
                <th className="border-b px-3 py-3 text-left">Name</th>
                <th className="border-b px-3 py-3 text-left">Program</th>
                <th className="border-b px-3 py-3 text-left">Batch</th>
                <th className="border-b px-3 py-3 text-left">Advisor</th>
                <th className="border-b px-3 py-3 text-left">Contact</th>
                <th className="border-b px-3 py-3 text-left">Status</th>
                <th className="border-b px-3 py-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student) => {
                const enrollment = student.enrollments?.[0];
                const advisor = student.advisor_assignments?.[0]?.teachers;

                return (
                  <tr key={student.id}>
                    <td className="border-b px-3 py-2 font-medium">
                      {student.student_id}
                    </td>
                    <td className="border-b px-3 py-2">{student.full_name}</td>
                    <td className="border-b px-3 py-2">
                      {enrollment?.program?.short_name || "-"}
                    </td>
                    <td className="border-b px-3 py-2">
                      {enrollment?.batches?.batch_code || "-"}
                    </td>
                    <td className="border-b px-3 py-2">
                      {advisor
                        ? `${advisor.teacher_code} — ${advisor.full_name}`
                        : "-"}
                    </td>
                    <td className="border-b px-3 py-2">
                      <div>{student.phone || "-"}</div>
                      <div className="text-xs text-slate-500">
                        {student.email || "-"}
                      </div>
                    </td>
                    <td className="border-b px-3 py-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {student.current_status}
                      </span>
                    </td>
                    <td className="border-b px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/students/${student.id}`}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          View
                        </Link>

                        <button
                          onClick={() => handleDelete(student.id)}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {students.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
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